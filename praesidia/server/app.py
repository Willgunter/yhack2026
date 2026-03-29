"""
Praesidia Flask Server
Serves the approval gate UI and compliance dashboard on port 5001.
"""

import json
import os
import hashlib
from datetime import datetime

from flask import Flask, render_template, request, jsonify

from ..core.audit import log_event, update_event, get_events, get_stats, export_csv
from ..core.gate import process_decision, build_person3_payload, Decision
from ..core.scrubber import Finding, redact_preview
from ..core.notifier import notify_violation, ViolationEvent
from ..core.user_registry import resolve_user, seed_demo_data

app = Flask(__name__, template_folder="templates")

FINDINGS_PATH = "/tmp/praesidia_findings.json"
DECISION_PATH = "/tmp/praesidia_decision"
PERSON3_URL = os.environ.get("PERSON3_ANALYZE_URL", "http://localhost:5002/analyze")

# Node.js K2 Brain server (Person 1's reasoning engine)
K2_BRAIN_URL = os.environ.get("K2_BRAIN_URL", "http://localhost:3000")


def load_findings() -> dict:
    """Read findings from the temp file written by hook.py."""
    if not os.path.exists(FINDINGS_PATH):
        return {"pii_findings": [], "high_risk_files": [], "semantic_changes": [],
                "commit_message": "", "commit_accuracy": {"score": 100, "reasons": []},
                "change_summary": "", "timestamp": "", "total_files_changed": 0,
                "high_risk_count": 0}
    with open(FINDINGS_PATH, "r") as f:
        return json.load(f)


def forward_to_k2_brain(scrubbed_content: str, user_id: str, surface: str = "github") -> dict:
    """
    Forward scrubbed content to the Node.js K2 Brain reasoning engine.
    This is the bridge between Python PII scrubbing and Node.js legal reasoning.
    """
    import requests

    url = f"{K2_BRAIN_URL}/api/{surface}/intercept"
    payload = {
        "action": scrubbed_content,
        "userId": user_id,
    }

    try:
        resp = requests.post(url, json=payload, timeout=30,
                             headers={"Content-Type": "application/json",
                                      "Authorization": "Bearer praesidia_internal"})
        result = resp.json()
        print(f"[K2 Brain] {surface} -> {url}: verdict={result.get('verdict', '?')}")
        return result
    except Exception as e:
        print(f"[K2 Brain] Could not reach {url}: {e}")
        return {"verdict": "WARN", "reasoning": f"K2 Brain unreachable: {e}"}


def forward_to_person3(findings: dict, gate_result_dict: dict):
    """POST findings to Person 3's /analyze endpoint AND K2 Brain."""
    import requests

    payload = {
        "source": "github",
        "author": gate_result_dict.get("user", "unknown"),
        "manager": gate_result_dict.get("manager", ""),
        "scrubbed_content": findings.get("scrubbed_content", ""),
        "original_hash": gate_result_dict.get("original_hash", ""),
        "pii_detected": [f["type"] for f in findings.get("pii_findings", [])],
        "pii_findings": findings.get("pii_findings", []),
        "human_approved": gate_result_dict.get("decision") == "APPROVED",
        "approval_timestamp": gate_result_dict.get("timestamp", ""),
        "audit_id": gate_result_dict.get("audit_id", ""),
        "high_risk_files": findings.get("high_risk_files", []),
        "semantic_changes": findings.get("semantic_changes", []),
        "commit_accuracy": findings.get("commit_accuracy", {}),
        "change_summary": findings.get("change_summary", ""),
    }

    # Forward to Person 3's analyze endpoint
    try:
        resp = requests.post(PERSON3_URL, json=payload, timeout=10)
        print(f"[Person3] Forwarded to {PERSON3_URL}: {resp.status_code}")
    except Exception as e:
        print(f"[Person3] Could not reach {PERSON3_URL}: {e}")

    # Also forward scrubbed content to Node.js K2 Brain for legal reasoning
    scrubbed = findings.get("change_summary", "") or json.dumps(findings.get("semantic_changes", []))
    k2_result = forward_to_k2_brain(
        scrubbed_content=scrubbed,
        user_id=gate_result_dict.get("user", "unknown"),
        surface="github",
    )

    # Log K2 Brain verdict back to audit
    if k2_result.get("verdict") == "DENY" and gate_result_dict.get("audit_id"):
        update_event(gate_result_dict["audit_id"], {
            "violation_types": [k2_result.get("reasoning", "K2 DENY")],
            "harvey_response": json.dumps(k2_result),
        })


