const axios = require('axios');
const { auth0, getUserRoles } = require('../identity/auth0Client');
const { getRelevantPolicy = async () => 'Standard Policy' } = require('../policy/policyBrain') || {};
const { orchestrateEscalation } = require('../escalation/hermes');
const { insertViolation = async () => {}, getActivePolicies = async () => [] } = require('../database/supabase') || {};
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

        // RAG: Fetch active policies from Supabase
        let activePoliciesBlock = '';
        try {
            const policies = await getActivePolicies();
            if (policies.length > 0) {
                const policyRules = policies.map(p => {
                    const rules = p.rules || {};
                    const prohibited = (rules.prohibited_actions || []).map(a => `- ${a.action} (${a.regulation}, severity ${a.severity})`).join('\n');
                    return `### ${p.name}\nProhibited Actions:\n${prohibited}\nEnforcement: ${rules.enforcement_message || ''}`.trim();
                }).join('\n\n');
                activePoliciesBlock = `\n\nActive Company Policies (enforce these ABOVE the charter if stricter):\n${policyRules}`;
                console.log(`📚 [RAG] Injecting ${policies.length} active polic${policies.length === 1 ? 'y' : 'ies'} into K2 context`);
            }
        } catch (ragErr) {
            console.warn('[RAG] Policy fetch failed, proceeding without:', ragErr.message);
        }

        // K2-Think Sovereign Prompt
        const prompt = `You are the Sovereign Governance Engine evaluating an Intern's actions.
        
        Sovereign Charter (The Law):
        ${sovereignCharter}${activePoliciesBlock}
        
        Current Action: ${action} 
        Metadata: ${JSON.stringify(payload)}

        Constraint: The user is ALWAYS referred to as 'Intern'. The manager is ALWAYS 'Senior Developer' or 'Compliance Lead'. Use NO personal names.

        Provide your response exactly in this JSON format strictly:
        {
          "reasoningTrace": "Step by step reasoning...",
          "level": [Number 3, 4, or 5 based on charter violation. 0 if no violation],
          "verdict": "ALLOW" | "DENY" | "WARN",
          "psiScript": "Intern, a breach... [Your custom PSI script for Tavus, cite company policy if available]"
        }`;

        console.log("🧠 Sending request to K2-Think...");
        const response = await fetch(K2_ENDPOINT, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.K2_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "MBZUAI-IFM/K2-Think-v2",
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`K2 API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        console.log("📥 K2 Response received. Parsing...");

        // Capture Reasoning & Verdict
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
            verdict: 'WARN',
            level: 3,
            reasoningTrace: "Fallback reasoning. Unrecognized structure.",
            psiScript: "Intern, an ambiguous violation occurred."
        };

        const verdict = parsed.verdict;
        const level = parsed.level;
        const reasoningTrace = parsed.reasoningTrace;
        const psiScript = parsed.psiScript;

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
                cited_policy: 'Sovereign Charter',
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
