// Import locally bundled socket.io instead of CDN to avoid CSP errors
importScripts('lib/socket.io.min.js');

const PR_SERVER = 'http://127.0.0.1:3005';
let socket;

function connect() {
    socket = io(PR_SERVER, {
        reconnection: true,
        reconnectionDelay: 5000,
        transports: ['websocket']
    });

    socket.on('connect', () => {
        console.log('🛡️ [Praesidia Extension]: Connected to Governance Engine');
    });

    socket.on('governance_alert', (alert) => {
        console.log('🚨 [Praesidia Alert]:', alert);
        
        // Relay to all active tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'PRAESIDIA_ALERT',
                    payload: alert
                }).catch(err => {
                    // Ignore errors for tabs without content scripts
                });
            });
        });

        // System notification fallback
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png', 
            title: `Praesidia Blocked: ${alert.verdict}`,
            message: alert.reasoning,
            priority: 2
        });
    });

    socket.on('disconnect', () => {
        console.warn('⚠️ [Praesidia Extension]: Disconnected from Engine');
    });
}

connect();
