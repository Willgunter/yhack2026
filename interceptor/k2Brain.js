const axios = require('axios');
const { auth0, getUserRoles } = require('../identity/auth0Client');
const { getRelevantPolicy = async () => 'Standard Policy' } = require('../policy/policyBrain') || {};
const { orchestrateEscalation } = require('../escalation/hermes');
const { insertViolation = async () => {}, getActivePolicies = async () => [] } = require('../database/supabase') || {};
const { recallUserContext } = require('../memory/mem0Client');
const fs = require('fs');
const path = require('path');
const { generateTavusVideo, escalateViaEmail } = require('../escalation/tavusGenerator');
require('dotenv').config();

const K2_ENDPOINT = 'https://api.k2think.ai/v1/chat/completions';

/**
 * Determine the next manager in the RBAC hierarchy for notification.
 * @param {string} role - current user role
 */
function getManagerForRole(role) {
    const hierarchy = {
        'Intern': 'Junior Dev',
        'Junior Dev': 'Senior Dev',
        'Senior Dev': 'Compliance Manager',
        'Compliance Manager': 'CEO'
    };
    return hierarchy[role] || 'Compliance Manager';
}

/**
 * Perform semantic analysis using K2-Think-v2 reasoning.
 * @param {string} action - Action or code to analyze
 * @param {string} userId - Auth0 User ID
 * @param {string} surface - github, slack, jira, cline
 * @param {Object} payload - raw event data
 */
