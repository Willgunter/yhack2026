/**
 * Praesidia Slack Monitor — Queue-Based Architecture
 *
 * 1. Poller: watches Slack every 3s, scrubs with Presidio, writes to SQLite queue
 * 2. Worker: processes queue sequentially through K2 (no rate limit issues)
 * 3. Electron polls the queue for results to display
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 3005;
const TOKEN_PATH = path.join(os.homedir(), '.praesidia', 'slack_tokens.json');
const DB_PATH = path.join(os.homedir(), '.praesidia', 'slack_queue.db');
const POLL_INTERVAL = 5000; // 5s — Business+ tier has higher rate limits
const WORKER_INTERVAL = 3000;

// ─── DATABASE SETUP ───
function initDB() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
        CREATE TABLE IF NOT EXISTS message_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slack_ts TEXT UNIQUE,
            channel_id TEXT,
            user_id TEXT,
            raw_text TEXT,
            scrubbed_text TEXT,
            pii_findings TEXT DEFAULT '[]',
            pii_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            verdict TEXT,
            reasoning TEXT,
            regulation TEXT,
            suggested_rewrite TEXT,
            level INTEGER DEFAULT 0,
            notified INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            processed_at TEXT
        )
    `);
    return db;
}

// ─── SLACK POLLER ───
async function startPoller(db, userToken, userId, channels) {
    let lastTs = String((Date.now() - 60000) / 1000);

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO message_queue (slack_ts, channel_id, user_id, raw_text, scrubbed_text, pii_findings, pii_count, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    console.log(`[Poller] Watching ${channels.length} channels, polling every ${POLL_INTERVAL / 1000}s`);

    let backoffUntil = 0;

    setInterval(async () => {
        // Rate limit backoff
        if (Date.now() < backoffUntil) return;

        for (const channelId of channels) {
            try {
                const resp = await axios.get('https://slack.com/api/conversations.history', {
                    headers: { Authorization: `Bearer ${userToken}` },
                    params: { channel: channelId, oldest: lastTs, limit: 10 }
                });

                // Handle rate limiting
                if (resp.data.error === 'ratelimited') {
                    const wait = 60000; // Back off 60 seconds
                    console.log(`[Poller] Rate limited, backing off ${wait/1000}s`);
                    backoffUntil = Date.now() + wait;
                    return;
                }

                const messages = (resp.data.messages || []).filter(m =>
                    m.user === userId && !m.subtype && (m.text || '').length >= 50
                );

                for (const msg of messages) {
                    lastTs = msg.ts;

                    // Check if already queued
                    const existing = db.prepare('SELECT id FROM message_queue WHERE slack_ts = ?').get(msg.ts);
                    if (existing) continue;

                    // Presidio scrub (fast, local)
                    let scrubbed = msg.text;
                    let piiFindings = [];
                    try {
                        const scrubResp = await axios.post('http://localhost:5001/scan', {
                            content: msg.text, source: 'slack', author: userId
                        }, { timeout: 5000 });
                        scrubbed = scrubResp.data.scrubbed_content || msg.text;
                        piiFindings = scrubResp.data.pii_findings || [];
                    } catch (e) { /* Presidio not running */ }

                    // Write to queue
                    insertStmt.run(
                        msg.ts, channelId, userId, msg.text,
                        scrubbed, JSON.stringify(piiFindings), piiFindings.length
                    );
                    console.log(`[Poller] Queued: "${msg.text.substring(0, 60)}..." (${piiFindings.length} PII)`);
                }
            } catch (e) { /* channel error */ }
        }
    }, POLL_INTERVAL);
}

