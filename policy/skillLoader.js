/**
 * Praesidia Skill Loader
 * Reads SKILL.md files and injects their instructions into Claude system prompts.
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * @param {string} content - Raw SKILL.md content
 * @returns {{ meta: Object, instructions: string }}
 */
function parseSkillMd(content) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
        return { meta:  {}, instructions: content };
    }

    // Simple YAML key: value parser (no external dep needed)
    const meta = {};
    frontmatterMatch[1].split('\n').forEach(line => {
        const [key, ...rest] = line.split(':');
        if (key && rest.length) {
            meta[key.trim()] =  rest.join(':').trim();
        }
    });

    return {
        meta,
        instructions: frontmatterMatch[2].trim()
    };
}

/**
 * Load a skill by name and return its instructions for system prompt injection.
 * @param {string} skillName - e.g. 'branding-guidelines', 'document-reader', 'claude-api'
 * @returns {{ name: string, description: string, systemPromptBlock: string } | null}
 */
function loadSkill(skillName) {
    const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');

    if (!fs.existsSync(skillPath)) {
        console.warn(`[SkillLoader] Skill not found: ${skillName} (${skillPath})`);
        return null;
    }

    try {
        const content = fs.readFileSync(skillPath, 'utf-8');
        const { meta, instructions } = parseSkillMd(content);

        const systemPromptBlock = `
## Activated Skill: ${meta.name || skillName}
${meta.description ? `_${meta.description}_` : ''}

${instructions}
--- END SKILL ---
`.trim();

        console.log(`[SkillLoader] ✅ Loaded skill: ${meta.name || skillName}`);
        return {
            name: meta.name || skillName,
            description: meta.description || '',
            systemPromptBlock
        };
    } catch (err) {
        console.error(`[SkillLoader] Error loading skill ${skillName}:`, err.message);
        return null;
    }
}

/**
 * Load multiple skills and concatenate their system prompt blocks.
 * @param {string[]} skillNames
 * @returns {string} Combined system prompt addition
 */
function loadSkills(skillNames = []) {
    const blocks = [];
    for (const name of skillNames) {
        const skill = loadSkill(name);
        if (skill) {
            blocks.push(skill.systemPromptBlock);
        }
    }
    return blocks.join('\n\n');
}

/**
 * Extract and cite policy from an uploaded document using the document-reader skill.
 * Reads a corporate handbook text file and returns a citation for a given violation.
 * @param {string} violationDescription
 * @param {string} handbookPath - path to .txt extracted content of a PDF/DOCX
 * @returns {Promise<Object>} Citation object from Claude
 */
async function citeFromHandbook(violationDescription, handbookPath) {
    const { Anthropic } = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let handbookContent = '[No handbook found]';
    if (fs.existsSync(handbookPath)) {
        // Read up to 8000 chars to stay within token budget
        const raw = fs.readFileSync(handbookPath, 'utf-8');
        handbookContent = raw.substring(0, 8000);
    }

    const skill = loadSkill('document-reader');
    const systemPrompt = skill
        ? `You are a Corporate Policy Citation Specialist.\n\n${skill.systemPromptBlock}`
        : 'You are a Corporate Policy Citation Specialist.';

    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 500,
            system: systemPrompt,
            messages: [{
                role: 'user',
                content: `VIOLATION: ${violationDescription}\n\nHANDBOOK CONTENT:\n${handbookContent}\n\nCite the exact policy section that applies. Respond in JSON.`
            }]
        });

        const raw = response.content[0].text;
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { psi_citation: raw };
    } catch (err) {
        console.error('[SkillLoader] citeFromHandbook error:', err.message);
        return {
            section: 'Corporate Security Policy',
            page: 'unknown',
            psi_citation: `Intern, your action violates the Corporate Security Policy on ${violationDescription}.`
        };
    }
}

module.exports = { loadSkill, loadSkills, citeFromHandbook };
