const { app, BrowserWindow, Menu, ipcMain, Tray, Notification, screen, utilityProcess, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const axios = require('axios');
const { dialog } = require('electron');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Force Windows to show our icon instead of the Electron default
app.setAppUserModelId('com.praesidia.engine');
const APP_ICO = path.join(__dirname, 'public', 'praesidia.ico');

// Native Service Imports
const { listPolicies } = require('./database/supabase');
const { ingestFile, ingestUrl } = require('./policy/ingestor');

// Constants for backend connectivity
const PORT = 3005;
const BASE_URL = `http://127.0.0.1:${PORT}`;
process.env.PORT = PORT; // Force child to use this port

// ─── NATIVE IPC HANDLERS (REPLACES NETWORK FETCH) ───

// 1. Dashboard Metrics
ipcMain.handle('get-dashboard-metrics', async () => {
  return {
    status: 'Active',
    score: 98,
    monitoredModels: 1402,
    activeAlerts: 3,
    complianceRate: 99.8,
    latency: 14,
    alerts: [
      { type: 'GPT-4o Protocol Audit', time: '2M AGO', desc: 'Bias mitigation verification successfully completed. Drift within limits.' },
      { type: 'Llama-3 Fine-tune Access', time: '14M AGO', desc: 'Identity verification matched biometric anchor. Access granted to Node 04.' },
      { type: 'Outlier Detection', time: '45M AGO', desc: 'Anomalous inference pattern detected in Marketing Cluster. Auto-isolation initiated.' }
    ]
  };
});

// 2. Governance Status
ipcMain.handle('get-governance-status', async () => {
  return {
    activePolicies: 12,
    pendingReviews: 4,
    recentUpdates: [
      { name: 'SOC2 Type II Compliance Refresh', status: 'Completed', date: 'Today' },
      { name: 'Data Retention Policy V3', status: 'Pending Review', date: 'Yesterday' }
    ]
  };
});

// 3. Risk Analysis
ipcMain.handle('get-risk-analysis', async () => {
  return {
    overallRisk: 'LOW',
    vulnerabilities: [
      { id: 'VULN-001', severity: 'Medium', component: 'Prompt Injection Layer', mitigated: false },
      { id: 'VULN-002', severity: 'Critical', component: 'Model Weights Endpoint', mitigated: true }
    ],
    threatActivity: 'Normal'
  };
});

// 4. Audit Logs
ipcMain.handle('get-audit-logs', async () => {
  return {
    logs: [
      { id: 'LOG-992', user: 'System', action: 'RAG Model Sycned with Supabase', timestamp: new Date().toISOString() },
      { id: 'LOG-991', user: 'Cmdr. Vane', action: 'Uploaded Sovereign Policy V4', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: 'LOG-990', user: 'Intern_14', action: 'Attempted Unsafe System Prompt', timestamp: new Date(Date.now() - 7200000).toISOString() }
    ]
  };
});

// 5. Policies List (Supabase)
ipcMain.handle('get-policies-list', async () => {
    try {
        const policies = await listPolicies();
        return { policies };
    } catch (err) {
        return { error: err.message };
    }
});

// 6. Native File Ingestion
ipcMain.handle('select-and-ingest-policy', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Policies', extensions: ['pdf', 'docx', 'md', 'txt'] }]
    });

    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    
    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    
    try {
        const ingestResult = await ingestFile(filePath, fileName);
        return { success: true, policy: ingestResult.rules };
    } catch (err) {
        return { error: err.message };
    }
});

// 7. URL Ingestion
ipcMain.handle('ingest-policy-url', async (event, url) => {
    try {
        const ingestResult = await ingestUrl(url);
        return { success: true, policy: ingestResult.rules };
    } catch (err) {
        return { error: err.message };
    }
});


// 8. Authentication (Mock)
ipcMain.handle('auth-login', async (event, { username, password }) => {
    if (username === 'intern_seeron' && password) {
        return { success: true, token: 'mock-jwt-token-123', user: { name: 'Seeron', role: 'intern' } };
    } else if (username && password) {
        return { success: true, token: 'mock-jwt-token-123', user: { name: 'Cmdr. Vane', role: 'senior_dev' } };
    }
    return { error: 'Invalid credentials' };
});


