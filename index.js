const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const { validateJWT } = require('./identity/auth0Client');
const { semanticRBAC } = require('./interceptor/k2Brain'); // The Sovereign Engine
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health Check
app.get('/', (req, res) => {
  res.json({ status: '🛡️ Praesidia AI Governance Engine is operational.' });
});

/**
 * Core Interception Logic
 * This handles all surfaces (GitHub, Slack, Jira, Cline)
 * and broadcasts alerts to the Chrome Extension real-time.
 */
async function handleInterception(req, res, surface) {
  try {
    const { action, userId } = req.body;

    // 1. Run the DeepSeek R1 Reasoning
    const decision = await semanticRBAC(action, userId, surface);

    // 2. Broadcast to Chrome Extension via WebSocket
    if (decision.verdict === 'DENY' || decision.verdict === 'WARN') {
        console.log(`📡 [Real-time Alert]: Broadcasting ${decision.verdict} to extensions...`);
        io.emit('governance_alert', {
            surface,
            userId,
            verdict: decision.verdict,
            reasoning: decision.reasoning,
            thought_process: decision.thought_process,
            notified_manager: decision.notified_manager
        });
    }

    // 3. Return the verdict (ALLOW/DENY/WARN)
    res.status(200).json(decision);
  } catch (error) {
    console.error(`❌ ${surface} Interception Error:`, error.message);
    res.status(500).json({ error: 'Internal Governance Failure', details: error.message });
  }
}

// Surface Routes (Temporarily removed validateJWT for local test flow)
app.post('/api/github/intercept', (req, res) => handleInterception(req, res, 'github'));
app.post('/api/slack/intercept', validateJWT, (req, res) => handleInterception(req, res, 'slack'));
app.post('/api/jira/intercept', validateJWT, (req, res) => handleInterception(req, res, 'jira'));
app.post('/api/cline/intercept', validateJWT, (req, res) => handleInterception(req, res, 'cline'));

// Dashboard (Protected)
app.get('/api/dashboard/metrics', validateJWT, async (req, res) => {
  res.status(200).json({ status: 'Dashboard accessible.' });
});

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('🔌 [Socket]: Chrome Extension connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('🔌 [Socket]: Chrome Extension disconnected');
    });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Praesidia Engine running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket Gateway ready for Chrome Extension alerts.`);
});

module.exports = { app, server, io };