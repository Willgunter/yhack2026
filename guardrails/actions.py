"""
Praesidia NeMo-Claw — Automated Senior Developer Remediation Engine
Executes system-level actions to "hand" violation context directly to the Senior Developer.
"""

import json
import os
import subprocess
import sys
import webbrowser
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class RemediationPayload:
    """Structured output from K2-Think for NeMo-Claw to execute."""
    action: str = "REMEDIATE"           # REMEDIATE | ESCALATE | MONITOR
    violation_id: str = ""
    slack_link: str = ""
    github_link: str = ""
    github_repo: str = ""
    commit_id: str = ""
    line_number: int = 0
    file_path: str = ""
    violation_summary: str = ""
    level: int = 3


# ─────────────────────────────────────────────
# Core Claw Actions
# ─────────────────────────────────────────────

def open_slack(conversation_id: str, slack_link: str = "") -> bool:
    """
    Deep-link directly to the Slack message where the violation occurred.
    Tries the Slack desktop app first, falls back to browser.
    """
    if slack_link:
        url = slack_link
    elif conversation_id:
        workspace = os.environ.get("SLACK_WORKSPACE_DOMAIN", "praesidia")
        url = f"https://{workspace}.slack.com/archives/{conversation_id}"
    else:
        print("[NeMo-Claw] No Slack link or conversation ID provided")
        return False

    print(f"[NeMo-Claw] 🔗 Opening Slack: {url}")
    try:
        # Try Slack deep link first (desktop app)
        slack_deep = url.replace("https://", "slack://")
        webbrowser.open(slack_deep)
        return True
    except Exception as e:
        print(f"[NeMo-Claw] Slack deep link failed, using browser: {e}")
        webbrowser.open(url)
        return True


def open_github_diff(repo_url: str, commit_id: str, line_number: int = 0) -> bool:
    """
    Launch the browser directly to the exact line in the GitHub diff that was flagged.
    """
    if not repo_url or not commit_id:
        print("[NeMo-Claw] Missing repo_url or commit_id")
        return False

    # Build the GitHub commit diff URL
    base = repo_url.rstrip("/")
    url = f"{base}/commit/{commit_id}"
    if line_number:
        url += f"#L{line_number}"

    print(f"[NeMo-Claw] 🔍 Opening GitHub diff: {url}")
    webbrowser.open(url)
    return True


def highlight_violation(file_path: str, line_number: int, violation_summary: str) -> bool:
    """
    Signal the Electron Desktop Agent to draw a teal/cyan glowing rectangle
    over the code editor at the violation line.
    Sends a POST to the local backend which broadcasts via WebSocket.
    """
    import urllib.request

    payload = json.dumps({
        "type": "highlight_violation",
        "file": file_path,
        "line": line_number,
        "summary": violation_summary,
        "color": "#06b6d4",   # Nanobanana Shield teal/cyan
        "animation": "breathing"
    }).encode("utf-8")

    backend_url = os.environ.get("K2_BRAIN_URL", "http://localhost:3005")
    try:
        req = urllib.request.Request(
            f"{backend_url}/api/highlight",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5):
            print(f"[NeMo-Claw] ✨ Highlight signal sent → {file_path}:{line_number}")
            return True
    except Exception as e:
        print(f"[NeMo-Claw] Highlight signal failed (is backend running?): {e}")
        return False


# ─────────────────────────────────────────────
# Orchestration Entry Point
# ─────────────────────────────────────────────

def execute_remediation(payload: RemediationPayload) -> Dict[str, bool]:
    """
    Main NeMo-Claw execution loop.
    K2-Think outputs a RemediationPayload; this function executes all actions simultaneously.

    Returns a results dict: { "slack": bool, "github": bool, "highlight": bool }
    """
    print("\n" + "=" * 60)
    print("  NEMO-CLAW: SENIOR DEVELOPER REMEDIATION PROTOCOL")
    print(f"  Violation: {payload.violation_summary[:80]}")
    print(f"  Level: {payload.level} | Action: {payload.action}")
    print("=" * 60)

    results = {}

    # 1. Open Slack to the exact message
    if payload.slack_link or payload.violation_id:
        results["slack"] = open_slack(
            conversation_id=payload.violation_id,
            slack_link=payload.slack_link,
        )

    # 2. Open GitHub diff at exact line
    if payload.github_repo and payload.commit_id:
        results["github"] = open_github_diff(
            repo_url=payload.github_repo,
            commit_id=payload.commit_id,
            line_number=payload.line_number,
        )

    # 3. Trigger visual highlight overlay on the violation line
    if payload.file_path or payload.line_number:
        results["highlight"] = highlight_violation(
            file_path=payload.file_path or "unknown",
            line_number=payload.line_number,
            violation_summary=payload.violation_summary,
        )

    print("\n[NeMo-Claw] Remediation complete:", results)
    print("=" * 60 + "\n")
    return results


def execute_from_k2_json(k2_output: str) -> Dict[str, bool]:
    """
    Parse K2-Think's JSON output and run NeMo-Claw.
    Expected format:
    {
        "action": "REMEDIATE",
        "slack_link": "https://...",
        "github_link": "https://...",
        "github_repo": "https://github.com/...",
        "commit_id": "abc123",
        "line_number": 42,
        "file_path": "src/config.js",
        "violation_summary": "AWS_SECRET hardcoded in config.js line 42"
    }
    """
    try:
        import re
        # Extract JSON block (K2 may wrap in markdown)
        match = re.search(r"\{[\s\S]*\}", k2_output)
        data = json.loads(match.group()) if match else json.loads(k2_output)
    except Exception as e:
        print(f"[NeMo-Claw] Could not parse K2 JSON: {e}")
        return {}

    payload = RemediationPayload(
        action=data.get("action", "REMEDIATE"),
        violation_id=data.get("violation_id", ""),
        slack_link=data.get("slack_link", ""),
        github_link=data.get("github_link", ""),
        github_repo=data.get("github_repo", os.environ.get("GITHUB_REPO_URL", "")),
        commit_id=data.get("commit_id", ""),
        line_number=int(data.get("line_number", 0)),
        file_path=data.get("file_path", ""),
        violation_summary=data.get("violation_summary", "Unknown violation"),
        level=int(data.get("level", 3)),
    )

    if payload.action not in ("REMEDIATE", "ESCALATE"):
        print(f"[NeMo-Claw] Action '{payload.action}' does not require execution.")
        return {}

    return execute_remediation(payload)


# ─────────────────────────────────────────────
# CLI Entry (for testing)
# ─────────────────────────────────────────────

if __name__ == "__main__":
    test_payload = json.dumps({
        "action": "REMEDIATE",
        "github_repo": "https://github.com/Willgunter/yhack2026",
        "commit_id": "dc50e5710b1fc45ff9",
        "line_number": 42,
        "file_path": "interceptor/k2Brain.js",
        "violation_summary": "AWS_SECRET hardcoded in k2Brain.js — Level 5 breach",
        "slack_link": ""
    })
    print("[NeMo-Claw] Running test remediation...")
    execute_from_k2_json(test_payload)
