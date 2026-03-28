"""
Praesidia Human Approval Gate
Handles approval decisions and never stores raw PII.
"""

import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from .audit import log_event
from .scrubber import Finding


class Decision(str, Enum):
    APPROVED = "APPROVED"
    CANCELLED = "CANCELLED"
    EDIT = "EDIT"


APPROVAL_THRESHOLD = 0.7


@dataclass
class GateResult:
    decision: Decision
    timestamp: str
    user: str
    findings: List[Finding]
    original_hash: str
    audit_id: str
    source: str
    manager: Optional[str] = None


def requires_approval(findings: List[Finding]) -> bool:
    """Return True if any finding has confidence > 0.7."""
    return any(f.score > APPROVAL_THRESHOLD for f in findings)


def _hash_original(text: str) -> str:
    """SHA256 hash of original content. Never store raw PII."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def process_decision(
    decision: str,
    user: str,
    findings: List[Finding],
    original: str,
    source: str,
    manager: Optional[str] = None,
    channel: Optional[str] = None,
    scrubbed_content: Optional[str] = None,
    db_path: Optional[str] = None,
) -> GateResult:
    """
    Process a human gate decision.

    Args:
        decision: "APPROVED", "CANCELLED", or "EDIT"
        user: username of the person making the decision
        findings: list of PII findings from scrubber
        original: raw original text (will be hashed, never stored)
        source: "slack", "teams", "jira", "github"
        manager: manager username for escalation
        channel: source channel/repo name
        scrubbed_content: text with PII replaced
        db_path: optional override for audit DB path
    """
    decision_enum = Decision(decision.upper())
    timestamp = datetime.utcnow().isoformat() + "Z"
    original_hash = _hash_original(original)
    audit_id = str(uuid.uuid4())

    pii_types = list(set(f.entity_type for f in findings))

    # Log to audit trail
    log_event(
        {
            "user": user,
            "manager": manager,
            "source": source,
            "decision": decision_enum.value,
            "pii_types": pii_types,
            "pii_count": len(findings),
            "original_hash": original_hash,
            "scrubbed_content": scrubbed_content or "",
            "audit_id": audit_id,
            "timestamp": timestamp,
        },
        db_path=db_path,
    )

    return GateResult(
        decision=decision_enum,
        timestamp=timestamp,
        user=user,
        findings=findings,
        original_hash=original_hash,
        audit_id=audit_id,
        source=source,
        manager=manager,
    )


def build_person3_payload(
    gate_result: GateResult,
    scrubbed_content: str,
    source_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build the interface contract payload for Person 3.
    """
    pii_detected = list(set(f.entity_type for f in gate_result.findings))
    pii_findings = []
    for f in gate_result.findings:
        # Redact: show first 2 and last 2 chars
        text = f.text
        if len(text) <= 4:
            redacted = "*" * len(text)
        else:
            redacted = text[:2] + "*" * (len(text) - 4) + text[-2:]

        pii_findings.append({
            "type": f.entity_type,
            "score": f.score,
            "redacted_text": redacted,
        })

    payload = {
        "source": gate_result.source,
        "author": gate_result.user,
        "manager": gate_result.manager or "",
        "scrubbed_content": scrubbed_content,
        "original_hash": gate_result.original_hash,
        "pii_detected": pii_detected,
        "pii_findings": pii_findings,
        "human_approved": gate_result.decision == Decision.APPROVED,
        "approval_timestamp": gate_result.timestamp,
        "audit_id": gate_result.audit_id,
        "high_risk_files": [],
        "semantic_changes": [],
    }

    if source_data:
        payload["high_risk_files"] = source_data.get("high_risk_files", [])
        payload["semantic_changes"] = source_data.get("semantic_changes", [])

    return payload
