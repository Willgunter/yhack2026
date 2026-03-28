const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const path = require('path');
const multer = require('multer');
const { Server } = require('socket.io');
const { validateJWT } = require('./identity/auth0Client');
const { semanticRBAC } = require('./interceptor/k2Brain');
const { ingestFile, ingestUrl } = require('./policy/ingestor');
const { listPolicies } = require('./database/supabase');
require('dotenv').config();

// Multer: store uploads in /tmp/praesidia-uploads
const upload = multer({ dest: path.join(__dirname, 'tmp', 'uploads') });


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
        const payload = {
            surface,
            userId,
            verdict: decision.verdict,
            reasoning: decision.reasoning,
            thought_process: decision.thought_process,
            notified_manager: decision.notified_manager
        };
        io.emit('governance_alert', payload);
        if (process.send) process.send({ type: 'governance_alert', data: payload });
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

// ─── Authentication (Mock for Hackathon) ───
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  // Accept any login for demo purposes
  if (username && password) {
    res.status(200).json({ token: 'mock-jwt-token-123', user: { name: 'Cmdr. Vane', role: 'L7 Access' } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ─── Dashboard Data (Mock) ───
app.get('/api/dashboard/metrics', async (req, res) => {
  res.status(200).json({ 
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
  });
});

app.get('/api/governance/status', (req, res) => {
  res.status(200).json({
    activePolicies: 12,
    pendingReviews: 4,
    recentUpdates: [
      { name: 'SOC2 Type II Compliance Refresh', status: 'Completed', date: 'Today' },
      { name: 'Data Retention Policy V3', status: 'Pending Review', date: 'Yesterday' }
    ]
  });
});

app.get('/api/risk/analysis', (req, res) => {
  res.status(200).json({
    overallRisk: 'LOW',
    vulnerabilities: [
      { id: 'VULN-001', severity: 'Medium', component: 'Prompt Injection Layer', mitigated: false },
      { id: 'VULN-002', severity: 'Critical', component: 'Model Weights Endpoint', mitigated: true }
    ],
    threatActivity: 'Normal'
  });
});

app.get('/api/audit/logs', (req, res) => {
  res.status(200).json({
    logs: [
      { id: 'LOG-992', user: 'System', action: 'RAG Model Sycned with Supabase', timestamp: '2026-03-28T15:30:00Z' },
      { id: 'LOG-991', user: 'Cmdr. Vane', action: 'Uploaded Sovereign Policy V4', timestamp: '2026-03-28T14:45:00Z' },
      { id: 'LOG-990', user: 'Intern_14', action: 'Attempted Unsafe System Prompt', timestamp: '2026-03-28T10:12:00Z' }
    ]
  });
});

// ─── NeMo-Claw: Highlight Overlay Route ───
// Receives highlight data and broadcasts to Electron desktop agent
app.post('/api/highlight', (req, res) => {
  const { file, line, summary } = req.body;
  console.log(`🎯 [NeMo-Claw] Highlight broadcast: ${file}:${line}`);
  const payload = { file, line, summary };
  io.emit('highlight_violation', payload);
  if (process.send) process.send({ type: 'highlight_violation', data: payload });
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

// ─── Static Dashboard ───
app.use(express.static(path.join(__dirname, 'public')));
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ─── Sovereign Vault: Policy Upload ───
app.post('/api/policies/upload', upload.single('policy'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    console.log(`[Vault] Ingesting file: ${req.file.originalname}`);
    const result = await ingestFile(req.file.path, req.file.originalname);
    const payload = { name: result.rules.policy_name, source: req.file.originalname };
    io.emit('policy_ingested', payload);
    if (process.send) process.send({ type: 'policy_ingested', data: payload });
    res.json({ status: 'ingested', policy: result.rules, saved: result.saved });
  } catch (err) {
    console.error('[Vault] Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Sovereign Vault: URL Ingestion ───
app.post('/api/policies/url', express.json(), async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  try {
    console.log(`[Vault] Ingesting URL: ${url}`);
    const result = await ingestUrl(url);
    const payload = { name: result.rules.policy_name, source: url };
    io.emit('policy_ingested', payload);
    if (process.send) process.send({ type: 'policy_ingested', data: payload });
    res.json({ status: 'ingested', policy: result.rules, saved: result.saved });
  } catch (err) {
    console.error('[Vault] URL error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Sovereign Vault: List Policies ───
app.get('/api/policies/list', async (req, res) => {
  try {
    const policies = await listPolicies();
    res.json({ policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Senior Override Route ───
// Triggered by Senior Developer typing "Show me the problem" in any surface
app.post('/api/senior-override', (req, res) => {
  const { remediationMeta } = req.body;
  console.log('👔 [SeniorMode] Override activated — broadcasting to Desktop Agent...');
  const payload = { remediationMeta };
  io.emit('senior_override', payload);
  if (process.send) process.send({ type: 'senior_override', data: payload });
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