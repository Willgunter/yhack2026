const { semanticRBAC } = require('./semanticCheck');

/**
 * Handle events from multiple surfaces with custom reactive actions.
 * @param {Object} payload - raw event data
 * @param {string} surface - target platform
 */
const processEvent = async (payload, surface) => {
    try {
        const action = payload.action ||  payload.text || 'Unknown Action';
        const userId = payload.userId || 'unknown_user';

        // Proactive surfaces (GitHub): Optimize for speed
        if (surface === 'github') {
            const decision = await semanticRBAC(action, userId, surface, payload);
            return decision; // Standard RBAC response for immediate hook feedback
        }

        // Reactive surfaces (Slack/Jira): Process and Alert
        if (surface === 'slack'  || surface === 'jira') {
            const decision = await semanticRBAC(action, userId, surface, payload);
            if (decision.verdict === 'DENY') {
                console.log(`[${surface} Handler]: Action DENIED. Triggering reactive suppression...`);
                // TODO: Actual Slack/Jira API call to delete message or add comment
            }
            return decision;
        }

        return { verdict: 'WARN', reasoning: 'Unsupported surface type' };
    } catch (error) {
        console.error(`Handler Error on ${surface}:`, error.message);
        throw error;
    }
};

module.exports = {
    processEvent
};
