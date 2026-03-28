/**
 * Praesidia Policy Ingestor
 * Parses uploaded PDF/DOCX/MD files and GitHub/Notion URLs into
 * structured Sovereign Enforcement Rules, stored in Supabase.
 */

const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');
const { loadSkill } = require('./skillLoader');
const { supabase } = require('../database/supabase');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Supabase DDL (run once) ──────────────────────────────────
// CREATE TABLE IF NOT EXISTS policies (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   name TEXT NOT NULL,
//   source TEXT,
//   rules JSONB,
//   slack_alert_channel TEXT,
//   active BOOLEAN DEFAULT true,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// ─────────────────────────────────────────────────────────────

/**
 * Read raw text from an uploaded file.
 * Supports: .md, .txt (direct read), .pdf and .docx (placeholder extraction).
 */
function extractTextFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.md', '.txt'].includes(ext)) {
        return fs.readFileSync(filePath, 'utf-8').substring(0, 12000);
    }
    
    if (ext === '.pdf' || ext === '.docx') {
        // For hackathon: Read raw bytes and attempt UTF-8 text extraction
        // In production: use pdf-parse or mammoth npm packages
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            // Strip binary garbage, keep printable ASCII lines
            return raw
                .split('\n')
                .filter(l => /^[\x20-\x7E\s]{10,}/.test(l))
                .join('\n')
                .substring(0, 12000);
        } catch {
            return `[Binary file: ${path.basename(filePath)}. Document skills loaded for interpretation.]`;
        }
    }
    
    return `[Unsupported format: ${ext}]`;
}

/**
 * Fetch raw text from a GitHub Gist or Notion URL.
 */
async function fetchFromUrl(url) {
    const https = require('https');
    
    // Convert GitHub Gist URL to raw content
    let fetchUrl = url;
    if (url.includes('gist.github.com')) {
        fetchUrl = url.replace('gist.github.com', 'gist.githubusercontent.com')
            .replace(/\/?$/, '/raw');
    }
    
    return new Promise((resolve, reject) => {
        https.get(fetchUrl, { headers: { 'User-Agent': 'Praesidia/1.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data.substring(0, 12000)));
        }).on('error', reject);
    });
}

/**
 * Core pipeline: Send document content to Claude with document-reader skill
 * and extract structured Sovereign Enforcement Rules.
 */
async function extractPolicyRules(documentText, sourceName) {
    const skill = loadSkill('document-reader');
    const systemPrompt = `You are the Praesidia Sovereign Policy Extraction Engine.
${skill ? skill.systemPromptBlock : ''}

Your job is to convert corporate policy documents into structured enforcement rules.`;

    const userPrompt = `Analyze this policy document and extract structured Sovereign Enforcement Rules.

SOURCE: ${sourceName}

DOCUMENT CONTENT:
${documentText}

Respond ONLY with this JSON structure (no markdown fences):
{
  "policy_name": "Short descriptive name",
  "summary": "One sentence summary",
  "roles": ["Intern", "Senior Developer", "Manager"],
  "prohibited_actions": [
    { "action": "Commit plaintext API keys", "regulation": "SOC2 CC6.7", "severity": 5 },
    { "action": "Share PII via Slack DMs", "regulation": "GDPR Art.5", "severity": 4 }
  ],
  "escalation_paths": [
    { "trigger": "severity >= 4", "notify": "Senior Developer", "method": "email" },
    { "trigger": "severity == 5", "notify": "Manager", "method": "email+slack" }
  ],
  "slack_alert_channel": "#compliance-alerts or null",
  "enforcement_message": "Intern, Section X of [policy] states: [verbatim]"
}`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        });

        const raw = response.content[0].text;
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in Claude response');
        return JSON.parse(jsonMatch[0]);
    } catch (err) {
        console.error('[Ingestor] Claude extraction failed:', err.message);
        // Fallback rule set
        return {
            policy_name: sourceName,
            summary: 'Policy ingested with fallback extraction.',
            roles: ['Intern', 'Senior Developer'],
            prohibited_actions: [
                { action: 'Credential exposure', regulation: 'SOC2', severity: 5 },
                { action: 'PII in version control', regulation: 'GDPR Art.5', severity: 4 }
            ],
            escalation_paths: [
                { trigger: 'severity >= 4', notify: 'Senior Developer', method: 'email' }
            ],
            slack_alert_channel: null,
            enforcement_message: `Intern, the uploaded policy "${sourceName}" prohibits this action.`
        };
    }
}

/**
 * Save extracted rules to Supabase and handle NeMo-Claw sync.
 */
async function savePolicyToSupabase(rules, sourceUrl = null) {
    const record = {
        name: rules.policy_name,
        source: sourceUrl || 'file_upload',
        rules: rules,
        slack_alert_channel: rules.slack_alert_channel || null,
        active: true,
    };

    const { data, error } = await supabase
        .from('policies')
        .insert([record])
        .select()
        .single();

    if (error) {
        // Supabase table may not exist yet — log but don't crash
        console.warn('[Ingestor] Supabase insert failed (table may need creating):', error.message);
        return { id: 'local-' + Date.now(), ...record };
    }

    console.log(`[Ingestor] ✅ Policy "${rules.policy_name}" saved to Supabase (id: ${data.id})`);

    // NeMo-Claw sync: if policy specifies a Slack channel, update env
    if (rules.slack_alert_channel && rules.slack_alert_channel !== 'null') {
        process.env.NEMO_CLAW_SLACK_CHANNEL = rules.slack_alert_channel;
        console.log(`[NeMo-Claw Sync] 🔗 Slack target updated → ${rules.slack_alert_channel}`);
    }

    return data;
}

/**
 * Main entry: Ingest a file upload.
 * @param {string} filePath - absolute path to uploaded file
 * @param {string} originalName - original filename
 * @returns {Promise<{rules, saved}>}
 */
async function ingestFile(filePath, originalName) {
    console.log(`[Ingestor] Processing file: ${originalName}`);
    const text = extractTextFromFile(filePath);
    const rules = await extractPolicyRules(text, originalName);
    const saved = await savePolicyToSupabase(rules, `file://${originalName}`);
    return { rules, saved };
}

/**
 * Main entry: Ingest a URL (GitHub Gist / Notion).
 * @param {string} url
 * @returns {Promise<{rules, saved}>}
 */
async function ingestUrl(url) {
    console.log(`[Ingestor] Processing URL: ${url}`);
    const text = await fetchFromUrl(url);
    const rules = await extractPolicyRules(text, url);
    const saved = await savePolicyToSupabase(rules, url);
    return { rules, saved };
}

/**
 * Fetch all active policies from Supabase for RAG injection.
 * Falls back to empty array if table not yet created.
 */
async function getActivePolicies() {
    try {
        const { data, error } = await supabase
            .from('policies')
            .select('name, rules, slack_alert_channel')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.warn('[Ingestor] Could not fetch policies from Supabase:', err.message);
        return [];
    }
}

module.exports = { ingestFile, ingestUrl, getActivePolicies };
