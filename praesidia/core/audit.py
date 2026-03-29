"""
Praesidia Audit Logger
SQLite audit trail at ~/.praesidia/audit.db
Never stores raw PII — only hashes.
"""

import csv
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .user_registry import ensure_users_table


DEFAULT_DB_PATH = os.path.expanduser("~/.praesidia/audit.db")

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS events (
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
)
"""


def _get_db_path() -> str:
    return os.environ.get("AUDIT_DB_PATH", DEFAULT_DB_PATH)


def _ensure_db(db_path: Optional[str] = None) -> str:
    """Ensure the database directory, events table, and users table exist."""
    path = db_path or _get_db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(CREATE_TABLE_SQL)
    conn.commit()
    conn.close()
    # Also ensure users table exists
    ensure_users_table(path)
    return path


def _connect(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = _ensure_db(db_path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def log_event(event_dict: Dict[str, Any], db_path: Optional[str] = None) -> str:
    """
    Insert an audit event. Returns the event id.
    """
    event_id = str(uuid.uuid4())
    audit_id = event_dict.get("audit_id", str(uuid.uuid4()))
    timestamp = event_dict.get("timestamp", datetime.utcnow().isoformat() + "Z")

    pii_types = event_dict.get("pii_types", [])
    if isinstance(pii_types, list):
        pii_types = ",".join(pii_types)

    violation_types = event_dict.get("violation_types", [])
    if isinstance(violation_types, list):
        violation_types = ",".join(violation_types)

    conn = _connect(db_path)
    conn.execute(
        """INSERT INTO events
        (id, timestamp, user, manager, source, decision, pii_types, pii_count,
         violation_types, harvey_confidence, original_hash, scrubbed_content,
         harvey_response, suggested_rewrite, sms_sent, audit_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            event_id,
            timestamp,
            event_dict.get("user"),
            event_dict.get("manager"),
            event_dict.get("source"),
            event_dict.get("decision"),
            pii_types,
            event_dict.get("pii_count", 0),
            violation_types,
            event_dict.get("harvey_confidence"),
            event_dict.get("original_hash"),
            event_dict.get("scrubbed_content"),
            event_dict.get("harvey_response"),
            event_dict.get("suggested_rewrite"),
            1 if event_dict.get("sms_sent") else 0,
            audit_id,
        ),
    )
    conn.commit()
    conn.close()
    return event_id


def update_event(audit_id: str, updates: Dict[str, Any], db_path: Optional[str] = None) -> bool:
    """
    Update an existing event by audit_id.
    Used by Person 3 to write back K2/Harvey results.
    """
    if not updates:
        return False

    allowed_fields = {
        "violation_types", "harvey_confidence", "harvey_response",
        "suggested_rewrite", "sms_sent", "decision",
    }
    filtered = {}
    for k, v in updates.items():
        if k in allowed_fields:
            if k == "violation_types" and isinstance(v, list):
                v = ",".join(v)
            if k == "sms_sent":
                v = 1 if v else 0
            filtered[k] = v

    if not filtered:
        return False

    set_clause = ", ".join(f"{k} = ?" for k in filtered)
    values = list(filtered.values()) + [audit_id]

    conn = _connect(db_path)
    cursor = conn.execute(
        f"UPDATE events SET {set_clause} WHERE audit_id = ?",
        values,
    )
    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    return updated


def get_events(
    filters: Optional[Dict[str, Any]] = None,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieve audit events with optional filters.
    """
    conn = _connect(db_path)
    query = "SELECT * FROM events WHERE 1=1"
    params = []

    if filters:
        if "user" in filters:
            query += " AND user = ?"
            params.append(filters["user"])
        if "source" in filters:
            query += " AND source = ?"
            params.append(filters["source"])
        if "decision" in filters:
            query += " AND decision = ?"
            params.append(filters["decision"])
        if "date_from" in filters:
            query += " AND timestamp >= ?"
            params.append(filters["date_from"])
        if "date_to" in filters:
            query += " AND timestamp <= ?"
            params.append(filters["date_to"])
        if "violation_type" in filters:
            query += " AND violation_types LIKE ?"
            params.append(f"%{filters['violation_type']}%")

    query += " ORDER BY timestamp DESC"

    cursor = conn.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def export_csv(filepath: str, db_path: Optional[str] = None) -> int:
    """Export all events to CSV. Returns number of rows exported."""
    events = get_events(db_path=db_path)
    if not events:
        return 0

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=events[0].keys())
        writer.writeheader()
        writer.writerows(events)

    return len(events)


def get_stats(db_path: Optional[str] = None) -> Dict[str, Any]:
    """Return summary statistics for the dashboard."""
    conn = _connect(db_path)

    stats = {}

    row = conn.execute("SELECT COUNT(*) as total FROM events").fetchone()
    stats["total_events"] = row["total"]

    row = conn.execute("SELECT COUNT(*) as c FROM events WHERE decision = 'APPROVED'").fetchone()
    stats["approved"] = row["c"]

    row = conn.execute("SELECT COUNT(*) as c FROM events WHERE decision = 'BLOCKED'").fetchone()
    stats["blocked"] = row["c"]

    row = conn.execute("SELECT COUNT(*) as c FROM events WHERE decision = 'CANCELLED'").fetchone()
    stats["cancelled"] = row["c"]

    row = conn.execute("SELECT COUNT(*) as c FROM events WHERE sms_sent = 1").fetchone()
    stats["sms_sent"] = row["c"]

    row = conn.execute("SELECT COUNT(*) as c FROM events WHERE violation_types IS NOT NULL AND violation_types != ''").fetchone()
    stats["violations_found"] = row["c"]

    rows = conn.execute("SELECT source, COUNT(*) as c FROM events GROUP BY source").fetchall()
    stats["by_source"] = {row["source"]: row["c"] for row in rows if row["source"]}

    rows = conn.execute("SELECT decision, COUNT(*) as c FROM events GROUP BY decision").fetchall()
    stats["by_decision"] = {row["decision"]: row["c"] for row in rows if row["decision"]}

    rows = conn.execute("SELECT * FROM events ORDER BY timestamp DESC LIMIT 10").fetchall()
    stats["recent"] = [dict(row) for row in rows]

    conn.close()
    return stats
