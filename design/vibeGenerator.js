const fs = require('fs');
const path = require('path');

/**
 * Extract hex codes and font families from a markdown design system file.
 * @param {string} filePath - Path to design.md
 */
const getDesignTokens = (filePath = path.join(__dirname, '../design.md')) => {
    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`[VibeGenerator]: ${filePath} not found. Using default tokens.`);
            return {
                colors: { primary: '#000000', secondary: '#FFFFFF' },
                fonts: { main: 'Inter, sans-serif' }
            };
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        
        // 1. Extract Hex Codes
        const hexRegex = /#[0-9A-Fa-f]{6}/g;
        const hexCodes = Array.from(new Set(content.match(hexRegex) || []));

        // 2. Extract Font Families
        const fontRegex = /font-family:\s*['"]?([^'"]+)['"]?/g;
        const fontFamilies = Array.from(new Set(
            Array.from(content.matchAll(fontRegex)).map(match => match[1])
        ));

        // 3. Map to Dashbaord Tokens
        const tokens = {
            colors: {
                primary: hexCodes[0] || '#000000',
                secondary: hexCodes[1] || '#FFFFFF',
                accent: hexCodes[2] || '#7C3AED', // Defaulting to a nice purple if 3rd hex missing
                all: hexCodes
            },
            fonts: {
                main: fontFamilies[0] || 'Inter, sans-serif',
                all: fontFamilies
            }
        };

        console.log('[VibeGenerator]: Successfully parsed tokens from design.md');
        return tokens;
    } catch (error) {
        console.error('[VibeGenerator Error]:', error);
        return null;
    }
};

module.exports = {
    getDesignTokens
};