# --- Communication pipeline endpoint (Person 1 sends here) ---

@app.route("/scan", methods=["POST"])
def scan_message():
    """
    Receive a message from Person 1's ingestion layer.
    Scrub PII, check if approval needed, notify and forward.
    """
    from ..core.scrubber import scrub
    from ..core.gate import requires_approval

    data = request.get_json()
    if not data or "content" not in data:
        return jsonify({"error": "Missing content"}), 400

    # Scrub the message
    result = scrub(data["content"])
    findings = [
        Finding(
            entity_type=f.entity_type,
            score=f.score,
            text=f.text,
            start=f.start,
            end=f.end,
        )
        for f in result.detected
    ]

    needs_approval = requires_approval(findings)

    if not findings:
        # Clean message — forward to K2 Brain for legal reasoning
        source = data.get("source", "unknown")
        k2_surface = source if source in ("slack", "jira", "github") else "slack"
        k2_result = forward_to_k2_brain(
            scrubbed_content=data["content"],
            user_id=data.get("author", "unknown"),
            surface=k2_surface,
        )
        return jsonify({"status": "clean", "forwarded": True, "k2_verdict": k2_result.get("verdict")})

    # Has findings — notify and return for approval gate
    pii_types = [f.entity_type for f in findings]
    event = ViolationEvent(
        source=data.get("source", "unknown"),
        pii_types=pii_types,
        timestamp=datetime.utcnow().isoformat() + "Z",
        detail=f"PII detected in {data.get('source', 'unknown')} message",
    )
    notify_violation(
        event,
        email=data.get("author_email"),
        slack_user_id=data.get("slack_user_id"),
        jira_username=data.get("jira_username"),
    )

    pii_findings = []
    for f in findings:
        pii_findings.append({
            "type": f.entity_type,
            "score": f.score,
            "redacted_text": redact_preview(f.text),
            "start": f.start,
            "end": f.end,
        })

    return jsonify({
        "status": "needs_review" if needs_approval else "flagged",
        "pii_findings": pii_findings,
        "scrubbed_content": result.scrubbed_text,
        "requires_approval": needs_approval,
    })


# --- Git approval gate endpoints ---

@app.route("/review")
def review():
    """Render the approval gate UI with current findings."""
    findings = load_findings()
    return render_template("review.html", findings=findings)


@app.route("/approve", methods=["POST"])
def approve():
    """Handle approval decision from the review UI."""
    findings = load_findings()
    data = request.get_json() or {}
    user = data.get("user", os.environ.get("USER", "developer"))
    manager = data.get("manager", os.environ.get("MANAGER", "manager"))

    # Write decision for the pre-commit hook to pick up
    with open(DECISION_PATH, "w") as f:
        f.write("APPROVED")

    # Log the approval
    audit_id = log_event({
        "user": user,
        "manager": manager,
        "source": "github",
        "decision": "APPROVED",
        "pii_types": [f["type"] for f in findings.get("pii_findings", [])],
        "pii_count": len(findings.get("pii_findings", [])),
        "original_hash": data.get("original_hash", ""),
        "scrubbed_content": json.dumps(findings),
        "audit_id": data.get("audit_id", ""),
    })

    # Forward to Person 3 with semantic context
    forward_to_person3(findings, {
        "user": user,
        "manager": manager,
        "decision": "APPROVED",
        "original_hash": data.get("original_hash", ""),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "audit_id": audit_id,
    })

    return jsonify({"status": "approved", "audit_id": audit_id})