// 8.1 Simulate Breach
ipcMain.handle('simulate-breach', async (event, userId) => {
    try {
        const response = await axios.post(`http://127.0.0.1:${PORT}/api/github/intercept`, {
            userId: userId || 'intern_seeron',
            action: "git push origin main --force # Including AWS_SECRET_KEY=AKIA1234567890EXAMPLE"
        }, { timeout: 10000 });
        return { success: true, data: response.data };
    } catch (err) {
        return { error: err.message };
    }
});

// 8.2 Omni-Search (Gemini via REST)
ipcMain.handle('search-audit-logs', async (event, query) => {
    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in .env");

        const auditData = `
        LOG-001: Cmdr. Vane uploaded Sovereign Policy V4 (Secure)
        LOG-002: Intern_14 attempted Unsafe System Prompt injection (Blocked)
        LOG-003: System RAG Model synced with Supabase Vector Store
        LOG-004: intern_seeron attempted to push AWS keys to GitHub (Blocked)
        LOG-005: senior_dev approved NeMo-Claw Remediation for Slack leak (Resolved)
        `;

        const prompt = `You are the Praesidia Sentinel AI.
Audit Log Context:
${auditData}

User Query: "${query}"

Task: Find the most relevant log entries from the context that match the user query. If none match, say "No relevant incidents found." Be concise. Return only the matching log lines.`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No results returned.';
        return { success: true, result: text };
    } catch (err) {
        const detail = err.response?.data?.error?.message || err.message;
        return { error: detail };
    }
});

// ─── SLACK LIVE MONITORING ───
let slackMonitorInterval = null;
let slackLastTs = null;
let slackMsgCount = 0;

// 9. Slack Connect - use tokens from .env directly (no OAuth needed)
ipcMain.handle('slack-connect', async () => {
    const botToken = process.env.SLACK_BOT_TOKEN;
    console.log('[Slack Connect] Token from .env:', botToken ? botToken.substring(0, 20) + '...' : 'NOT FOUND');

    if (!botToken) {
        return { error: 'SLACK_BOT_TOKEN not found in .env' };
    }

    try {
        // Verify the token works by calling auth.test
        console.log('[Slack Connect] Calling auth.test...');
        const resp = await axios.get('https://slack.com/api/auth.test', {
            headers: { Authorization: `Bearer ${botToken}` }
        });

        console.log('[Slack Connect] auth.test response:', JSON.stringify(resp.data));

        if (!resp.data.ok) {
            console.error('[Slack Connect] auth.test failed:', resp.data.error);
            return { error: `Slack API error: ${resp.data.error}` };
        }

        // Save tokens locally for the monitor to use
        const os = require('os');
        const tokenPath = path.join(os.homedir(), '.praesidia', 'slack_tokens.json');
        fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
        fs.writeFileSync(tokenPath, JSON.stringify({
            bot_token: botToken,
            team_name: resp.data.team,
            team_id: resp.data.team_id,
            authed_user_id: resp.data.user_id
        }, null, 2));

        console.log('[Slack Connect] ✅ Saved tokens. Team:', resp.data.team);
        return { success: true, team_name: resp.data.team, team_id: resp.data.team_id };
    } catch (e) {
        console.error('[Slack Connect] Exception:', e.message);
        return { error: 'Could not reach Slack API: ' + e.message };
    }
});

// 10. Slack Get Channels - returns ALL public channels for the picker (no bot invite needed)
ipcMain.handle('slack-get-channels', async () => {
    const tokenPath = path.join(require('os').homedir(), '.praesidia', 'slack_tokens.json');
    if (!fs.existsSync(tokenPath)) return { error: 'Not connected' };
    const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    try {
        const resp = await axios.get('https://slack.com/api/conversations.list', {
            headers: { Authorization: `Bearer ${tokens.bot_token}` },
            params: { types: 'public_channel', limit: 200, exclude_archived: true }
        });
        console.log('[Slack Channels] API ok:', resp.data.ok, 'error:', resp.data.error);
        if (!resp.data.ok) return { error: resp.data.error };
        const channels = (resp.data.channels || []).map(c => ({ id: c.id, name: c.name, member_count: c.num_members }));
        console.log(`[Slack Channels] Found ${channels.length} public channels`);
        return { channels };
    } catch (e) {
        return { error: e.message };
    }
});

// 11. Slack Status - check if connected
ipcMain.handle('slack-status', async () => {
    const tokenPath = path.join(require('os').homedir(), '.praesidia', 'slack_tokens.json');
    if (fs.existsSync(tokenPath)) {
        const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        return { connected: true, team_name: data.team_name, team_id: data.team_id, monitoring: !!slackMonitorInterval };
    }
    return { connected: false };
});

