"""
Praesidia Semantic Chunker
Triages files by risk level, summarizes changes, and builds context for K2.
"""

import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from .diff_parser import ParsedFile
from ..core.scrubber import Finding


class RiskLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


# Filename patterns that indicate high risk
HIGH_RISK_PATTERNS = [
    "config", "env", "auth", "login", "permission", "user",
    "patient", "customer", "billing", "payment", "price",
    "secret", "key", "credential", "token", "password",
    "cert", "certificate", "private", "sensitive", "personal",
    "medical", "health",
]

# Extensions that indicate high risk
HIGH_RISK_EXTENSIONS = {
    ".env", ".config", ".json", ".yaml", ".yml",
    ".pem", ".key", ".cert", ".p12",
}


@dataclass
class TriageResult:
    high_risk: List[ParsedFile] = field(default_factory=list)
    low_risk: List[ParsedFile] = field(default_factory=list)
    risk_reasons: Dict[str, List[str]] = field(default_factory=dict)


def _check_filename_risk(filename: str) -> List[str]:
    """Check if a filename matches high-risk patterns."""
    reasons = []
    full_lower = filename.lower()

    for pattern in HIGH_RISK_PATTERNS:
        if pattern in full_lower:
            reasons.append(f"filename contains '{pattern}'")
            break

    return reasons


def _check_extension_risk(extension: str) -> List[str]:
    """Check if a file extension indicates high risk."""
    if extension.lower() in HIGH_RISK_EXTENSIONS:
        return [f"high-risk extension: {extension}"]
    return []


def _check_presidio_risk(filename: str, findings: List[Finding]) -> List[str]:
    """Check if Presidio flagged this file."""
    reasons = []
    file_findings = [f for f in findings if f.filename == filename]
    if file_findings:
        types = set(f.entity_type for f in file_findings)
        reasons.append(f"PII detected: {', '.join(types)}")
    return reasons


def triage(
    parsed_files: List[ParsedFile],
    presidio_findings: List[Finding],
) -> TriageResult:
    """
    Triage parsed files into HIGH_RISK and LOW_RISK categories.
    """
    result = TriageResult()

    for pf in parsed_files:
        reasons = []
        reasons.extend(_check_filename_risk(pf.filename))
        reasons.extend(_check_extension_risk(pf.extension))
        reasons.extend(_check_presidio_risk(pf.filename, presidio_findings))

        if reasons:
            result.high_risk.append(pf)
            result.risk_reasons[pf.filename] = reasons
        else:
            result.low_risk.append(pf)

    return result


def extract_semantic_changes(
    high_risk_files: List[ParsedFile],
    risk_reasons: Optional[Dict[str, List[str]]] = None,
) -> List[Dict[str, Any]]:
    """
    Extract structured summaries of high-risk file changes for K2 analysis.
    """
    changes = []
    for pf in high_risk_files:
        changes.append({
            "file": pf.filename,
            "risk_level": RiskLevel.HIGH.value,
            "risk_reasons": (risk_reasons or {}).get(pf.filename, []),
            "added_lines": pf.added_lines[:50],
            "line_count": pf.line_count_added,
            "extension": pf.extension,
        })
    return changes


def summarize_changes(parsed_files: List[ParsedFile]) -> str:
    """
    Create a human-readable summary of what the code changes do.
    e.g. "Modifies user_handler.py (12 lines), adds config.json (3 lines)"
    """
    if not parsed_files:
        return ""

    parts = []
    for pf in parsed_files:
        if pf.line_count_added > 0 and len(pf.removed_lines) > 0:
            action = "Modifies"
        elif pf.line_count_added > 0:
            action = "Adds to"
        elif len(pf.removed_lines) > 0:
            action = "Removes from"
        else:
            action = "Touches"

        parts.append(f"{action} {pf.filename} (+{pf.line_count_added}/-{len(pf.removed_lines)})")

    return "; ".join(parts)


def build_k2_context(
    semantic_changes: List[Dict[str, Any]],
    commit_message: str,
) -> str:
    """
    Build the prompt context section about code changes for K2 Think V2.
    """
    parts = []
    parts.append(f"COMMIT MESSAGE: {commit_message}")
    parts.append(f"HIGH-RISK FILES CHANGED: {len(semantic_changes)}")
    parts.append("")

    for i, change in enumerate(semantic_changes, 1):
        parts.append(f"--- File {i}: {change['file']} ---")
        parts.append(f"Risk reasons: {', '.join(change['risk_reasons'])}")
        parts.append(f"Lines added: {change['line_count']}")
        parts.append("Added content (excerpt):")
        for line in change["added_lines"][:20]:
            parts.append(f"  {line}")
        if change["line_count"] > 20:
            parts.append(f"  ... ({change['line_count'] - 20} more lines)")
        parts.append("")

    return "\n".join(parts)
