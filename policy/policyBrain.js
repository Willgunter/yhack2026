/**
 * Praesidia Policy Brain — Skill-Enhanced
 * Uses Claude 3.5 Sonnet with optional skill injection for specialized analysis.
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const { loadSkills, citeFromHandbook } = require('./skillLoader');
const path = require('path');
require('dotenv').config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Map surfaces/actions to the most relevant skills
const SURFACE_SKILL_MAP = {
    github:  ['claude-api'],
    slack:  ['claude-api'],
    ui: ['branding-guidelines', 'claude-api'],
    css: ['branding-guidelines', 'claude-api'],
    design: ['branding-guidelines'],
    handbook: ['document-reader', 'claude-api'],
};

/**
 * Determine which skills to load based on action content and surface.
 * @param {string} action
 * @param {string} surface
 * @returns {string[]} skill names
 */
function inferSkills(action, surface) {
    const lowerAction = action.toLowerCase();
    const surfaceSkills = SURFACE_SKILL_MAP[surface] || ['claude-api'];

    // Also check action content for UI-related keywords
    const uiKeywords = ['css', 'color', 'font', 'style', 'class', 'tailwind', 'design', 'ui', 'component'];
    if (uiKeywords.some(kw => lowerAction.includes(kw))) {
        return [...new Set([...surfaceSkills, 'branding-guidelines'])];
    }

    // Check for document/handbook references
    const docKeywords = ['handbook', 'policy', 'pdf', 'docx', 'manual', 'guidelines'];
    if (docKeywords.some(kw => lowerAction.includes(kw))) {
        return [...new Set([...surfaceSkills, 'document-reader'])];
    }

    return surfaceSkills;
}

/**
 * Fetch the relevant GDPR/PIPEDA clause for a specific action using Claude 3.5 Sonnet.
 * Optionally inject Anthropic skills to specialize the analysis.
 *
 * @param {string} action - user action description
 * @param {string} surface - target platform (github, slack, ui, css, etc.)
 * @param {string[]} [skills] - optional explicit skill names to inject; auto-inferred if not provided
 * @returns {Promise<string>} Policy clause description
 */
const getRelevantPolicy = async (action, surface, skills = null) => {
    try {
        // 1. Determine which skills to load
        const skillNames = skills || inferSkills(action, surface);
        const skillBlock = loadSkills(skillNames);

        // 2. Build skill-enhanced system prompt
        const baseSystem = `You are a compliance officer for Praesidia Sovereign Sentinel.
Identify the most relevant GDPR, PIPEDA, HIPAA, or SOC2 regulatory clause that applies to the analyzed action.
Return only the specific clause name and a brief 1-sentence description of the rule.`;

        const systemPrompt = skillBlock
            ? `${baseSystem}\n\n${skillBlock}`
            : baseSystem;

        // 3. Build user prompt
        const prompt = `Analyze the following user action on ${surface}: "${action}".
${skillNames.includes('branding-guidelines') ? 'Also evaluate any brand/design compliance issues.' : ''}
Return the most relevant policy clause.`;

        // 4. Call Claude
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 300,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
        });

        const result = response.content[0].text;
        if (skillNames.length > 0) {
            console.log(`[PolicyBrain] ✅ Skills used: ${skillNames.join(', ')}`);
        }
        return result;

    } catch (error) {
        console.error('Policy Brain Error:', error.message);
        return 'General Data Protection Regulation (GDPR) Article 5 — Principles relating to processing of personal data.';
    }
};

/**
 * Analyze a UI/CSS push specifically with the branding-guidelines skill.
 * @param {string} cssContent - The CSS/component code being pushed
 * @returns {Promise<{ score: number, violations: string[], summary: string }>}
 */
const analyzeBrandCompliance = async (cssContent) => {
    try {
        const skillBlock = loadSkills(['branding-guidelines']);

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 600,
            system: `You are a Brand Compliance Officer.\n\n${skillBlock}`,
            messages: [{
                role: 'user',
                content: `Analyze this CSS/UI code for brand violations:\n\n\`\`\`\n${cssContent.substring(0, 3000)}\n\`\`\`\n\nRespond in JSON: { "score": 0-100, "violations": [], "summary": "" }`
            }]
        });

        const raw = response.content[0].text;
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 50, violations: [], summary: raw };
    } catch (err) {
        console.error('[PolicyBrain] Brand analysis error:', err.message);
        return { score: 50, violations: ['Analysis failed'], summary: err.message };
    }
};

/**
 * Cite a corporate handbook section for a violation — PSI-ready output.
 * @param {string} violationDescription
 * @returns {Promise<Object>}
 */
const citeHandbookPolicy = async (violationDescription) => {
    const handbookPath = path.join(__dirname, '..', 'knowledge', 'corporate_handbook.txt');
    return citeFromHandbook(violationDescription, handbookPath);
};

module.exports = {
    getRelevantPolicy,
    analyzeBrandCompliance,
    citeHandbookPolicy,
};