// 12. Slack Start Monitor — accepts user-selected channel IDs, no bot invite needed
ipcMain.handle('slack-start-monitor', async (event, selectedChannelIds) => {
    const tokenPath = path.join(require('os').homedir(), '.praesidia', 'slack_tokens.json');
    if (!fs.existsSync(tokenPath)) return { error: 'Not connected' };

    const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const userToken = tokens.bot_token;
    const userId = tokens.authed_user_id;

    if (slackMonitorInterval) return { status: 'already_running' };

    slackLastTs = String((Date.now() - 5 * 60 * 1000) / 1000);
    slackMsgCount = 0;

    // Automatically fetch all public channels
    try {
        const resp = await axios.get('https://slack.com/api/conversations.list', {
            headers: { Authorization: `Bearer ${userToken}` },
            params: { types: 'public_channel', limit: 100, exclude_archived: true }
        });
        
        // If it's a bot token, it can only see channels it's in or public ones.
        // We'll watch all public channels it can see.
        channels = (resp.data.channels || []).map(c => c.id);
        
        console.log(`[Slack Monitor] Auto-discovered ${channels.length} channels to monitor.`);
    } catch (e) {
        console.error('[Slack Monitor] Failed to auto-discover channels:', e.message);
        // If discovery fails but we had some IDs (unlikely here), we could proceed, 
        // but here we'll error out to be safe.
        return { error: 'Failed to list channels: ' + e.message };
    }

    if (channels.length === 0) {
        console.warn('[Slack Monitor] ⚠️  No channels found. Note: Bots must be invited to private channels.');
    }

    console.log(`[Slack Monitor] Starting poll for ${channels.length} channels...`);

    // Poll every 3 seconds for new messages across channels
    slackMonitorInterval = setInterval(async () => {
        for (const channelId of channels) {
            try {
                const resp = await axios.get('https://slack.com/api/conversations.history', {
                    headers: { Authorization: `Bearer ${userToken}` },
                    params: { channel: channelId, oldest: slackLastTs, limit: 10 }
                });

                const messages = (resp.data.messages || []).filter(m =>
                    m.user === userId && !m.subtype && (m.text || '').length >= 50
                );

                for (const msg of messages) {
                    slackMsgCount++;
                    slackLastTs = msg.ts;

                    // Run through pipeline: Presidio → K2
                    let scrubResult = { scrubbed_text: msg.text, pii_findings: [] };
                    try {
                        const scrubResp = await axios.post('http://localhost:5001/scan', {
                            content: msg.text, source: 'slack', author: userId
                        });
                        scrubResult.scrubbed_text = scrubResp.data.scrubbed_content || msg.text;
                        scrubResult.pii_findings = scrubResp.data.pii_findings || [];
                    } catch (e) { /* Presidio not running, use raw */ }

                    // K2 analysis
                    let k2Result = {};
                    try {
                        const k2Resp = await axios.post(`http://127.0.0.1:${PORT}/api/slack/intercept`, {
                            action: scrubResult.scrubbed_text, userId: userId
                        }, { timeout: 45000 });
                        k2Result = k2Resp.data;
                        console.log(`[Slack Monitor] K2 verdict: ${k2Result.verdict}`)
                    } catch (e) {
                        k2Result = { verdict: 'ERROR', reasoning: 'K2 unreachable' };
                    }

                    // Send to renderer
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('slack-message-analyzed', {
                            text: msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : ''),
                            channel: channelId,
                            timestamp: msg.ts,
                            verdict: k2Result.verdict || 'UNKNOWN',
                            reasoning: k2Result.thought_process || k2Result.reasoning || '',
                            regulation: k2Result.cited_regulation || '',
                            rewrite: k2Result.suggested_rewrite || '',
                            pii: scrubResult.pii_findings,
                            msgCount: slackMsgCount
                        });
                    }

                    // Desktop notification for DENY/WARN
                    if (k2Result.verdict === 'DENY' || k2Result.verdict === 'WARN') {
                        new Notification({
                            title: `Praesidia: ${k2Result.verdict === 'DENY' ? 'Violation' : 'Warning'} Detected`,
                            body: k2Result.thought_process || k2Result.reasoning || 'Your Slack message was flagged.',
                            icon: path.join(__dirname, 'public', 'logo-256.png')
                        }).show();
                    }
                }
            } catch (e) { console.error(`[Slack Monitor] Channel ${channelId} error:`, e.message); }
        }
    }, 3000);

    return { status: 'started', channels: channels.length };
});