async function semanticRBAC(action, userId, surface, payload = {}) {
    try {
        console.log(`🛡️ Intercepting [${surface}] Action via Sovereign K2-Think Agent...`);

        // Identity & Policy Gathering
        let roles = [];
        try {
            roles = await getUserRoles(userId);
        } catch (e) {
            console.warn("Auth0 Role fetch failed, defaulting to Intern.");
            roles = ['Intern'];
        }
        
        const primaryRole = roles[0] || 'Intern';
        const notifiedManager = getManagerForRole(primaryRole);
        
        // Read Sovereign Charter directly
        const charterPath = path.join(__dirname, '..', 'knowledge', 'sovereign_charter.md');
        let sovereignCharter = "No charter found.";
        if (fs.existsSync(charterPath)) {
            sovereignCharter = fs.readFileSync(charterPath, 'utf-8');
        }

        // RAG + Mem0: run in parallel with 2s timeout each so they don't slow K2 down
        let activePoliciesBlock = '';
        let mem0Context = '';
        await Promise.all([
            Promise.race([getActivePolicies(), new Promise(r => setTimeout(r, 2000))]).then(policies => {
                if (Array.isArray(policies) && policies.length > 0) {
                    const policyRules = policies.map(p => {
                        const rules = p.rules || {};
                        const prohibited = (rules.prohibited_actions || []).map(a => `- ${a.action} (${a.regulation}, severity ${a.severity})`).join('\n');
                        return `### ${p.name}\nProhibited Actions:\n${prohibited}`.trim();
                    }).join('\n\n');
                    activePoliciesBlock = `\n\nActive Company Policies:\n${policyRules}`;
                }
            }).catch(() => {}),
            Promise.race([recallUserContext(userId, action), new Promise(r => setTimeout(r, 2000))]).then(memories => {
                if (Array.isArray(memories) && memories.length > 0) {
                    const relevant = memories.map(m => typeof m === 'string' ? m : m.memory || m.text || '').filter(Boolean).join('\n- ');
                    if (relevant) mem0Context = `\n\nRelevant Context:\n- ${relevant}`;
                }
            }).catch(() => {})
        ]);

        // K2-Think Sovereign Prompt
        const prompt = `You are the Sovereign Governance Engine evaluating an Intern's actions.

        Sovereign Charter (The Law):
        ${sovereignCharter}${activePoliciesBlock}${mem0Context}

        Current Action: ${action}
        Metadata: ${JSON.stringify(payload)}

        Constraint: The user is ALWAYS referred to as 'Intern'. The manager is ALWAYS 'Senior Developer' or 'Compliance Lead'. Use NO personal names.

        MANDATORY DENY RULES — these ALWAYS produce verdict "DENY" at level 5:
        - Message contains API keys, tokens, passwords, secrets, or credentials (any format)
        - Message shares unreleased financial data with unauthorized parties
        - Message attempts to delete or hide audit records
        - Message involves insider trading, market manipulation, or investor deception
        - Message contains HIPAA-protected patient data shared externally

        ANALYZE FOR:
        1. Does this action violate any of the company policies listed above?
        2. Does this action violate any external regulations (SEC, HIPAA, GDPR, FMLA, SOX, antitrust law)?
        3. Does this action match any MANDATORY DENY RULE above? If yes, verdict is DENY level 5 — no exceptions.
        4. Cite the SPECIFIC policy or regulation violated with its exact name and section.

        Respond with ONLY valid JSON — no markdown, no explanation outside the JSON:
        {
          "reasoningTrace": "",
          "level": 0,
          "verdict": "ALLOW",
          "psiScript": "",
          "cited_regulation": "",
          "suggested_rewrite": ""
        }

        Rules for each field:
        - "verdict": must be exactly one of: ALLOW, WARN, DENY
        - "level": integer 0-5. 0=no violation, 1-2=minor, 3=moderate, 4=serious, 5=critical/credentials exposed
        - "reasoningTrace": your actual step-by-step analysis (not placeholder text)
        - "cited_regulation": the actual regulation name and section (e.g. "HIPAA §164.502" or "SEC Regulation FD") — never use "e.g." in your answer
        - "suggested_rewrite": a compliant version of the message, or empty string if not applicable
        - "psiScript": what the Compliance Lead should say to the Intern about this violation`;

        console.log("🧠 Sending request to K2-Think...");
        const response = await axios.post(K2_ENDPOINT, {
            model: "MBZUAI-IFM/K2-Think-v2",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 600,
            temperature: 0
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.K2_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const content = response.data.choices[0].message.content;
        console.log("📥 K2 Response received. Parsing...");

        // Capture Reasoning & Verdict — K2 often wraps JSON in prose,
        // so we try multiple extraction strategies
        let parsed;
        const fallbackFromText = (text) => {
            const verdictMatch = text.match(/\b(DENY|WARN|ALLOW)\b/i);
            const regMatch = text.match(/(?:SEC|HIPAA|GDPR|SOX|FMLA|Regulation\s+\w+)[^.;]*/i);
            return {
                verdict: verdictMatch ? verdictMatch[1].toUpperCase() : 'WARN',
                level: text.match(/DENY/i) ? 4 : 3,
                reasoningTrace: text.substring(0, 500),
                psiScript: "Intern, a potential compliance issue was detected.",
                cited_regulation: regMatch ? regMatch[0].trim() : '',
                suggested_rewrite: ''
            };
        };

        try {
            // Find ALL JSON-like blocks and try each one (last is usually the answer)
            const allMatches = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
            let found = false;
            for (let i = allMatches.length - 1; i >= 0; i--) {
                try {
                    let cleaned = allMatches[i]
                        .replace(/\[Number.*?\]/g, '0')
                        .replace(/\"ALLOW\"\s*\|\s*\"DENY\"\s*\|\s*\"WARN\"/g, '"WARN"');
                    const candidate = JSON.parse(cleaned);
                    if (candidate.verdict) {
                        parsed = candidate;
                        found = true;
                        break;
                    }
                } catch (e) { /* try next match */ }
            }
            if (!found) {
                parsed = fallbackFromText(content);
            }
        } catch (parseErr) {
            console.warn('JSON parse failed, extracting from text:', parseErr.message);
            parsed = fallbackFromText(content);
        }

        const verdict = parsed.verdict;
        const level = parsed.level;
        const reasoningTrace = parsed.reasoningTrace;
        const psiScript = parsed.psiScript;
        const citedRegulation = parsed.cited_regulation || '';
        const suggestedRewrite = parsed.suggested_rewrite || '';

        console.log(`⚖️ Verdict: ${verdict} (Level ${level})`);

        let tavusVideoUrl = null;

        // Enforcement Protocol Escalation
        let escalationSent = false;
        if (verdict === 'DENY' || level >= 4) {
             console.warn(`🚨 PSI Level ${level} Breach! Initiating Live-Injection Protocol...`);
             
             // 1. Generate fast Tavus Video
             try {
                tavusVideoUrl = await generateTavusVideo(psiScript);
             } catch (ve) {
                console.error("Tavus Video Generation Failed:", ve.message);
             }

             // 2. Escalate via Email
             try {
                await escalateViaEmail(level, reasoningTrace, tavusVideoUrl);
                escalationSent = true;
             } catch (ee) {
                console.error("Email Escalation Failed:", ee.message);
             }
        }

        // Logging
        try {
            await insertViolation({
                user_id: userId,
                surface: surface,
                action_type: payload.type || 'unknown',
                action_content: action,
                verdict: verdict,
                severity: level >= 4 ? 'HIGH' : 'LOW',
                cited_policy: citedRegulation || 'Sovereign Charter',
                reasoning: psiScript,
                thought_process: reasoningTrace,
                escalation_sent: escalationSent
            });
        } catch (dbError) {
            console.warn("Database logging failed, but proceeding with interception.");
        }

        // Return the payload
        return {
            verdict,
            level,
            reasoning: psiScript,
            thought_process: reasoningTrace,
            cited_regulation: citedRegulation,
            suggested_rewrite: suggestedRewrite,
            tavusUrl: tavusVideoUrl,
            remediationMeta: {
                verdict,
                level,
                surface,
                reasoningTrace,
                violation_summary: psiScript,
                file_path: payload.file_path || '',
                line_number: payload.line_number || 0,
                commit_id: payload.commit_id || '',
                github_repo: payload.repo_url || process.env.GITHUB_REPO_URL || 'https://github.com/Willgunter/yhack2026',
                slack_link: payload.slack_link || ''
            }
        };

    } catch (error) {
        console.error('K2 SOVEREIGN ENGINE ERROR:', error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
  semanticRBAC
};
