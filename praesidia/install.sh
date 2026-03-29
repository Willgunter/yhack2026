#!/bin/bash
# Praesidia Installer
# One-command setup for the compliance barrier system

set -e

PRAESIDIA_HOME="$HOME/.praesidia"
HOOKS_DIR="$PRAESIDIA_HOME/hooks"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "========================================"
echo "  Praesidia Installer"
echo "  Multiple lines of defense"
echo "========================================"
echo ""

# 1. Check Python version
echo "[1/7] Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]); then
    echo "ERROR: Python 3.11+ required (found $PYTHON_VERSION)"
    echo "Install Python 3.11+ and try again."
    exit 1
fi
echo "  Python $PYTHON_VERSION OK"

# 2. Install Python dependencies
echo ""
echo "[2/7] Installing Python dependencies..."
pip install -r "$SCRIPT_DIR/requirements.txt" --quiet
echo "  Dependencies installed"

# 3. Download spaCy model
echo ""
echo "[3/7] Downloading spaCy language model..."
python3 -m spacy download en_core_web_lg --quiet 2>/dev/null || python3 -m spacy download en_core_web_lg
echo "  spaCy model ready"

# 4. Create directory structure
echo ""
echo "[4/7] Creating Praesidia directories..."
mkdir -p "$PRAESIDIA_HOME"
mkdir -p "$HOOKS_DIR"
echo "  Created $PRAESIDIA_HOME"

# 5. Copy hook files
echo ""
echo "[5/7] Installing git hooks..."
cp "$SCRIPT_DIR/git/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"
git config --global core.hooksPath "$HOOKS_DIR"
echo "  Git hooks installed at $HOOKS_DIR"
echo "  Global hooks path set"

# 6. Initialize database
echo ""
echo "[6/7] Initializing audit database..."
python3 -c "
import sqlite3, os
db_path = os.path.expanduser('~/.praesidia/audit.db')
conn = sqlite3.connect(db_path)
conn.execute('''CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    user TEXT,
    manager TEXT,
    source TEXT,
    decision TEXT,
    pii_types TEXT,
    pii_count INTEGER,
    violation_types TEXT,
    harvey_confidence REAL,
    original_hash TEXT,
    scrubbed_content TEXT,
    harvey_response TEXT,
    suggested_rewrite TEXT,
    sms_sent INTEGER DEFAULT 0,
    audit_id TEXT
)''')
conn.commit()
conn.close()
print('  Database initialized at ~/.praesidia/audit.db')
"

# 7. Create .env if needed
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo "  Created .env from template"
fi

# 8. Start Flask server
echo ""
echo "[7/7] Starting Praesidia server..."
cd "$SCRIPT_DIR"
nohup python3 -m praesidia.server.app > "$PRAESIDIA_HOME/server.log" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$PRAESIDIA_HOME/server.pid"
sleep 2

# Verify server is running
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo "  Server running on http://localhost:5001 (PID: $SERVER_PID)"
else
    echo "  Server started (PID: $SERVER_PID) — may take a moment to warm up"
fi

echo ""
echo "========================================"
echo "  Praesidia installed successfully!"
echo "========================================"
echo ""
echo "  What's set up:"
echo "    - PII/PHI scrubber (Presidio + spaCy)"
echo "    - Git pre-commit hook (global)"
echo "    - Approval gate at http://localhost:5001/review"
echo "    - Dashboard at http://localhost:5001/dashboard"
echo "    - Audit database at ~/.praesidia/audit.db"
echo ""
echo "  Next steps:"
echo "    1. Edit .env with your API keys (Mem0, Harvey, Twilio, Slack)"
echo "    2. Try: git add some_file.py && git commit -m 'test'"
echo "    3. View dashboard: open http://localhost:5001/dashboard"
echo ""
echo "  To stop the server:"
echo "    kill \$(cat ~/.praesidia/server.pid)"
echo ""