@app.route("/block", methods=["POST"])
def block():
    """Handle block decision from the review UI."""
    findings = load_findings()
    data = request.get_json() or {}
    user = data.get("user", os.environ.get("USER", "developer"))
    manager = data.get("manager", os.environ.get("MANAGER", "manager"))

    # Write decision for the pre-commit hook to pick up
    with open(DECISION_PATH, "w") as f:
        f.write("BLOCKED")

    # Log the block
    audit_id = log_event({
        "user": user,
        "manager": manager,
        "source": "github",
        "decision": "BLOCKED",
        "pii_types": [f["type"] for f in findings.get("pii_findings", [])],
        "pii_count": len(findings.get("pii_findings", [])),
        "original_hash": data.get("original_hash", ""),
        "scrubbed_content": json.dumps(findings),
        "audit_id": data.get("audit_id", ""),
    })

    # Unified notification (SMS + desktop + platform DM)
    pii_types = [f["type"] for f in findings.get("pii_findings", [])]
    event = ViolationEvent(
        source="github",
        pii_types=pii_types,
        audit_id=audit_id,
        timestamp=datetime.utcnow().isoformat() + "Z",
        detail="Commit blocked by developer",
    )
    notification_results = notify_violation(event, email=user)

    sms_sent = notification_results.get("sms_user", False) or notification_results.get("sms_manager", False)
    if audit_id:
        update_event(audit_id, {"sms_sent": sms_sent})

    return jsonify({"status": "blocked", "audit_id": audit_id, "sms_sent": sms_sent})


# --- Dashboard endpoints ---

@app.route("/dashboard")
def dashboard():
    """Compliance dashboard showing audit events."""
    events = get_events()
    stats = get_stats()
    return render_template("review.html", dashboard=True, events=events, stats=stats)


@app.route("/api/events")
def api_events():
    """API endpoint for audit events (used by dashboard JS)."""
    filters = {}
    if request.args.get("user"):
        filters["user"] = request.args["user"]
    if request.args.get("source"):
        filters["source"] = request.args["source"]
    if request.args.get("decision"):
        filters["decision"] = request.args["decision"]
    if request.args.get("date_from"):
        filters["date_from"] = request.args["date_from"]
    if request.args.get("date_to"):
        filters["date_to"] = request.args["date_to"]

    events = get_events(filters)
    stats = get_stats()
    return jsonify({"events": events, "stats": stats})


@app.route("/api/export")
def api_export():
    """Export audit events to CSV."""
    filepath = "/tmp/praesidia_export.csv"
    count = export_csv(filepath)
    if count == 0:
        return jsonify({"error": "No events to export"}), 404

    from flask import send_file
    return send_file(filepath, as_attachment=True, download_name="praesidia_audit.csv")


@app.route("/api/seed-demo", methods=["POST"])
def api_seed_demo():
    """Seed demo users and events for hackathon judges."""
    user_count = seed_demo_data()
    return jsonify({"status": "ok", "users_seeded": user_count})


@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "version": "0.1"})


