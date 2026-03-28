"""
Praesidia Unified Notification Service
One entry point, multiple channels. Every channel has a console fallback.
"""

import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from .user_registry import resolve_user, get_manager


@dataclass
class ViolationEvent:
    source: str  # "github" | "slack" | "teams" | "jira"
    pii_types: List[str] = field(default_factory=list)
    audit_id: str = ""
    timestamp: str = ""
    detail: str = ""


def notify_violation(
    event: ViolationEvent,
    *,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    git_email: Optional[str] = None,
    slack_user_id: Optional[str] = None,
    teams_user_id: Optional[str] = None,
    jira_username: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, bool]:
    """
    Unified notification entry point.
    Accepts any identity; resolves to user; fans out to all channels.
    Returns {channel: success_bool} for audit logging.
    """
    results = {}

    if not event.timestamp:
        event.timestamp = datetime.utcnow().isoformat() + "Z"

    # 1. Resolve user
    user = resolve_user(
        email=email,
        git_email=git_email,
        slack_user_id=slack_user_id,
        teams_user_id=teams_user_id,
        jira_username=jira_username,
        db_path=db_path,
    )

    if not user:
        # Fallback: can't resolve identity
        _print_notification(
            channel="UNRESOLVED",
            recipient=email or git_email or slack_user_id or "unknown",
            event=event,
            note="Could not resolve user identity in registry",
        )
        results["resolved"] = False
        return results

    results["resolved"] = True

    # 2. Resolve manager
    manager = get_manager(user["id"], db_path=db_path) if user.get("manager_id") else None

    # 3. Desktop notification (git path — user is local)
    if event.source == "github":
        results["desktop"] = _notify_desktop(user, event)

    # 4. SMS to user
    results["sms_user"] = _notify_sms(user, event, is_manager=False)

    # 5. SMS to manager
    if manager:
        results["sms_manager"] = _notify_sms(manager, event, is_manager=True)
    else:
        results["sms_manager"] = False

    # 6. Platform-native DM
    results["platform_dm"] = _notify_platform_dm(user, event)

    # 7. Resend email escalation
    results["email"] = _notify_resend_email(user, manager, event)

    return results


def _notify_desktop(user: Dict[str, Any], event: ViolationEvent) -> bool:
    """Send a native OS desktop notification via plyer."""
    types_str = ", ".join(event.pii_types[:3]) if event.pii_types else "compliance issue"
    title = "Praesidia: Review Required"
    message = f"{types_str} detected in {event.source}. Review needed."

    try:
        from plyer import notification
        notification.notify(
            title=title,
            message=message,
            app_name="Praesidia",
            timeout=10,
        )
        print(f"[Desktop] Notification sent to {user['display_name']}")
        return True
    except Exception as e:
        # Fallback: print to console
        _print_notification(
            channel="DESKTOP",
            recipient=user["display_name"],
            event=event,
            note=f"plyer unavailable: {e}",
        )
        return False


def _notify_sms(
    user: Dict[str, Any],
    event: ViolationEvent,
    is_manager: bool = False,
) -> bool:
    """Send SMS via Twilio. Falls back to console output."""
    phone = user.get("phone", "")
    name = user["display_name"]
    types_str = ", ".join(set(event.pii_types)) if event.pii_types else "compliance issue"
    role = "manager" if is_manager else "author"

    if is_manager:
        # Find who triggered this (the user's report)
        msg = (
            f"Praesidia Alert: A team member triggered a compliance event. "
            f"Detected: {types_str}. Source: {event.source}. "
            f"Time: {event.timestamp}. Review required."
        )
    else:
        msg = (
            f"Praesidia Alert: You triggered a compliance event. "
            f"Detected: {types_str}. Source: {event.source}. "
            f"Time: {event.timestamp}. Review required."
        )

    # Try Twilio
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_FROM_NUMBER")

    if sid and token and from_number and phone:
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            client.messages.create(body=msg, from_=from_number, to=phone)
            print(f"[SMS] Sent to {role} {name} ({phone})")
            return True
        except Exception as e:
            print(f"[SMS] Twilio error for {name}: {e}")

    # Console fallback
    _print_notification(
        channel=f"SMS ({role})",
        recipient=f"{name} ({phone or 'no phone'})",
        event=event,
        note=msg,
    )
    return False


def _notify_platform_dm(user: Dict[str, Any], event: ViolationEvent) -> bool:
    """Send a DM on the originating platform."""
    name = user["display_name"]
    types_str = ", ".join(set(event.pii_types)) if event.pii_types else "compliance issue"

    if event.source == "slack":
        return _notify_slack_dm(user, event, types_str)
    elif event.source == "teams":
        return _notify_teams_dm(user, event, types_str)
    elif event.source == "jira":
        return _notify_jira_comment(user, event, types_str)
    else:
        # github — no platform DM needed (desktop + SMS covers it)
        return False


