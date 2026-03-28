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

// ─── NeMo-Claw: Highlight Overlay Route ───
// Receives highlight data and broadcasts to Electron desktop agent
app.post('/api/highlight', (req, res) => {
  const { file, line, summary } = req.body;
  console.log(`🎯 [NeMo-Claw] Highlight broadcast: ${file}:${line}`);
  io.emit('highlight_violation', { file, line, summary });
  res.json({ status: 'broadcast', file, line });
});

// ─── NeMo-Claw: Execute Remediation Route ───
// Spawns Python NeMo-Claw engine to open Slack, GitHub diff, and trigger highlight
app.post('/api/nemo-claw/execute', (req, res) => {
  const { remediationMeta } = req.body;
  console.log('👔 [NeMo-Claw] Executing remediation for Senior Developer...');

  const { spawn } = require('child_process');
  const pythonCmd = process.platform === 'win32' ? '.\\venv\\Scripts\\python' : './venv/bin/python';

  const proc = spawn(pythonCmd, ['-c', `
import sys, json
sys.path.insert(0, '.')
from guardrails.actions import execute_from_k2_json
result = execute_from_k2_json('${JSON.stringify(remediationMeta || {}).replace(/'/g, "\\'")}')
print(json.dumps(result))
  `], { cwd: __dirname });

  let output = '';
  proc.stdout.on('data', d => { output += d.toString(); });
  proc.stderr.on('data', d => console.error('[NeMo-Claw Python]', d.toString()));
  proc.on('close', () => {
    console.log('[NeMo-Claw] Completed:', output.trim());
  });

  res.json({ status: 'executing', pid: proc.pid });
});

// ─── Senior Override Route ───
// Triggered by Senior Developer typing "Show me the problem" in any surface
app.post('/api/senior-override', (req, res) => {
  const { remediationMeta } = req.body;
  console.log('👔 [SeniorMode] Override activated — broadcasting to Desktop Agent...');
  io.emit('senior_override', { remediationMeta });
  res.json({ status: 'override_broadcast' });
});

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('🔌 [Socket]: Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('🔌 [Socket]: Client disconnected');
    });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Praesidia Engine running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket Gateway ready for Chrome Extension alerts.`);
});

module.exports = { app, server, io };