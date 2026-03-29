"""
Praesidia Git Hook Scanner
Main entry point called by the pre-commit bash script.
Scans for PII, analyzes semantic changes, checks commit accuracy.
"""

import json
import sys
from datetime import datetime

from .diff_parser import get_staged_diff, parse_diff, get_added_content, get_commit_message
from .semantic_chunker import triage, extract_semantic_changes, summarize_changes
from ..core.scrubber import scrub_diff, redact_preview
from ..core.analyzer import check_commit_accuracy


FINDINGS_PATH = "/tmp/praesidia_findings.json"


def main() -> int:
    """
    Main scanner function.
    1. Get staged diff
    2. Parse and scrub for PII
    3. Triage files by risk level
    4. Extract semantic changes from high-risk files
    5. Check commit message accuracy
    6. Write findings or clear

    Returns 0 if clean, 1 if findings detected.
    """
    # 1. Get staged diff
    diff_text = get_staged_diff()
    if not diff_text.strip():
        print("CLEAR")
        return 0

    # 2. Parse the diff
    parsed_files = parse_diff(diff_text)
    if not parsed_files:
        print("CLEAR")
        return 0

    # 3. Scrub the added content for PII
    scrub_result = scrub_diff(diff_text)

    # 4. Triage files by risk level
    triage_result = triage(parsed_files, scrub_result.detected)

    # 5. Extract semantic changes from high-risk files
    semantic_changes = extract_semantic_changes(
        triage_result.high_risk,
        triage_result.risk_reasons,
    )

    # 6. Get commit message and check accuracy
    commit_message = get_commit_message()
    total_lines = sum(pf.line_count_added for pf in parsed_files)

    accuracy = check_commit_accuracy(
        commit_message=commit_message,
        semantic_changes=semantic_changes,
        total_files_changed=len(parsed_files),
        total_lines_added=total_lines,
    )

    # 7. Determine if anything needs attention
    has_pii = len(scrub_result.detected) > 0
    has_high_risk = len(triage_result.high_risk) > 0
    has_accuracy_issue = accuracy.score < 70

    if not has_pii and not has_high_risk and not has_accuracy_issue:
        print("CLEAR")
        return 0

    # 8. Build findings payload
    pii_findings = []
    for f in scrub_result.detected:
        pii_findings.append({
            "type": f.entity_type,
            "score": round(f.score, 4),
            "redacted": redact_preview(f.text),
            "line_number": f.line_number,
            "filename": f.filename or "unknown",
        })

    high_risk_files = []
    for pf in triage_result.high_risk:
        high_risk_files.append({
            "file": pf.filename,
            "risk_level": "HIGH",
            "risk_reasons": triage_result.risk_reasons.get(pf.filename, []),
        })

    # Human-readable summary of what changed
    change_summary = summarize_changes(parsed_files)

    findings = {
        "pii_findings": pii_findings,
        "high_risk_files": high_risk_files,
        "semantic_changes": [
            {
                "file": sc["file"],
                "risk_level": sc["risk_level"],
                "risk_reasons": sc["risk_reasons"],
                "added_lines": sc["added_lines"],
                "line_count": sc["line_count"],
                "extension": sc["extension"],
            }
            for sc in semantic_changes
        ],
        "commit_message": commit_message,
        "commit_accuracy": {
            "score": accuracy.score,
            "reasons": accuracy.reasons,
        },
        "change_summary": change_summary,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "total_files_changed": len(parsed_files),
        "total_lines_added": total_lines,
        "high_risk_count": len(triage_result.high_risk),
    }

    # 9. Write findings to temp file for the approval gate
    with open(FINDINGS_PATH, "w") as fp:
        json.dump(findings, fp, indent=2)

    # 10. Print summary
    print("BLOCKED")
    if pii_findings:
        print(f"  PII findings: {len(pii_findings)}")
        for pf in pii_findings:
            print(f"    - {pf['type']} ({pf['score']:.0%}) in {pf['filename']}:{pf['line_number'] or '?'}")
    if high_risk_files:
        print(f"  High-risk files: {len(high_risk_files)}")
        for hf in high_risk_files:
            print(f"    - {hf['file']}: {', '.join(hf['risk_reasons'])}")
    if has_accuracy_issue:
        print(f"  Commit message accuracy: {accuracy.score}/100")
        for reason in accuracy.reasons:
            print(f"    - {reason}")
    if change_summary:
        print(f"  Changes: {change_summary}")

    # 11. Desktop notification
    try:
        from ..core.notifier import notify_violation, ViolationEvent
        event = ViolationEvent(
            source="github",
            pii_types=[f["type"] for f in pii_findings],
            timestamp=findings["timestamp"],
            detail=f"{len(pii_findings)} PII findings, {len(high_risk_files)} high-risk files, accuracy {accuracy.score}/100",
        )
        notify_violation(event, git_email=os.environ.get("GIT_AUTHOR_EMAIL", ""))
    except Exception:
        pass  # Don't block commit scanning if notification fails

    return 1


if __name__ == "__main__":
    import os
    sys.exit(main())