// 12. Slack Stop Monitor
ipcMain.handle('slack-stop-monitor', async () => {
    if (slackMonitorInterval) {
        clearInterval(slackMonitorInterval);
        slackMonitorInterval = null;
    }
    return { status: 'stopped' };
});

// 13. Slack Disconnect
ipcMain.handle('slack-disconnect', async () => {
    if (slackMonitorInterval) {
        clearInterval(slackMonitorInterval);
        slackMonitorInterval = null;
    }
    const tokenPath = path.join(require('os').homedir(), '.praesidia', 'slack_tokens.json');
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    return { status: 'disconnected' };
});

// Legacy proxy handler (to be phased out, but kept for non-migrated routes)
ipcMain.handle('fetch-data', async (event, endpoint, options = {}) => {
  try {
    let requestData;
    let headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (options.isFileUpload && options.filePath) {
      const fs = require('fs');
      const blob = new Blob([fs.readFileSync(options.filePath)]);
      const form = new FormData();
      form.append('policy', blob, options.fileName || 'upload.bin');
      requestData = form;
      delete headers['Content-Type'];
    } else {
      requestData = options.body ? JSON.parse(options.body) : undefined;
    }

    const res = await axios({
      url: `${BASE_URL}${endpoint}`,
      method: options.method || 'GET',
      data: requestData,
      headers: headers
    });
    return { ok: true, data: res.data };
  } catch (err) {
    console.error('[IPC Fetch Error]', err.message);
    return { ok: false, error: err.response?.data || err.message };
  }
});

let backendProcess;

// Optional agent modules
let startHumeAudioMonitor;
try {
  startHumeAudioMonitor = require('./desktop-agent/hume-monitor').startHumeAudioMonitor;
} catch (e) {
  console.warn('⚠️ Hume Monitor not found or failed to load.');
}

let injectGitHooksGlobally;
try {
  injectGitHooksGlobally = require('./scripts/guard').injectGitHooksGlobally;
} catch (e) {
  console.warn('⚠️ Git Guard script not found or failed to load.');
}

