const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Define an SVG string representing the Praesidia Shield logo
const svgLogo = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <defs>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#134e5e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#71b280;stop-opacity:1" />
        </linearGradient>
    </defs>
    <!-- Background Shield Base -->
    <path d="M256 32 C132 32 32 80 32 80 L32 256 C32 384 256 480 256 480 C256 480 480 384 480 256 L480 80 C480 80 380 32 256 32 Z" 
          fill="url(#shieldGrad)" />
    <!-- Inner White Highlight -->
    <path d="M256 64 C160 64 64 100 64 100 L64 256 C64 360 256 430 256 430 C256 430 448 360 448 256 L448 100 C448 100 352 64 256 64 Z" 
          fill="#f3f4f6" opacity="0.9" />
    <!-- Diagonal Cross/Shield Accent -->
    <path d="M128 320 L384 192 L384 256 L128 384 Z" fill="#14b8a6" />
    <!-- Secondary Cross/Shield Accent -->
    <path d="M128 192 L384 320 L384 384 L128 256 Z" fill="#0f766e" opacity="0.9" />
</svg>
`;

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, '..', 'extension', 'icons');

async function generateIcons() {
    console.log('🛡️ Generating Praesidia Extension Icons from SVG...');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(iconsDir)){
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    const svgBuffer = Buffer.from(svgLogo);

    for (const size of sizes) {
        const outputPath = path.join(iconsDir, `icon${size}.png`);
        try {
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(outputPath);
            console.log(`✅ Generated: ${outputPath}`);
        } catch (error) {
            console.error(`❌ Failed to generate icon${size}.png:`, error.message);
        }
    }
}

generateIcons().then(() => console.log('🎉 Logo icon generation complete!'));
