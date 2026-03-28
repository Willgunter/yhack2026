const { app, Tray, Menu, Notification, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const io = require('socket.io-client');
const { startHumeAudioMonitor } = require('./hume-monitor');
const { injectGitHooksGlobally } = require('../scripts/guard');

let tray = null;
let mainWindow = null;

app.whenReady().then(() => {
    // 1. Initialize Auto-Guard
    console.log('🛡️ Initializing Praesidia Auto-Guard...');
    injectGitHooksGlobally();

    // 2. Setup System Tray
    tray = new Tray(path.join(__dirname, '..', 'extension', 'icons', 'icon16.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Praesidia Active', enabled: false },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setToolTip('Praesidia Sovereign Desktop Agent');
    tray.setContextMenu(contextMenu);

    // 3. Connect to Local Backend to receive K2-Think Alerts
    const socket = io('http://localhost:3000');
    
    socket.on('governance_alert', (alert) => {
        const { verdict, reasoning, surface, tavusUrl, level } = alert;

        // Native OS Notification
        new Notification({
            title: `Praesidia [${verdict}]: Level ${level} Breach on ${surface.toUpperCase()}`,
            body: reasoning,
            icon: path.join(__dirname, '..', 'extension', 'icons', 'icon128.png')
        }).show();

        // High-Stakes Action: Launch Tavus Video Lock
        if (verdict === 'DENY' || level >= 4) {
             if (tavusUrl) {
                 launchTavusVideoLock(tavusUrl);
             } else {
                 // Fallback stream logic directly reading reasoning
                 launchTavusStreamingReplica(reasoning);
             }
        }
    });

    // 4. Start Hume EVI Emotional Audio Monitor
    startHumeAudioMonitor((voiceViolation) => {
        new Notification({
            title: `Praesidia [VOICE BLOCKED]`,
            body: `Voice Violation Detected: ${voiceViolation.reason}`,
            icon: path.join(__dirname, '..', 'extension', 'icons', 'icon128.png')
        }).show();
        
        launchTavusStreamingReplica(`A verbal security leak was just detected. Our emotional interceptor caught you attempting: ${voiceViolation.transcript}. This is unacceptable.`);
    });
});

/**
 * Launch the frameless 'Always on Top' Tavus streaming window
 * @param {string} reasoningTrace 
 */
function launchTavusStreamingReplica(reasoningTrace) {
    // ... Previous simulated streaming logic ...
    console.log("Fallback tavus stream trigger: ", reasoningTrace);
}

/**
 * Launch the unclosable Live-Injection video player
 * @param {string} videoUrl
 */
function launchTavusVideoLock(videoUrl) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
    }

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        alwaysOnTop: true,
        frame: false,
        kiosk: true, // Forces fullscreen/strict interaction
        closable: false, // Prevent Intern from closing it
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('tavus-playback.html');

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('play-tavus-video', { videoUrl });
    });
}

// IPC Handling to unlock user after mandated video stream is over.
ipcMain.on('video-ended', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setKiosk(false); // remove full screen lock
        mainWindow.setClosable(true); // allow closing natively
        mainWindow.destroy(); // forcibly rip it down
    }
});
