const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Fetch the relevant GDPR/PIPEDA clause for a specific action using Claude 3.5 Sonnet.
 * @param {string} action - user action description
 * @param {string} surface - target platform (github, slack, etc.)
 */
const getRelevantPolicy = async (action, surface) => {
    try {
        const prompt = `You are a compliance officer for Praesidia.
        Analyze the following user action on ${surface}: "${action}".
        Identify the most relevant GDPR or PIPEDA regulatory clause that applies to this action.
        Return only the specific clause name and a brief 1-sentence description of the rule.`;

        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 150,
            messages: [{ role: "user", content: prompt }]
        });

        return response.content[0].text;
    } catch (error) {
        console.error('Policy Brain Error:', error.message);
        return 'General Data Protection Regulation (GDPR) Article 5 - Principles relating to processing of personal data.';
    }
};

module.exports = {
  getRelevantPolicy
};
