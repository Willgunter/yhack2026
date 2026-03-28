const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PR_SERVER_URL = "http://127.0.0.1:3005/api/github/intercept";
const TARGET_DIRS = [
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Desktop')
];

const PRE_PUSH_SCRIPT = `#!/bin/bash
# Praesidia Sovereign Pre-push Auto-Guard Hook
while read local_ref local_sha remote_ref remote_sha
do
    DIFF_CONTENT=$(git diff $remote_sha $local_sha)
    
    RESPONSE=$(curl -s -X POST "${PR_SERVER_URL}" \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer mock_token" \\
        -d "{ \\"action\\": \\"$DIFF_CONTENT\\", \\"userId\\": \\"auth0|123456789\\" }")

    VERDICT=$(echo $RESPONSE | grep -o '"verdict":"[^"]*' | grep -o '[^"]*$')

    if [ "$VERDICT" == "DENY" ]; then
        echo "❌ [Sovereign Guard Blocked]: AI Governance violation."
        exit 1
    elif [ "$VERDICT" == "WARN" ]; then
        echo "⚠️ [Sovereign Guard Warning]: Flagged but allowed."
    else
        echo "✅ [Sovereign Guard Approved]."
    fi
done
exit 0
`;

function findGitRepos(dir, gitDirs = []) {
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            
            // Skip huge dirs like node_modules for speed
            if (file === 'node_modules' || file.startsWith('.')) {
                if (file === '.git') gitDirs.push(fullPath);
                continue;
            }

            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                findGitRepos(fullPath, gitDirs);
            }
        }
    } catch (e) {
        // Ignore permission denied folders
    }
    return gitDirs;
}

function injectGitHooksGlobally() {
    console.log('🛡️ Auto-Guard: Scanning for exposed Git repositories...');
    let totalInjected = 0;

    for (const rootDir of TARGET_DIRS) {
        if (!fs.existsSync(rootDir)) continue;
        
        const gits = findGitRepos(rootDir);
        for (const gitDir of gits) {
            const hooksDir = path.join(gitDir, 'hooks');
            if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

            const prePushPath = path.join(hooksDir, 'pre-push');
            
            // Only inject if it doesn't already exist to avoid overriding custom hooks
            if (!fs.existsSync(prePushPath)) {
                fs.writeFileSync(prePushPath, PRE_PUSH_SCRIPT, { mode: 0o755 });
                console.log(`✅ Sovereign Guard Injected: ${gitDir}`);
                totalInjected++;
            }
        }
    }
    console.log(`🛡️ Auto-Guard Complete: ${totalInjected} new repositories protected.`);
}

// Allow script to run directly for manual execution
if (require.main === module) {
    injectGitHooksGlobally();
}

module.exports = { injectGitHooksGlobally };
