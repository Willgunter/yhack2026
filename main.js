const { app, BrowserWindow, Menu, ipcMain, Tray, Notification, screen, utilityProcess, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const axios = require('axios');
const { dialog } = require('electron');

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
    status:  'Active',
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
      { name: 'SOC2 Type II Compliance Refresh',  status: 'Completed', date: 'Today' },
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


// 8. Authentication — Role-Based (Intern vs Senior)
let currentUserRole = 'intern'; // default role

const USER_ACCOUNTS = {
    'intern':  { name: 'Intern', role: 'intern', displayRole: 'Intern — Restricted', password: 'intern2026' },
    'senior':  { name: 'Sr. Developer', role: 'senior', displayRole: 'Senior Dev — Override Access', password: 'senior2026' },
    'admin':   { name: 'Cmdr. Vane', role: 'senior', displayRole: 'Compliance Lead — Full Access', password: 'praesidia2026' },
};

ipcMain.handle('auth-login', async (event, { username, password }) => {
    const account = USER_ACCOUNTS[username.toLowerCase()];
    if (account && account.password === password) {
        currentUserRole = account.role;
        console.log(`[Auth] Login: ${account.name} (${account.role})`);
        return { success: true, token: 'mock-jwt-token-123', user: { name: account.name, role: account.displayRole, rbacRole: account.role } };
    }
    return { error: 'Invalid credentials' };
});

// Get current user role (for dashboard to query)
ipcMain.handle('get-user-role', async () => {
    return { role: currentUserRole };
});

// Senior remediation trigger from dashboard
ipcMain.handle('trigger-senior-remediation', async () => {
    if (currentUserRole !== 'senior') {
        return { error: 'Insufficient permissions — Senior access required' };
    }
    triggerSeniorRemediation();
    return { success: true };
});


// ─── SLACK OAUTH & LIVE MONITORING ───
const SLACK_OAUTH_BASE = 'https://praesidia.dev/api/slack';
let slackMonitorInterval = null;
let slackMonitorProcess = null; // track the spawned slack-monitor.js process
let slackLastTs = null;
let slackMsgCount = 0;

// Helper: get praesidia token path using Electron's app.getPath (more reliable on Windows)
function getPraesidiaPath(...parts) {
    return path.join(app.getPath('home'), '.praesidia', ...parts);
}

// 9. Slack Connect - opens browser for OAuth
ipcMain.handle('slack-connect', async () => {
    const sessionId = require('crypto').randomUUID();
    const url = `${SLACK_OAUTH_BASE}/install?session=${sessionId}`;
    require('electron').shell.openExternal(url);

    // Poll for token completion
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds

    return new Promise((resolve) => {
        const poll = setInterval(async () => {
            attempts++;
            try {
                const resp = await axios.get(`${SLACK_OAUTH_BASE}/status?session=${sessionId}`);
                if (resp.data.status === 'connected') {
                    clearInterval(poll);
                    const tokenPath = getPraesidiaPath('slack_tokens.json');
                    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
                    fs.writeFileSync(tokenPath, JSON.stringify(resp.data, null, 2));
                    resolve({ success: true, team_name: resp.data.team_name, team_id: resp.data.team_id });
                }
            } catch (e) { /* still waiting */ }

            if (attempts >= maxAttempts) {
                clearInterval(poll);
                resolve({ error: 'OAuth timed out after 2 minutes' });
            }
        }, 1000);
    });
});

// 10. Slack Status - check if connected
ipcMain.handle('slack-status', async () => {
    const tokenPath = getPraesidiaPath('slack_tokens.json');
    if (fs.existsSync(tokenPath)) {
        const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        const isRunning = !!(slackMonitorInterval || (slackMonitorProcess && !slackMonitorProcess.killed));
        return { connected: true, team_name: data.team_name, team_id: data.team_id, monitoring: isRunning };
    }
    return { connected: false };
});

// 11. Slack Start Monitor — delegates to slack-monitor.js (queue-based, 10s polling, rate-limit safe)
ipcMain.handle('slack-start-monitor', async () => {
    const tokenPath = getPraesidiaPath('slack_tokens.json');
    if (!fs.existsSync(tokenPath)) return { error: 'Not connected' };

    // Don't start twice
    if (slackMonitorProcess && !slackMonitorProcess.killed) {
        return { status: 'already_running' };
    }
    if (slackMonitorInterval) return { status: 'already_running' };

    console.log('[Slack] Starting queue-based monitor (slack-monitor.js)...');
    const { spawn } = require('child_process');
    slackMonitorProcess = spawn('node', [path.join(__dirname, 'slack-monitor.js')], {
        cwd: __dirname,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    slackMonitorProcess.stdout.on('data', (d) => console.log(`[SlackMon] ${d.toString().trim()}`));
    slackMonitorProcess.stderr.on('data', (d) => console.error(`[SlackMon-ERR] ${d.toString().trim()}`));
    slackMonitorProcess.on('exit', (code) => {
        console.log('[Slack] Monitor process exited:', code);
        slackMonitorProcess = null;
    });
    slackMonitorProcess.on('error', (e) => console.error('[Slack] Monitor spawn error:', e.message));

    // Mark as "running" for status checks
    slackMonitorInterval = true;

    return { status: 'started' };
});

// 12. Slack Stop Monitor
ipcMain.handle('slack-stop-monitor', async () => {
    if (slackMonitorProcess && !slackMonitorProcess.killed) {
        slackMonitorProcess.kill();
        slackMonitorProcess = null;
    }
    slackMonitorInterval = null;
    return { status: 'stopped' };
});

// 13. Slack Disconnect — stops monitor but keeps token so reconnect is instant
ipcMain.handle('slack-disconnect', async () => {
    if (slackMonitorProcess && !slackMonitorProcess.killed) {
        slackMonitorProcess.kill();
        slackMonitorProcess = null;
    }
    slackMonitorInterval = null;
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

// ─── Tavus Streaming Replica (Intern Lockdown without pre-made URL) ───
function launchTavusStreamingReplica(reasoning) {
    const axios = require('axios');
    const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
    const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID || 'r291e545fd67';
    const TAVUS_PERSONA_ID = process.env.TAVUS_PERSONA_ID || 'pf4480a02236';

    if (!TAVUS_API_KEY) {
        console.warn('[Tavus] No API key — showing lockdown notification only');
        new Notification({ title: 'PRAESIDIA LOCKDOWN', body: reasoning || 'Critical violation detected. Contact your supervisor.' }).show();
        return;
    }

    axios.post('https://tavusapi.com/v2/videos', {
        replica_id: TAVUS_REPLICA_ID,
        persona_id: TAVUS_PERSONA_ID,
        script: `Intern, a serious compliance breach has been detected. ${reasoning}. This session is now locked pending review.`,
        properties: { fast: true, max_seconds: 20 }
    }, {
        headers: { 'x-api-key': TAVUS_API_KEY, 'Content-Type': 'application/json' }
    })
    .then(res => {
        if (res.data?.hosted_url) createTavusWindow(res.data.hosted_url);
    })
    .catch(err => console.error('[Tavus] Streaming replica error:', err.message));
}

// ─── Omni-Search: Semantic Audit Log Search via Deepseek ───
ipcMain.handle('omni-search', async (event, query) => {
    const axios = require('axios');
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

    if (!DEEPSEEK_KEY || !query || query.length < 3) {
        return { results: [], summary: '' };
    }

    try {
        // Gather recent audit context
        const logs = [];

        // Pull from Supabase violations
        const { getRecentViolations } = require('./database/supabase');
        let dbLogs = [];
        try { dbLogs = await getRecentViolations(50); } catch (e) { /* no violations table yet */ }

        // Add mock logs as fallback context
        const contextLogs = dbLogs.length > 0 ? dbLogs.map(l => ({
            id: l.id, user: l.user_id, surface: l.surface, action: l.action_type,
            verdict: l.verdict, severity: l.severity, reasoning: l.reasoning,
            timestamp: l.created_at
        })) : [
            { id: 'LOG-992', user: 'System', action: 'RAG Model Synced with Supabase', timestamp: new Date().toISOString(), verdict: 'ALLOW', surface: 'system' },
            { id: 'LOG-991', user: 'Cmdr. Vane', action: 'Uploaded Sovereign Policy V4', timestamp: new Date(Date.now() - 3600000).toISOString(), verdict: 'ALLOW', surface: 'policy' },
            { id: 'LOG-990', user: 'Intern_14', action: 'Attempted Unsafe System Prompt', timestamp: new Date(Date.now() - 7200000).toISOString(), verdict: 'DENY', surface: 'cline' },
        ];

        // Also pull Slack analysis results if available
        const notifyDir = getPraesidiaPath('notifications');
        try {
            const processed = path.join(notifyDir, '..', 'slack_processed');
            if (fs.existsSync(processed)) {
                const recent = fs.readdirSync(processed).filter(f => f.endsWith('.json')).slice(-20);
                for (const f of recent) {
                    try {
                        const d = JSON.parse(fs.readFileSync(path.join(processed, f), 'utf8'));
                        contextLogs.push({ user: d.user_id || 'slack-user', action: d.raw_text?.substring(0, 100), verdict: d.verdict, surface: 'slack', reasoning: d.reasoning, timestamp: d.created_at });
                    } catch (e) {}
                }
            }
        } catch (e) {}

        const resp = await axios.post('https://api.deepseek.com/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: `You are Praesidia's Omni-Search engine. Given a user query and a list of audit logs, return the most relevant results. Respond with JSON only:
{
  "summary": "One-sentence summary of findings",
  "results": [
    { "id": "...", "user": "...", "action": "...", "verdict": "...", "surface": "...", "reasoning": "...", "timestamp": "...", "relevance": "high|medium|low" }
  ]
}
Return max 5 results, ordered by relevance. If no matches, return empty results with a helpful summary.`
                },
                {
                    role: 'user',
                    content: `Query: "${query}"\n\nAudit Logs:\n${JSON.stringify(contextLogs, null, 2)}`
                }
            ],
            temperature: 0.2,
            max_tokens: 1000
        }, {
            headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' }
        });

        const content = resp.data?.choices?.[0]?.message?.content || '{}';
        // Parse JSON from response (handle markdown code blocks)
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        return parsed;
    } catch (err) {
        console.error('[Omni-Search] Error:', err.message);
        return { results: [], summary: 'Search error: ' + err.message };
    }
});

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

    // Always-on: poll notification files from slack-monitor.js → push to renderer dashboard (no token required)
    const notifyDir = getPraesidiaPath('notifications');
    fs.mkdirSync(notifyDir, { recursive: true });
    setInterval(() => {
        try {
            const files = fs.readdirSync(notifyDir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                const filePath = path.join(notifyDir, file);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    fs.unlinkSync(filePath);
                    slackMsgCount++;
                    console.log(`[Slack] Dashboard update: ${data.verdict} | ${data.regulation || ''}`);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('slack-message-analyzed', { ...data, msgCount: slackMsgCount });
                    }
                } catch (e) { /* malformed or already deleted */ }
            }
        } catch (e) { /* dir not ready */ }
    }, 1000);
    console.log('[Slack] Notification file poller running (1s interval)');

    // Auto-start Slack monitor if token exists (returning user)
    setTimeout(() => {
        const tokenPath = getPraesidiaPath('slack_tokens.json');
        console.log('[Slack] Checking for token at:', tokenPath);
        if (fs.existsSync(tokenPath)) {
            if (slackMonitorProcess && !slackMonitorProcess.killed) {
                console.log('[Slack] Monitor already running (started by dashboard), skipping auto-start spawn.');
            } else {
                console.log('[Slack] Token found, launching monitor process...');
                const { spawn } = require('child_process');
                slackMonitorProcess = spawn('node', [path.join(__dirname, 'slack-monitor.js')], {
                    cwd: __dirname, env: process.env, stdio: ['ignore', 'pipe', 'pipe']
                });
                slackMonitorProcess.stdout.on('data', (d) => console.log(`[SlackMon] ${d.toString().trim()}`));
                slackMonitorProcess.stderr.on('data', (d) => console.error(`[SlackMon-ERR] ${d.toString().trim()}`));
                slackMonitorProcess.on('error', (e) => console.error('[Slack] Monitor spawn error:', e.message));
                slackMonitorProcess.on('exit', (code) => { console.log('[Slack] Monitor exited:', code); slackMonitorProcess = null; });
                slackMonitorInterval = true;
            }
        } else {
            console.log('[Slack] No token found, skipping auto-start');
        }
    }, 5000);

    backendProcess.on('message', (msg) => {
        if (!msg || !msg.type) return;
        
        if (msg.type === 'governance_alert') {
            const alert = msg.data;
            const { verdict, reasoning, surface, tavusUrl, level, remediationMeta } = alert;
            lastViolationMeta = remediationMeta || lastViolationMeta;

            new Notification({
                title: `Praesidia [${verdict}]: Level ${level || 5} Breach on ${(surface||'System').toUpperCase()}`,
                body: reasoning || 'Unknown breach detected',
                icon: path.join(__dirname, 'public', 'logo-256.png')
            }).show();

            // ─── RBAC: Role-based response to violations ───
            if (verdict === 'DENY' || (level && level >= 4)) {
                if (currentUserRole === 'intern') {
                    // INTERN: Kiosk lockdown with Tavus video
                    console.log('[RBAC] Intern lockdown triggered');
                    if (tavusUrl) {
                        createTavusWindow(tavusUrl);
                    } else {
                        // Generate Tavus streaming replica if no pre-made URL
                        launchTavusStreamingReplica(reasoning);
                    }
                    // Notify dashboard of lockdown state
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('intern-lockdown', { level, reasoning, surface });
                    }
                } else {
                    // SENIOR: Show remediation option instead of lockdown
                    console.log('[RBAC] Senior override available');
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('senior-violation-alert', {
                            level, reasoning, surface, remediationMeta,
                            verdict, tavusUrl
                        });
                    }
                }
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