def _seed_demo_findings():
    """Write sample findings so /review has data on first run."""
    if os.path.exists(FINDINGS_PATH):
        return
    findings = {
        "pii_findings": [
            {"type": "EMAIL_ADDRESS", "score": 0.95, "redacted": "al**************om",
             "line_number": 12, "filename": "user_data_handler.py"},
            {"type": "US_SSN", "score": 0.99, "redacted": "12*****89",
             "line_number": 24, "filename": "user_data_handler.py"},
            {"type": "AWS_KEY", "score": 0.99, "redacted": "AK**************LE",
             "line_number": 3, "filename": "config.env"},
        ],
        "high_risk_files": [
            {"file": "user_data_handler.py", "risk_level": "HIGH",
             "risk_reasons": ["filename contains 'user'", "PII detected: EMAIL_ADDRESS, US_SSN"]},
            {"file": "config.env", "risk_level": "HIGH",
             "risk_reasons": ["high-risk extension: .env", "PII detected: AWS_KEY"]},
        ],
        "semantic_changes": [
            {"file": "user_data_handler.py", "risk_reasons": ["filename contains 'user'"],
             "added_lines": ['email = "alice@acme.com"', 'ssn = "123-45-6789"'],
             "line_count": 47, "extension": ".py"},
        ],
        "commit_message": "minor updates",
        "commit_accuracy": {
            "score": 23,
            "reasons": ["Message says 'minor' but 47 lines changed across 2 high-risk files",
                         "Auth/user files modified but not mentioned in message"],
        },
        "change_summary": "Adds hardcoded email and SSN to user data handler, exposes AWS credentials in config",
        "timestamp": "2026-03-28T18:30:00Z",
        "total_files_changed": 5,
        "high_risk_count": 2,
    }
    os.makedirs(os.path.dirname(FINDINGS_PATH) or "/tmp", exist_ok=True)
    with open(FINDINGS_PATH, "w") as f:
        json.dump(findings, f, indent=2)


def _seed_demo_events():
    """Insert sample audit events so /dashboard has data on first run."""
    existing = get_events()
    if existing:
        return
    log_event({"user": "alice", "manager": "bob", "source": "slack",
               "decision": "BLOCKED", "pii_types": ["US_SSN", "PERSON"], "pii_count": 2,
               "violation_types": ["SEC Reg FD"], "harvey_confidence": 0.92,
               "original_hash": "abc123",
               "scrubbed_content": "We should not tell investors about the Q3 revenue miss...",
               "suggested_rewrite": "Please consult legal before discussing financial results.",
               "sms_sent": True, "audit_id": "demo-001", "timestamp": "2026-03-28T14:32:00Z"})
    log_event({"user": "alice", "manager": "bob", "source": "github",
               "decision": "BLOCKED", "pii_types": ["EMAIL_ADDRESS", "AWS_KEY"], "pii_count": 3,
               "violation_types": ["GDPR Art 5"], "harvey_confidence": 0.88,
               "original_hash": "def456",
               "scrubbed_content": "user_data_handler.py: hardcoded email in user model",
               "sms_sent": True, "audit_id": "demo-002", "timestamp": "2026-03-28T15:10:00Z"})
    log_event({"user": "bob", "manager": "carol", "source": "jira",
               "decision": "APPROVED", "pii_types": ["PERSON"], "pii_count": 1,
               "original_hash": "ghi789",
               "scrubbed_content": "Ticket mentions [PERSON] in medical context",
               "sms_sent": False, "audit_id": "demo-003", "timestamp": "2026-03-28T16:45:00Z"})
    log_event({"user": "alice", "manager": "bob", "source": "teams",
               "decision": "BLOCKED", "pii_types": ["CREDIT_CARD", "PERSON"], "pii_count": 2,
               "violation_types": ["PCI DSS"], "harvey_confidence": 0.95,
               "original_hash": "jkl012",
               "scrubbed_content": "Shared [CREDIT_CARD] for [PERSON] in Teams channel",
               "suggested_rewrite": "Use secure payment portal instead of sharing card numbers.",
               "sms_sent": True, "audit_id": "demo-004", "timestamp": "2026-03-28T17:20:00Z"})


def create_app():
    """Factory function for creating the Flask app."""
    try:
        seed_demo_data()
        _seed_demo_events()
        _seed_demo_findings()
    except Exception:
        pass
    return app


if __name__ == "__main__":
    try:
        seed_demo_data()
        _seed_demo_events()
        _seed_demo_findings()
    except Exception:
        pass
    port = int(os.environ.get("FLASK_PORT", 5001))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