def _notify_slack_dm(
    user: Dict[str, Any],
    event: ViolationEvent,
    types_str: str,
) -> bool:
    """Send a Slack DM to the user."""
    slack_id = user.get("slack_user_id", "")
    bot_token = os.environ.get("SLACK_BOT_TOKEN", "")

    msg = (
        f":rotating_light: *Praesidia Compliance Alert*\n"
        f"Detected: {types_str}\n"
        f"Source: {event.source}\n"
        f"Time: {event.timestamp}\n"
        f"{event.detail}"
    )

    if slack_id and bot_token:
        try:
            from slack_sdk import WebClient
            client = WebClient(token=bot_token)
            client.chat_postMessage(channel=slack_id, text=msg)
            print(f"[Slack DM] Sent to {user['display_name']} ({slack_id})")
            return True
        except Exception as e:
            print(f"[Slack DM] Error: {e}")

    _print_notification(
        channel="SLACK DM",
        recipient=f"{user['display_name']} ({slack_id or 'no slack ID'})",
        event=event,
        note=msg,
    )
    return False


def _notify_teams_dm(
    user: Dict[str, Any],
    event: ViolationEvent,
    types_str: str,
) -> bool:
    """Teams DM — console fallback for hackathon."""
    _print_notification(
        channel="TEAMS DM",
        recipient=f"{user['display_name']} ({user.get('teams_user_id', 'N/A')})",
        event=event,
        note=f"Detected: {types_str}. Teams bot integration required for production.",
    )
    return False


def _notify_jira_comment(
    user: Dict[str, Any],
    event: ViolationEvent,
    types_str: str,
) -> bool:
    """Jira comment — console fallback for hackathon."""
    _print_notification(
        channel="JIRA COMMENT",
        recipient=f"{user['display_name']} ({user.get('jira_username', 'N/A')})",
        event=event,
        note=f"Detected: {types_str}. Jira API integration required for production.",
    )
    return False


def _notify_resend_email(
    user: Dict[str, Any],
    manager: Optional[Dict[str, Any]],
    event: ViolationEvent,
) -> bool:
    """Send compliance report email via Resend API."""
    import urllib.request
    import urllib.error

    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        print("[Resend] No API key configured — skipping email.")
        return False

    types_str = ", ".join(set(event.pii_types)) if event.pii_types else "compliance issue"
    user_email = user.get("email", "")
    manager_email = manager.get("email", "") if manager else ""

    # Send to manager (or user if no manager)
    to_email = manager_email or user_email
    if not to_email:
        print("[Resend] No email address found — skipping.")
        return False

    html = f"""
    <div style="font-family:Inter,sans-serif;background:#09090b;color:#e4e4e7;padding:32px;border-radius:12px;max-width:600px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #27272a">
        <div style="width:40px;height:40px;background:#ef4444;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px">🛡️</div>
        <div>
          <h1 style="margin:0;font-size:20px;color:#fff">Praesidia Sentinel Alert</h1>
          <p style="margin:0;font-size:13px;color:#71717a">Sovereign Governance Report</p>
        </div>
      </div>
      <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:16px;margin-bottom:16px">
        <p style="margin:0 0 8px;font-size:13px;color:#71717a">VIOLATION DETECTED</p>
        <p style="margin:0;font-size:16px;color:#ef4444;font-weight:600">{types_str}</p>
      </div>
      <table style="width:100%;font-size:14px;color:#a1a1aa;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#71717a">Source</td><td style="color:#e4e4e7;font-weight:500">{event.source}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a">Time</td><td style="color:#e4e4e7">{event.timestamp}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a">Author</td><td style="color:#e4e4e7">{user.get('display_name','Unknown')}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a">Audit ID</td><td style="color:#e4e4e7;font-family:monospace">{event.audit_id or 'N/A'}</td></tr>
      </table>
      {f'<div style="background:#1c1c1e;padding:12px;border-radius:6px;margin-top:16px;font-size:13px;color:#a1a1aa">{event.detail}</div>' if event.detail else ''}
      <p style="margin-top:24px;font-size:12px;color:#52525b">This is an automated report from Praesidia Sovereign Sentinel.</p>
    </div>
    """

    import json
    payload = json.dumps({
        "from": "Praesidia Sentinel <onboarding@resend.dev>",
        "to": [to_email],
        "subject": f"[PSI Alert] {types_str} detected via {event.source}",
        "html": html,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            print(f"[Resend] Email sent to {to_email} — ID: {result.get('id')}")
            return True
    except Exception as e:
        print(f"[Resend] Email failed: {e}")
        return False


def _print_notification(
    channel: str,
    recipient: str,
    event: ViolationEvent,
    note: str = "",
) -> None:
    """Formatted console fallback for all notification channels."""
    types_str = ", ".join(set(event.pii_types)) if event.pii_types else "N/A"
    print()
    print("=" * 60)
    print(f"  PRAESIDIA NOTIFICATION — {channel}")
    print("=" * 60)
    print(f"  To:       {recipient}")
    print(f"  Source:   {event.source}")
    print(f"  Detected: {types_str}")
    print(f"  Time:     {event.timestamp}")
    if event.detail:
        print(f"  Detail:   {event.detail}")
    if note:
        print(f"  Message:  {note}")
    print("=" * 60)
    print()