// ─── K2 WORKER ───
function startWorker(db) {
    const getPending = db.prepare(
        "SELECT * FROM message_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1"
    );
    const updateResult = db.prepare(`
        UPDATE message_queue SET
            status = 'done', verdict = ?, reasoning = ?, regulation = ?,
            suggested_rewrite = ?, level = ?, processed_at = datetime('now')
        WHERE id = ?
    `);
    const markError = db.prepare(
        "UPDATE message_queue SET status = 'error', reasoning = ?, processed_at = datetime('now') WHERE id = ?"
    );

    let processing = false;

    console.log(`[Worker] Processing queue every ${WORKER_INTERVAL / 1000}s`);

    setInterval(async () => {
        if (processing) return; // One at a time
        const row = getPending.get();
        if (!row) return;

        processing = true;
        console.log(`[Worker] Processing message #${row.id}: "${row.scrubbed_text.substring(0, 60)}..."`);

        try {
            const k2Resp = await axios.post(`http://127.0.0.1:${PORT}/api/slack/intercept`, {
                action: row.scrubbed_text, userId: row.user_id
            }, { timeout: 60000 });

            const d = k2Resp.data;
            const verdict = d.verdict || 'UNKNOWN';
            const reasoning = d.thought_process || d.reasoning || '';
            const regulation = d.cited_regulation || '';
            const rewrite = d.suggested_rewrite || '';
            const level = d.level || 0;

            updateResult.run(verdict, reasoning, regulation, rewrite, level, row.id);
            console.log(`[Worker] Result: ${verdict} | ${regulation}`);

            // Write notification file so Electron renderer can update the dashboard
            try {
                const notifyDir = path.join(os.homedir(), '.praesidia', 'notifications');
                if (!fs.existsSync(notifyDir)) fs.mkdirSync(notifyDir, { recursive: true });
                const notifyFile = path.join(notifyDir, `${Date.now()}_${row.id}.json`);
                fs.writeFileSync(notifyFile, JSON.stringify({
                    text: (row.raw_text || '').substring(0, 100),
                    channel: row.channel_id,
                    timestamp: row.slack_ts,
                    verdict, reasoning, regulation, rewrite,
                    pii: JSON.parse(row.pii_findings || '[]'),
                    level
                }));
            } catch (e) { /* non-critical */ }

            // Desktop notification for DENY/WARN
            if (verdict === 'DENY' || verdict === 'WARN') {
                const title = verdict === 'DENY' ? 'VIOLATION DETECTED' : 'COMPLIANCE WARNING';
                const body = (regulation || reasoning.substring(0, 100)).replace(/'/g, '').replace(/"/g, '').substring(0, 120);
                const { exec } = require('child_process');
                const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${body}', 'Praesidia: ${title}', 'OK', 'Warning')`;
                exec(`powershell -command "${ps}"`, () => {});
                console.log(`[Worker] ALERT: ${title} — ${regulation}`);
            }
        } catch (e) {
            console.error(`[Worker] K2 error: ${e.message}`);
            markError.run(e.message, row.id);
        }

        processing = false;
    }, WORKER_INTERVAL);
}

// ─── MAIN ───
async function main() {
    if (!fs.existsSync(TOKEN_PATH)) {
        console.log('[Monitor] No Slack token found. Connect Slack first.');
        process.exit(1);
    }

    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    console.log(`[Monitor] Connected to: ${tokens.team_name}`);

    // Init DB
    const db = initDB();
    console.log(`[Monitor] Queue DB: ${DB_PATH}`);

    // Get channels
    const chanResp = await axios.get('https://slack.com/api/conversations.list', {
        headers: { Authorization: `Bearer ${tokens.bot_token}` },
        params: { types: 'public_channel', limit: 100 }
    });
    const channels = (chanResp.data.channels || []).filter(c => c.is_member).map(c => c.id);

    // Start both
    await startPoller(db, tokens.bot_token, tokens.authed_user_id, channels);
    startWorker(db);

    console.log('[Monitor] Running. Send a Slack message (50+ chars) to test.\n');
}

main().catch(e => {
    console.error('[Monitor] Fatal:', e.message);
    process.exit(1);
});
