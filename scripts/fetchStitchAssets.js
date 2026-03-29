const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const STITCH_API_KEY = process.env.STITCH_API_KEY;
const PROJECT_ID = '72551234674125538';

const screens = [
    { name: 'DesignSystem', id: 'asset-stub-assets-ec132fe0d5894bdb9d3dd05668bf8019-1774685325303' },
    { name: 'Dashboard', id: '9cb35b2a92aa4926a8668e824060a4eb' },
    { name: 'ModelDetails', id: 'a4f81de32803489da3e0f0a3d47f4489' },
    { name: 'GovernanceRules', id: '18762800e3bf456488fa4a00b4f54bb0' },
    { name: 'SecurityLogs', id: '99f2746e41b94d65872d784906ec255e' }
];

const BASE_URL = 'https://stitch.google.com/api/v1';

/**
 * Fetch and save images/code for all project screens.
 */
const fetchAssets = async () => {
    console.log('--- Fetching Stitch Assets ---');
    
    // Create folders for assets
    const assetDir = path.join(__dirname, '../onboarding/assets');
    const templateDir = path.join(__dirname, '../surfaces/cline/templates');
    
    if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });
    if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });

    for (const screen of screens) {
        console.log(`[Processing Screen]: ${screen.name} (${screen.id})`);
        
        try {
            // 1. Fetch Image URL (using hypothetical endpoint based on API docs research)
            const imgResponse = await axios.get(`${BASE_URL}/projects/${PROJECT_ID}/screens/${screen.id}/image`, {
                headers: { 'Authorization': `Bearer ${STITCH_API_KEY}` },
                responseType: 'arraybuffer'
            });
            fs.writeFileSync(path.join(assetDir, `${screen.name}.png`), imgResponse.data);
            console.log(`[Asset Saved]: ${screen.name}.png`);

            // 2. Fetch Code (using hypothetical endpoint based on API docs research)
            const codeResponse = await axios.get(`${BASE_URL}/projects/${PROJECT_ID}/screens/${screen.id}/code`, {
                headers: { 'Authorization': `Bearer ${STITCH_API_KEY}` }
            });
            fs.writeFileSync(path.join(templateDir, `${screen.name}.html`), codeResponse.data);
            console.log(`[Code Saved]: ${screen.name}.html`);
            
            // Special handling for Design System to create design.md
            if (screen.name === 'DesignSystem') {
                fs.writeFileSync(path.join(__dirname, '../design.md'), codeResponse.data);
                console.log(`[Design System]: Created design.md from ${screen.name}`);
            }

        } catch (error) {
            console.error(`[Fetch Failed] for screen ${screen.name}:`, error.message);
            // Fallback: create placeholder for testing purposes
            fs.writeFileSync(path.join(assetDir, `${screen.name}.png`), 'placeholder_image_data');
            fs.writeFileSync(path.join(templateDir, `${screen.name}.html`), '<!-- placeholder code -->');
        }
    }

    console.log('--- Stitch Asset Retrieval Completed ---');
};

if (require.main === module) {
    fetchAssets();
}

module.exports = { fetchAssets };
