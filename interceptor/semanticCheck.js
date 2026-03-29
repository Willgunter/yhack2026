const axios = require('axios');
const { auth0, getUserRoles } = require('../identity/auth0Client');
const { getRelevantPolicy } = require('../policy/policyBrain');
const { orchestrateEscalation } = require('../escalation/hermes');
const { insertViolation } = require('../database/supabase');
require('dotenv').config();

const K2_ENDPOINT = process.env.K2_API_URL || 'https://api.k2think.ai/v1/chat/completions';
const K2_MODEL = 'MBZUAI-IFM/K2-Think-v2';

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
 * Perform semantic analysis using DeepSeek R1 reasoning and RBAC oversight.
 * @param {string} action - Action or code to analyze
 * @param {string} userId - Auth0 User ID
 * @param {string} surface - github, slack, jira, cline
 * @param {Object} payload - raw event data
 */
async function semanticRBAC(action, userId, surface, payload = {}) {
    try {
        console.log(`🛡️ Intercepting [${surface}] Action from user ${userId}...`);

        // Step A (Identity): Fetch Auth0 Role
        let primaryRole = 'Intern';
        let notifiedManager = 'Compliance Manager';
        try {
            const roles = await getUserRoles(userId);
            primaryRole = roles[0] || 'Intern';
            notifiedManager = getManagerForRole(primaryRole);
        } catch (e) {
            console.warn('Auth0 role fetch failed, using default:', e.message);
        }

        // Step B (Policy): Fetch GDPR/PIPEDA clause
        let policyClause = 'No specific policy loaded';
        try {
            policyClause = await getRelevantPolicy(action, surface);
        } catch (e) {
            console.warn('Policy fetch failed:', e.message);
        }

        // Step C (DeepSeek R1 Reasoning): Call reasoning model
        const prompt = `User Role: ${primaryRole}
        Action Description: ${action} 
        Surface: ${surface}
        Payload Metadata: ${JSON.stringify(payload)}
        Applicable Policy: ${policyClause}

        Analyze this action for governance and security violations. 
        Provide a verdict: ALLOW, DENY, or WARN.
        Explain the reasoning for this verdict clearly.`;

        const response = await axios.post(K2_ENDPOINT, {
            model: K2_MODEL,
            messages: [{ role: "user", content: prompt }],
            stream: false
        }, {
            headers: { 'Authorization': `Bearer ${process.env.K2_API_KEY}` },
            timeout: 30000
        });

        // Capture Reasoning & Verdict
        const rawContent = response.data.choices[0].message.content || '';
        const thoughtProcess = rawContent;
        const verdictText = rawContent;
        
        // Extract verdict word (ALLOW/DENY/WARN)
        const verdict = verdictText.match(/ALLOW|DENY|WARN/i)?.[0]?.toUpperCase() || 'WARN';

        // Step D (Escalation): If DENY and Intern/Junior
        let escalationSent = false;
        if (verdict === 'DENY' && (primaryRole === 'Intern' || primaryRole === 'Junior Dev')) {
            console.warn(`🚨 High Risk Detected! Escalating to ${notifiedManager}...`);
            await orchestrateEscalation({ id: 'AUTO_GEN', userId, action, verdict, primaryRole, notifiedManager });
            escalationSent = true;
        }

        // Step E (Logging): Save to Supabase
        try {
            const violationData = {
                user_id: userId,
                surface: surface,
                action_type: payload.type || 'unknown',
                action_content: action,
                verdict: verdict,
                severity: verdict === 'DENY' ? 'HIGH' : 'LOW',
                cited_policy: policyClause,
                reasoning: verdictText,
                thought_process: thoughtProcess,
                escalation_sent: escalationSent
            };
            await insertViolation(violationData);
        } catch (e) {
            console.warn('Supabase log failed:', e.message);
        }

        return {
            verdict,
            reasoning: verdictText,
            thought_process: thoughtProcess,
            policy_cited: policyClause,
            notified_manager: notifiedManager
        };

    } catch (error) {
        console.error('CRITICAL BRAIN ERROR:', error.message);
        throw error;
    }
}

module.exports = {
  semanticRBAC
};