let mainWindow;
let tavusWindow;
let seniorWindow;
let highlightWindow;
let tray;
let lastViolationMeta = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: APP_ICO,
    backgroundColor: '#14151B',
    title: 'Praesidia Dashboard',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'desktop-agent', 'preload.js')
    }
  });

  // Load the dashboard HTML directly from disk (works in packaged Electron without a running HTTP server)
  mainWindow.loadFile(path.join(__dirname, 'public', 'dashboard.html'));
  Menu.setApplicationMenu(null);
  mainWindow.maximize();

  // Show dev tools on load failure for diagnostics
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    console.error('[Electron] Page failed to load:', errorCode, errorDesc);
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function createTavusWindow(videoUrl) {
  if (tavusWindow && !tavusWindow.isDestroyed()) tavusWindow.close();

  tavusWindow = new BrowserWindow({
    width: 800,
    height: 600,
    alwaysOnTop: true,
    frame: false,
    kiosk: true,
    closable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  tavusWindow.loadFile(path.join(__dirname, 'desktop-agent', 'tavus-playback.html'));
  tavusWindow.webContents.on('did-finish-load', () => {
    tavusWindow.webContents.send('play-tavus-video', { videoUrl });
  });
}

function launchHighlightOverlay(data) {
    const { file, line, summary } = data;
    if (highlightWindow && !highlightWindow.isDestroyed()) highlightWindow.close();

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    highlightWindow = new BrowserWindow({
        width: 600,
        height: 120,
        x: width - 620,
        y: height - 150,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        skipTaskbar: true,
        focusable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    highlightWindow.loadFile(path.join(__dirname, 'desktop-agent', 'highlight-overlay.html'));
    highlightWindow.setIgnoreMouseEvents(true);

    highlightWindow.webContents.on('did-finish-load', () => {
        highlightWindow.webContents.send('show-highlight', { file, line, summary });
    });

    setTimeout(() => {
        if (highlightWindow && !highlightWindow.isDestroyed()) highlightWindow.close();
    }, 15000);
}

function triggerSeniorRemediation() {
    if (!lastViolationMeta) {
        new Notification({ title: 'Praesidia', body: 'No current violation recorded.' }).show();
        return;
    }

    if (seniorWindow && !seniorWindow.isDestroyed()) seniorWindow.close();

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    seniorWindow = new BrowserWindow({
        width: 950,
        height: 650,
        x: Math.round((width - 950) / 2),
        y: Math.round((height - 650) / 2),
        alwaysOnTop: true,
        frame: true,
        title: 'Praesidia — Senior Remediation',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    seniorWindow.loadFile(path.join(__dirname, 'desktop-agent', 'senior-remediation.html'));
    seniorWindow.webContents.on('did-finish-load', () => {
        seniorWindow.webContents.send('violation-meta', lastViolationMeta);
    });

    // Call remediation execution backend
    const axios = require('axios');
    axios.post('http://localhost:3005/api/nemo-claw/execute', { remediationMeta: lastViolationMeta })
         .catch(err => console.error('NeMo-Claw error:', err.message));
}

// ─── Single Instance & Lifecycle ───
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // 1. Initialize Tray
    tray = new Tray(path.join(__dirname, 'public', 'tray-icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Praesidia Engine Running', enabled: false },
        { type: 'separator' },
        { label: 'Open Control Center', click: () => { if (!mainWindow) createWindow(); else mainWindow.focus(); } },
        { label: 'Senior: Review Violation', click: () => triggerSeniorRemediation() },
        { type: 'separator' },
        { label: 'Quit Engine', click: () => app.quit() }
    ]);
    tray.setToolTip('Praesidia Sovereign Engine');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => { if (!mainWindow) createWindow(); else mainWindow.focus(); });

    // 2. Initialize Background Guards
    if (injectGitHooksGlobally) injectGitHooksGlobally();
    
    // 3. Start Hume EVI Monitor (if available)
    if (startHumeAudioMonitor) {
        startHumeAudioMonitor((voiceViolation) => {
            new Notification({ title: 'Praesidia [Voice Violation]', body: voiceViolation.reason }).show();
            const transcript = (voiceViolation.transcript || '').toLowerCase();
            if (['show me the problem', 'remediate'].some(t => transcript.includes(t))) {
                triggerSeniorRemediation();
            }
        });
    }

    // 4. Start UI and Backend Background Utility Process
    console.log(`[Main] Spawning backend engine on port ${PORT}...`);
    backendProcess = utilityProcess.fork(path.join(__dirname, 'index.js'), [], {
        env: process.env,
        stdio: 'pipe'
    });

    // Pipe backend logs to main process terminal for visibility
    backendProcess.stdout.on('data', (data) => console.log(`[Backend-STDOUT]: ${data}`));
    backendProcess.stderr.on('data', (data) => console.error(`[Backend-STDERR]: ${data}`));

    setTimeout(createWindow, 2000);

    // Slack monitor is started by the user via the channel picker in the UI — no auto-start

    backendProcess.on('message', (msg) => {
        if (!msg || !msg.type) return;
        
        if (msg.type === 'governance_alert') {
            const alert = msg.data;
            const { verdict, reasoning, surface, tavusUrl, level, remediationMeta } = alert;
            lastViolationMeta = remediationMeta || lastViolationMeta;

            const notification = new Notification({
                title: `Praesidia [${verdict}]: Level ${level || 5} Breach on ${(surface||'System').toUpperCase()}`,
                body: reasoning || 'Unknown breach detected',
                icon: path.join(__dirname, 'public', 'logo-256.png')
            });
            notification.show();

            // Porting logic: Relay the breach to the dashboard UI
            if (mainWindow && !mainWindow.isDestroyed()) {
                console.log('📡 [IPC Relay] Forwarding breach alert to Dashboard UI');
                mainWindow.webContents.send('governance-breach', alert);
            }

            if (verdict === 'DENY' || (level && level >= 4)) {
                if (tavusUrl) createTavusWindow(tavusUrl);
            }
        } else if (msg.type === 'trigger_tavus_advisor') {
            if (msg.data.url) createTavusWindow(msg.data.url);
        } else if (msg.type === 'highlight_violation') {
            launchHighlightOverlay(msg.data);
        } else if (msg.type === 'senior_override') {
            triggerSeniorRemediation();
        }
    });

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

// IPC Handlers
ipcMain.on('video-ended', () => {
    if (tavusWindow && !tavusWindow.isDestroyed()) {
        tavusWindow.setKiosk(false);
        tavusWindow.setClosable(true);
        tavusWindow.destroy();
    }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
