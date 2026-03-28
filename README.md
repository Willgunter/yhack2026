# Praesidia Sovereign Sentinel 🛡️
**A Next-Generation AI Governance & Interception Platform**

Praesidia evaluates developer behavior against an organizational strict "Sovereign Charter" using **K2-Think-v2**. When a severe (Level 4 or 5) infraction is detected (like pushing plaintext AWS keys), the Sovereign Agent triggers a Live-Injection protocol. 

It forcefully launches an unclosable full-screen Electron overlay powered by **Tavus**, forcing the employee into a real-time, personalized AI video confrontation reading out the exact reasoning trace that convicted them, while subsequently firing off a report to their Compliance Lead via **Resend**.

---

## 🏗️ Architecture Stack
- **Backend**: Express/Node.js evaluating webhooks via `k2Brain.js`.
- **Reasoning**: K2-Think API (MBZUAI-IFM/K2-Think-v2).
- **Physical Lockdown**: Frameless Electron kiosk application.
- **Audio Overlays**: Hume AI EVI (Extensible Voice Interface).
- **Live Video Conjugation**: Tavus API V2 (`fast: true`).
- **Escalation Loop**: Resend HTML reporting to management layers.
- **Data Log**: Supabase PostgreSQL insertion.

---

## ⚡ Setup Instructions
_To run this demo seamlessly, you must have active API keys for K2-Think, Tavus, and Resend._

### 1. Environment & API Setup
Create a `.env` file in the root directory duplicating the keys you need:
```bash
# Core AI Governance Engine
K2_API_KEY=your_k2_think_api_key

# Video Escalation (Live Injection)
TAVUS_API_KEY=your_tavus_api_key
TAVUS_REPLICA_ID=r291e545fd67 
TAVUS_PERSONA_ID=pf4480a02236 

# Reporting
RESEND_API_KEY=your_resend_api_key
```

### 2. Install & Run Backend 
Start the interceptor which listens on port 3000 (or `3005` if bound).
```bash
# In the root repo folder
npm install
node index.js
```
*The backend must be running to receive WebSocket handshakes and webhook `POST` interactions.*

### 3. Install & Run the Kiosk Desktop-Agent
In a separate terminal, launch the Electron application. It will run in the system tray silently until the backend signals a Level 5 Violation broadcast.
```bash
cd desktop-agent
npm install
npm start
```

### 4. Verify System Loop
Run the internal health check and injection test:
```bash
# Ensure servers are up, verify APIs are reachable
node scripts/check-vitals.js

# Trigger a fake Level 5 violation terminal
node scripts/test-sovereign-flow.js
```

Observe your primary monitor lock up as the Tavus AI confronts your test payload.

### Disclaimer
Praesidia is built for intensive security compliance validation. The Electron app natively suppresses OS-level window close hooks (`kiosk: true`, `closable: false`) while it delivers the Live-Injection payload. Proceed carefully during demonstration mode.
