/**
 * Praesidia Content Script (Shadow DOM implementation)
 * Injects the floating action button and handles real-time alerts without affecting host site CSS.
 */

(function() {
    console.log('🛡️ [Praesidia Content Script]: Initialized (Shadow DOM)');

    // 1. Create Host Element and Shadow root
    const host = document.createElement('div');
    host.id = 'praesidia-extension-host';
    document.body.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });

    // 2. Add Styles inside Shadow component
    const style = document.createElement('style');
    style.textContent = `
        :host {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647; /* Max z-index */
            font-family: 'Inter', -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            pointer-events: none; /* Let clicks pass through empty space */
        }

        /* Container for clickable elements */
        .praesidia-container {
            pointer-events: auto;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }

        /* Pulsing Shield (Praesidia Logo style) - Minimized */
        .praesidia-shield-trigger {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #134e5e, #71b280); /* Logo tones */
            border-radius: 50%;
            box-shadow: 0 0 15px rgba(20, 184, 166, 0.4); /* Teal pulse */
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            animation: pulse-shield 2.5s infinite ease-in-out;
            border: 2px solid white;
            transition: transform 0.2s;
        }
        
        .praesidia-shield-trigger:hover {
            transform: scale(1.05);
        }

        @keyframes pulse-shield {
            0% { box-shadow: 0 0 10px rgba(20, 184, 166, 0.3); }
            50% { box-shadow: 0 0 25px rgba(20, 184, 166, 0.7); }
            100% { box-shadow: 0 0 10px rgba(20, 184, 166, 0.3); }
        }

        .praesidia-shield-trigger svg {
            width: 26px;
            height: 26px;
            fill: white;
        }

        /* Alert Card - Expanded */
        .praesidia-alert-card {
            width: 320px;
            background: rgba(17, 24, 39, 0.95); /* Dark Mode */
            backdrop-filter: blur(10px);
            border: 1px solid rgba(20, 184, 166, 0.4); /* Teal border */
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 15px;
            color: #f3f4f6;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
            display: none; /* Hidden until triggered */
            animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            transform-origin: bottom right;
        }

        @keyframes slide-up {
            from { transform: translateY(20px) scale(0.95); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
        }

        .praesidia-alert-card.active {
            display: block;
        }

        .praesidia-header {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 10px;
        }

        .praesidia-type {
            font-weight: 700;
            text-transform: uppercase;
            color: #ef4444; /* Red for block */
            font-size: 13px;
            letter-spacing: 0.5px;
        }

        .praesidia-content {
            font-size: 14px;
            line-height: 1.5;
            color: #d1d5db;
        }

        .praesidia-meta {
            margin-top: 14px;
            font-size: 12px;
            background: rgba(20, 184, 166, 0.15); /* Teal accent */
            padding: 10px;
            border-radius: 6px;
            color: #5eead4;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .praesidia-btn {
            display: block;
            width: 100%;
            margin-top: 14px;
            padding: 10px;
            background: #0f766e; /* Teal */
            color: white;
            text-align: center;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            font-size: 13px;
            transition: background 0.2s;
            box-sizing: border-box;
            border: none;
            cursor: pointer;
        }

        .praesidia-btn:hover {
            background: #115e59;
        }
        
        .praesidia-close {
            margin-left: auto;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.2s;
        }
        
        .praesidia-close:hover {
            opacity: 1;
        }
    `;
    shadowRoot.appendChild(style);

    // 3. Create UI Elements
    const container = document.createElement('div');
    container.className = 'praesidia-container';

    const alertCard = document.createElement('div');
    alertCard.className = 'praesidia-alert-card';
    alertCard.innerHTML = `
        <div class="praesidia-header">
            <span class="praesidia-type" id="praesidia-type">⚠️ BLOCK DETECTED</span>
            <span class="praesidia-close" id="praesidia-close">✕</span>
        </div>
        <div class="praesidia-content" id="praesidia-reasoning">
            AI Governance violation detected.
        </div>
        <div class="praesidia-meta" id="praesidia-manager-info">
            🛡️ Notifying: Manager
        </div>
        <button class="praesidia-btn" id="praesidia-dashboard-btn">View Dashboard</button>
    `;

    const shieldTrigger = document.createElement('div');
    shieldTrigger.className = 'praesidia-shield-trigger';
    shieldTrigger.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.75-7 10-3.87-1.25-7-5.33-7-10v-4.7l7-3.12z"/>
        </svg>
    `;

    container.appendChild(alertCard);
    container.appendChild(shieldTrigger);
    shadowRoot.appendChild(container);

    // 4. Interaction Logic
    shieldTrigger.addEventListener('click', () => {
        alertCard.classList.toggle('active');
    });

    shadowRoot.getElementById('praesidia-close').addEventListener('click', () => {
        alertCard.classList.remove('active');
    });
    
    shadowRoot.getElementById('praesidia-dashboard-btn').addEventListener('click', () => {
        window.open('http://127.0.0.1:3005/dashboard', '_blank');
    });

    // 5. Listen for Messages from Background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'PRAESIDIA_ALERT') {
            const { verdict, reasoning, notified_manager } = message.payload;
            
            // Update UI
            const typeEl = shadowRoot.getElementById('praesidia-type');
            if (verdict === 'DENY') {
                typeEl.innerText = '🛡️ PROACTIVE BLOCK';
                typeEl.style.color = '#ef4444'; // Red
                shieldTrigger.style.background = 'radial-gradient(circle, #ef4444 0%, #b91c1c 100%)';
                shieldTrigger.style.animation = 'pulse-shield-red 1s infinite ease-in-out';
                
                // Add red pulse animation dynamically
                const redAnim = document.createElement('style');
                redAnim.textContent = `@keyframes pulse-shield-red { 
                    0% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.5); }
                    50% { box-shadow: 0 0 25px rgba(239, 68, 68, 0.9); }
                    100% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.5); }
                }`;
                shadowRoot.appendChild(redAnim);
                
            } else {
                typeEl.innerText = '⚠️ GOVERNANCE WARNING';
                typeEl.style.color = '#f59e0b'; // Orange
                shieldTrigger.style.background = 'radial-gradient(circle, #f59e0b 0%, #d97706 100%)';
            }

            shadowRoot.getElementById('praesidia-reasoning').innerText = reasoning;
            shadowRoot.getElementById('praesidia-manager-info').innerText = `Notifying: ${notified_manager}`;
            
            // Auto open the card
            alertCard.classList.add('active');
        }
    });
})();
