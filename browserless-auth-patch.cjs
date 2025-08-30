// Minimal Authentication Patch for Browserless.io
// This patches the existing working deployment to use query parameter auth

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying Browserless Authentication Patch...');

// Find the js-renderer.js file
const jsRendererPath = path.join(__dirname, 'services', 'js-renderer.js');

if (!fs.existsSync(jsRendererPath)) {
    console.error('❌ js-renderer.js not found');
    process.exit(1);
}

// Read current file
let content = fs.readFileSync(jsRendererPath, 'utf8');

// Apply minimal patches
const patches = [
    // Fix 1: Change endpoint from chrome.browserless.io to production-sfo.browserless.io
    {
        find: /chrome\.browserless\.io/g,
        replace: 'production-sfo.browserless.io'
    },
    // Fix 2: Change Bearer token to query parameter
    {
        find: /headers:\s*{\s*'Authorization':\s*`Bearer\s*\$\{[^}]+\}`\s*\}/g,
        replace: ''
    },
    // Fix 3: Update URL to include token as query parameter
    {
        find: /(const\s+browserlessEndpoint\s*=\s*`[^`]+`)(\s*;)/g,
        replace: '$1?token=${this.browserlessToken}$2'
    },
    // Fix 4: Remove Authorization header from fetch calls
    {
        find: /,\s*{\s*method:\s*'POST',\s*headers:\s*{\s*'Authorization':[^}]+\}/g,
        replace: ', { method: \'POST\', headers: { \'Content-Type\': \'application/javascript\' }'
    }
];

let patchedContent = content;
let patchesApplied = 0;

patches.forEach((patch, index) => {
    const before = patchedContent;
    patchedContent = patchedContent.replace(patch.find, patch.replace);
    if (patchedContent !== before) {
        patchesApplied++;
        console.log(`✅ Applied patch ${index + 1}`);
    } else {
        console.log(`⚠️  Patch ${index + 1} - no matches (might already be fixed)`);
    }
});

// Write the patched file
fs.writeFileSync(jsRendererPath + '.patched', patchedContent);
console.log(`🎯 Created patched file: ${jsRendererPath}.patched`);
console.log(`📊 Applied ${patchesApplied} patches`);

// Show key changes
const lines = patchedContent.split('\n');
lines.forEach((line, i) => {
    if (line.includes('production-sfo.browserless.io') || line.includes('?token=')) {
        console.log(`📍 Line ${i + 1}: ${line.trim()}`);
    }
});

console.log('✅ Patch complete - ready for deployment!');