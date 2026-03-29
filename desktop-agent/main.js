const { app, Tray, Menu, Notification, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const io = require('socket.io-client');
const { startHumeAudioMonitor } = require('./hume-monitor');
const { injectGitHooksGlobally } = require('../scripts/guard');

let tray = null;
let mainWindow = null;         // Intern lockdown window
let seniorWindow = null;       // Senior remediation overlay
let highlightWindow = null;    // Violation highlight overlay

// ─── Senior Override State ───
let lastViolationMeta = null;  // Cached for "Show me the problem"

app.whenReady().then(() => {
    // 1. Initialize Auto-Guard
    console.log('🛡️ Initializing Praesidia Auto-Guard...');
    injectGitHooksGlobally();

    // 2. Setup System Tray
    tray = new Tray(path.join(__dirname, '..', 'extension', 'icons', 'icon16.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Praesidia Active', enabled: false },
        { type: 'separator' },
        { label: 'Senior: Show Last Violation', click: () => triggerSeniorRemediation() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setToolTip('Praesidia Sovereign Desktop Agent');
    tray.setContextMenu(contextMenu);

    // 3. Connect to Local Backend for K2-Think Alerts
    const socket = io('http://localhost:3005');

    socket.on('governance_alert', (alert) => {
        const { verdict, reasoning, surface, tavusUrl, level, remediationMeta } = alert;

        // Cache violation metadata for Senior Override
        if (remediationMeta) {
            lastViolationMeta = remediationMeta;
        }

        // Native OS Notification
        new Notification({
            title: `Praesidia [${verdict}]: Level ${level} Breach on ${surface.toUpperCase()}`,
            body: reasoning,
            icon: path.join(__dirname, '..', 'extension', 'icons', 'icon128.png')
        }).show();

        // Intern Lockdown
        if (verdict === 'DENY' || level >= 4) {
            if (tavusUrl) {
                launchTavusVideoLock(tavusUrl);
            } else {
                launchTavusStreamingReplica(reasoning);
            }
        }
    });

    // 4. Senior Override WebSocket listener
    // Triggered when a Senior Developer says "Show me the problem" (via Hume or typing)
    socket.on('senior_override', (data) => {
        console.log('👔 Senior Override received:', data);
        lastViolationMeta = data.remediationMeta || lastViolationMeta;
        triggerSeniorRemediation();
    });

    // 5. Highlight overlay trigger from backend
    socket.on('highlight_violation', (data) => {
        launchHighlightOverlay(data);
    });

    // 6. Start Hume EVI Emotional Audio Monitor
    startHumeAudioMonitor((voiceViolation) => {
        new Notification({
            title: `Praesidia [VOICE BLOCKED]`,
            body: `Voice Violation: ${voiceViolation.reason}`,
            icon: path.join(__dirname, '..', 'extension', 'icons', 'icon128.png')
        }).show();

        // Check if it's a Senior asking to see the problem
        const transcript = (voiceViolation.transcript || '').toLowerCase();
        const seniorTriggers = ['show me the problem', 'show me the violation', 'what happened', 'show the diff', 'open the issue'];
        if (seniorTriggers.some(t => transcript.includes(t))) {
            console.log('[SeniorMode] Hume detected Senior trigger phrase:', transcript);
            triggerSeniorRemediation();
            return;
        }

        launchTavusStreamingReplica(`A verbal security leak was detected. Emotional interceptor caught: ${voiceViolation.transcript}`);
    });
});


// ─────────────────────────────────────────
// Senior Override — Remediation Mode
// ─────────────────────────────────────────

/**
 * Triggered when Senior Developer says "Show me the problem."
 * Opens a remediation panel and calls NeMo-Claw via backend.
 */
function triggerSeniorRemediation() {
    if (!lastViolationMeta) {
        console.log('[SeniorMode] No cached violation metadata — nothing to show.');
        new Notification({ title: 'Praesidia', body: 'No violation on record.' }).show();
        return;
    }

    console.log('👔 Launching Senior Remediation Dashboard...');

    // Close any existing window
    if (seniorWindow && !seniorWindow.isDestroyed()) seniorWindow.close();

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    seniorWindow = new BrowserWindow({
        width: 900,
        height: 600,
        x: Math.round((width - 900) / 2),
        y: Math.round((height - 600) / 2),
        alwaysOnTop: true,
        frame: true,
        closable: true,
        title: 'Praesidia — Senior Remediation',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    seniorWindow.loadFile(path.join(__dirname, 'senior-remediation.html'));

    seniorWindow.webContents.on('did-finish-load', () => {
        seniorWindow.webContents.send('violation-meta', lastViolationMeta);
    });

    // 5. Tell backend to execute NeMo-Claw system actions via fetch
    fetch('http://localhost:3005/api/nemo-claw/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remediationMeta: lastViolationMeta })
    }).catch(err => console.error('[SeniorMode] NeMo-Claw trigger failed:', err.message));
}


// ─────────────────────────────────────────
// Intern Lockdown — Tavus Video
// ─────────────────────────────────────────

function launchTavusStreamingReplica(reasoningTrace) {
    console.log("Fallback Tavus stream trigger:", reasoningTrace);
}

function launchTavusVideoLock(videoUrl) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();

    mainWindow = new BrowserWindow({
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

    mainWindow.loadFile(path.join(__dirname, 'tavus-playback.html'));
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('play-tavus-video', { videoUrl });
    });
}

// Unlock after video ends
ipcMain.on('video-ended', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setKiosk(false);
        mainWindow.setClosable(true);
        mainWindow.destroy();
    }
    // Clear cached violation after Intern has been confronted
    lastViolationMeta = null;
});


// ─────────────────────────────────────────
// Highlight Overlay — Teal Breathing Glow
// ─────────────────────────────────────────

/**
 * Draw a transparent always-on-top window with a teal breathing glow
 * over the approximate area of the code editor / terminal.
 */
function launchHighlightOverlay(data) {
    const { file, line, summary } = data;

    if (highlightWindow && !highlightWindow.isDestroyed()) {
        highlightWindow.close();
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // Position the overlay in the bottom-right (where VS Code usually lives)
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

    highlightWindow.loadFile(path.join(__dirname, 'highlight-overlay.html'));
    highlightWindow.setIgnoreMouseEvents(true); // Passthrough — doesn't block coding

    highlightWindow.webContents.on('did-finish-load', () => {
        highlightWindow.webContents.send('show-highlight', { file, line, summary });
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
        if (highlightWindow && !highlightWindow.isDestroyed()) {
            highlightWindow.close();
        }
    }, 15000);
}
