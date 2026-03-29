const { notify } = require('./slack');
// const { sendAlertEmail } = require('./resend');
// const { initiateCall } = require('./twilio');
require('dotenv').config();

/**
 * RBAC Hierarchy Notification Strategy
 * Intern -> Junior -> Senior -> Compliance Manager
 * High Criticality triggers Twilio voice calls.
 */
const orchestrateEscalation = async (violation) => {
    try {
        console.log(`--- Starting 🛡️ Hermes Multi-Channel Escalation ---`);
        console.log(`Violation: ${violation.id} from ${violation.userId} (Role: ${violation.primaryRole})`);

        // 1. Notify Next-Level Up (Senior or Manager)
        let alertMessage = `🛡️ [Praesidia Alert]: Action DENIED for ${violation.userId}. 
        Reasoning: ${violation.verdict}. 
        Please review: https://praesidia.dashboard/violations/${violation.id}`;

        // Slack Notification (Standard)
        await notify({ id: violation.id, text: alertMessage });

        // Email Notification (Disabled legacy Resend script)
        // await sendAlertEmail({ id: violation.id, subject: '🚨 Security Policy Violation: Review Required', text: alertMessage });

        // 2. High Priority Escalate (Voice Call) for Interns (Disabled legacy Twilio)
        /*
        if (violation.primaryRole === 'Intern') {
             await initiateCall('1-800-SECURITY', `Security Alert: Intern User ${violation.userId} triggered a restricted policy violation.`);
        }
        */

        console.log(`--- Hermes Escalation Completed ---`);
        return { status: 'escalated' };
    } catch (error) {
        console.error('Hermes Error:', error.message);
        return { status: 'failed', error: error.message };
    }
};

module.exports = {
    orchestrateEscalation
};
