#!/bin/bash

# Praesidia Git Guard Installer
# This script sets up a local pre-push hook to enforce AI governance.

PR_SERVER_URL="http://localhost:3000/api/github/intercept"
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Error: Not a git repository."
    exit 1
fi

HOOK_PATH="$REPO_ROOT/.git/hooks/pre-push"

echo "🛡️ Installing Praesidia Git Guard at $HOOK_PATH..."

# Create the pre-push hook script
cat > "$HOOK_PATH" <<EOF
#!/bin/bash

# Praesidia Pre-push AI Governance Hook
# Analyzes git diffs for compliance before pushing to remote.

while read local_ref local_sha remote_ref remote_sha
do
    # Get the diff of current branch compared to remote
    DIFF_CONTENT=\$(git diff \$remote_sha \$local_sha)
    
    # Send diff to local Praesidia server
    # We use a test user ID for now
    RESPONSE=\$(curl -s -X POST "$PR_SERVER_URL" \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer mock_token" \\
        -d "{ \\"action\\": \\"\$DIFF_CONTENT\\", \\"userId\\": \\"auth0|123456789\\" }")

    # Parse verdict from JSON (simple regex)
    VERDICT=\$(echo \$RESPONSE | grep -o '"verdict":"[^"]*' | grep -o '[^"]*$')

    if [ "\$VERDICT" == "DENY" ]; then
        echo "❌ [Praesidia Blocked]: AI Governance violation detected."
        echo "Reasoning: \$(echo \$RESPONSE | grep -o '"reasoning":"[^"]*' | grep -o '[^"]*$')"
        exit 1
    elif [ "\$VERDICT" == "WARN" ]; then
        echo "⚠️ [Praesidia Warning]: Action flagged for review, but allowed."
        echo "Reasoning: \$(echo \$RESPONSE | grep -o '"reasoning":"[^"]*' | grep -o '[^"]*$')"
    else
        echo "✅ [Praesidia Approved]: Compliance check passed."
    fi
done

exit 0
EOF

# Make hook executable
chmod +x "$HOOK_PATH"

echo "✅ Praesidia Git Guard successfully installed. Your pushes are now protected by AI reasoning."
