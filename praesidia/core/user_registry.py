"""
Praesidia User Registry
Enterprise user management backed by SQLite.
Maps platform identities (Slack, Teams, Git, Jira) to user records.
"""

import os
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional


DEFAULT_DB_PATH = os.path.expanduser("~/.praesidia/audit.db")

CREATE_USERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'developer',
    phone TEXT,
    manager_id TEXT,
    slack_user_id TEXT,
    teams_user_id TEXT,
    git_email TEXT,
    jira_username TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (manager_id) REFERENCES users(id)
)
"""

CREATE_INDEXES_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
    "CREATE INDEX IF NOT EXISTS idx_users_git_email ON users(git_email)",
    "CREATE INDEX IF NOT EXISTS idx_users_slack_id ON users(slack_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_users_jira ON users(jira_username)",
]


def _get_db_path() -> str:
    return os.environ.get("AUDIT_DB_PATH", DEFAULT_DB_PATH)


def ensure_users_table(db_path: Optional[str] = None) -> None:
    """Create the users table and indexes if they don't exist."""
    path = db_path or _get_db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(CREATE_USERS_TABLE_SQL)
    for idx_sql in CREATE_INDEXES_SQL:
        conn.execute(idx_sql)
    conn.commit()
    conn.close()


def _connect(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or _get_db_path()
    ensure_users_table(path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def resolve_user(
    *,
    email: Optional[str] = None,
    git_email: Optional[str] = None,
    slack_user_id: Optional[str] = None,
    teams_user_id: Optional[str] = None,
    jira_username: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Resolve any platform identity to a user record.
    Tries each non-None identifier. Returns dict or None.
    """
    conn = _connect(db_path)

    conditions = []
    params = []

    if email:
        conditions.append("email = ?")
        params.append(email)
    if git_email:
        conditions.append("git_email = ?")
        params.append(git_email)
    if slack_user_id:
        conditions.append("slack_user_id = ?")
        params.append(slack_user_id)
    if teams_user_id:
        conditions.append("teams_user_id = ?")
        params.append(teams_user_id)
    if jira_username:
        conditions.append("jira_username = ?")
        params.append(jira_username)

    if not conditions:
        conn.close()
        return None

    where = " OR ".join(conditions)
    row = conn.execute(
        f"SELECT * FROM users WHERE ({where}) AND active = 1 LIMIT 1",
        params,
    ).fetchone()
    conn.close()

    return dict(row) if row else None


def get_user(user_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch a user by primary key."""
    conn = _connect(db_path)
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_manager(user_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Return the manager record for a given user."""
    user = get_user(user_id, db_path)
    if not user or not user.get("manager_id"):
        return None
    return get_user(user["manager_id"], db_path)


def create_user(
    display_name: str,
    email: str,
    role: str = "developer",
    phone: Optional[str] = None,
    manager_id: Optional[str] = None,
    slack_user_id: Optional[str] = None,
    teams_user_id: Optional[str] = None,
    git_email: Optional[str] = None,
    jira_username: Optional[str] = None,
    user_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> str:
    """Insert a user. Returns user ID."""
    uid = user_id or str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat() + "Z"

    conn = _connect(db_path)
    conn.execute(
        """INSERT OR IGNORE INTO users
        (id, display_name, email, role, phone, manager_id,
         slack_user_id, teams_user_id, git_email, jira_username,
         active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)""",
        (uid, display_name, email, role, phone, manager_id,
         slack_user_id, teams_user_id, git_email, jira_username,
         created_at),
    )
    conn.commit()
    conn.close()
    return uid


def get_all_users(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return all active users."""
    conn = _connect(db_path)
    rows = conn.execute("SELECT * FROM users WHERE active = 1 ORDER BY display_name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# --- Demo Seed Data ---

# Deterministic IDs so manager references are stable across re-runs
DEMO_IDS = {
    "alice": "d0000000-0000-0000-0000-000000000001",
    "bob": "d0000000-0000-0000-0000-000000000002",
    "carol": "d0000000-0000-0000-0000-000000000003",
    "dave": "d0000000-0000-0000-0000-000000000004",
}


def seed_demo_data(db_path: Optional[str] = None) -> int:
    """
    Insert demo users for hackathon judges. Idempotent — skips if users exist.
    Returns number of users created.
    """
    conn = _connect(db_path)
    count = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    conn.close()

    if count > 0:
        return 0

    created = 0

    # Carol Compliance (no manager — top of chain)
    create_user(
        display_name="Carol Compliance",
        email="carol@acme.com",
        role="compliance_officer",
        phone="+15555555555",
        slack_user_id="U_CAROL_DEMO",
        teams_user_id="carol@acme.onmicrosoft.com",
        git_email="carol@acme.com",
        jira_username="carol.compliance",
        user_id=DEMO_IDS["carol"],
        db_path=db_path,
    )
    created += 1

    # Bob Manager (reports to Carol)
    create_user(
        display_name="Bob Manager",
        email="bob@acme.com",
        role="manager",
        phone="+15559876543",
        manager_id=DEMO_IDS["carol"],
        slack_user_id="U_BOB_DEMO",
        teams_user_id="bob@acme.onmicrosoft.com",
        git_email="bob@acme.com",
        jira_username="bob.mgr",
        user_id=DEMO_IDS["bob"],
        db_path=db_path,
    )
    created += 1

    # Alice Developer (reports to Bob)
    create_user(
        display_name="Alice Developer",
        email="alice@acme.com",
        role="developer",
        phone="+15551234567",
        manager_id=DEMO_IDS["bob"],
        slack_user_id="U_ALICE_DEMO",
        teams_user_id="alice@acme.onmicrosoft.com",
        git_email="alice@acme.com",
        jira_username="alice.dev",
        user_id=DEMO_IDS["alice"],
        db_path=db_path,
    )
    created += 1

    # Dave Admin (no manager)
    create_user(
        display_name="Dave Admin",
        email="dave@acme.com",
        role="admin",
        phone="+15550001111",
        slack_user_id="U_DAVE_DEMO",
        teams_user_id="dave@acme.onmicrosoft.com",
        git_email="dave@acme.com",
        jira_username="dave.admin",
        user_id=DEMO_IDS["dave"],
        db_path=db_path,
    )
    created += 1

    return created
