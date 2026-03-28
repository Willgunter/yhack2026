"""
Praesidia Slack Bot
Intercepts messages, scrubs PII locally via Presidio,
forwards scrubbed content to K2 Brain for legal/policy analysis,
and DMs users when violations are detected.
"""

import asyncio
import hashlib
import json
import os
import sys
from contextlib import asynccontextmanager, suppress
from datetime import datetime

import aiohttp
from dotenv import load_dotenv
from fastapi import FastAPI
from slack_bolt.adapter.socket_mode.aiohttp import AsyncSocketModeHandler
from slack_bolt.app.async_app import AsyncApp

# Add parent dir so we can import praesidia modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from praesidia.core.scrubber import scrub
from praesidia.core.audit import log_event

load_dotenv()

# --- Config ---
MIN_MESSAGE_LENGTH = 50
K2_BRAIN_URL = os.getenv("K2_BRAIN_URL", "http://localhost:3000")
AUDIT_DB_PATH = os.getenv("AUDIT_DB_PATH", os.path.expanduser("~/.praesidia/audit.db"))
TOKEN_FILE = os.path.expanduser("~/.praesidia/slack_tokens.json")


def load_tokens():
    """Load Slack tokens from file (written by OAuth flow) or env vars."""
    bot_token = os.getenv("SLACK_BOT_TOKEN")
    app_token = os.getenv("SLACK_APP_TOKEN")

    # Try token file if env vars not set
    if not bot_token and os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            tokens = json.load(f)
            bot_token = tokens.get("bot_token", "")
            app_token = tokens.get("app_token", "")

    if not bot_token:
        print("[Praesidia] No Slack tokens found.")
        print(f"  Set SLACK_BOT_TOKEN/SLACK_APP_TOKEN in .env")
        print(f"  Or connect via OAuth: https://praesidia.dev/api/slack/install?session=YOUR_SESSION")
        raise RuntimeError("Missing Slack credentials")

    return bot_token, app_token


BOT_TOKEN, APP_TOKEN = load_tokens()
slack_app = AsyncApp(token=BOT_TOKEN)


# --- K2 Brain Client ---

async def call_k2(scrubbed_text: str, user_id: str) -> dict:
    """Send scrubbed content to K2 Brain for legal/policy analysis."""
    url = f"{K2_BRAIN_URL}/api/slack/intercept"
    payload = {"action": scrubbed_text, "userId": user_id}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    body = await resp.text()
                    print(f"[K2] Error {resp.status}: {body[:200]}")
                    return {"verdict": "ALLOW", "reasoning": "K2 unreachable"}
    except Exception as e:
        print(f"[K2] Connection error: {e}")
        # Fallback: allow message but log the failure
        return {"verdict": "ALLOW", "reasoning": f"K2 unreachable: {e}"}


# --- Alert DM ---

async def send_alert_dm(client, user_id: str, channel: str, k2_response: dict, scrub_result):
    """DM the user with violation details."""
    # Get channel name for context
    channel_name = channel
    try:
        info = await client.conversations_info(channel=channel)
        channel_name = f"#{info['channel']['name']}"
    except Exception:
        pass

    verdict = k2_response.get("verdict", "WARN")
    reasoning = k2_response.get("reasoning", "No details provided")
    thought = k2_response.get("thought_process", "")

    # Build PII summary if any
    pii_section = ""
    if scrub_result.detected:
        types = set(f.entity_type for f in scrub_result.detected)
        pii_section = f"\n:lock: *PII Detected:* {', '.join(types)}\n"

    severity_emoji = ":no_entry:" if verdict == "DENY" else ":warning:"

    message = (
        f":shield: *Praesidia Compliance Alert*\n\n"
        f"Your message in *{channel_name}* was flagged.\n"
        f"{pii_section}\n"
        f"{severity_emoji} *Severity:* {verdict}\n"
        f":speech_balloon: *Reasoning:* {reasoning}\n"
    )

    if thought:
        message += f"\n:mag: *Analysis:* {thought[:300]}{'...' if len(thought) > 300 else ''}\n"

    message += (
        f"\n:bar_chart: This event has been logged.\n"
        f"_Review your message and consider a revision if needed._"
    )

    try:
        await client.chat_postMessage(channel=user_id, text=message)
    except Exception as e:
        print(f"[Alert] Failed to DM {user_id}: {e}")
        # Fallback: print to console
        print("\n" + "=" * 60)
        print("  SLACK DM ALERT (failed to send)")
        print("=" * 60)
        print(f"  To: {user_id}")
        print(f"  {message}")
        print("=" * 60 + "\n")


# --- Message Handler ---

@slack_app.event("app_mention")
async def handle_app_mention(body, say, client):
    """Reply when bot is mentioned directly."""
    event = body.get("event", {})
    text = event.get("text", "")
    user_id = event.get("user", "")

    # Strip the bot mention from the text
    import re
    text = re.sub(r"<@[A-Z0-9]+>", "", text).strip()

    if len(text) < 10:
        await say(":shield: Praesidia is running and monitoring this workspace.")
        return

    # Run the pipeline on the mention text
    await process_message(text, user_id, event.get("channel", ""), client)


@slack_app.event("message")
async def handle_message(body, say, client):
    """Main message handler — runs every message through the pipeline."""
    event = body.get("event", {})

    # Skip: bot messages, message subtypes (edits, joins, etc.)
    if event.get("subtype") is not None or event.get("bot_id"):
        return

    text = event.get("text", "")

    # Skip: short messages (cordial chat)
    if len(text) < MIN_MESSAGE_LENGTH:
        return

    # Skip: messages that are just mentions of other users/channels
    import re
    stripped = re.sub(r"<[@#!][^>]+>", "", text).strip()
    if len(stripped) < MIN_MESSAGE_LENGTH:
        return

    user_id = event.get("user", "")
    channel = event.get("channel", "")

    await process_message(text, user_id, channel, client)


async def process_message(text: str, user_id: str, channel: str, client):
    """Core pipeline: scrub → K2 → alert if needed → log."""
    timestamp = datetime.utcnow().isoformat() + "Z"

    # 1. Scrub PII locally via Presidio
    result = scrub(text)

    pii_types = [f.entity_type for f in result.detected]
    original_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

    # 2. Send scrubbed text to K2 Brain for legal/policy analysis
    k2_response = await call_k2(result.scrubbed_text, user_id)

    verdict = k2_response.get("verdict", "ALLOW")

    # 3. Only alert if K2 says DENY or WARN
    if verdict in ("DENY", "WARN"):
        await send_alert_dm(client, user_id, channel, k2_response, result)

    # 4. Log everything to audit trail (regardless of verdict)
    try:
        log_event(
            {
                "user": user_id,
                "source": "slack",
                "decision": verdict,
                "pii_types": pii_types,
                "pii_count": len(result.detected),
                "original_hash": original_hash,
                "scrubbed_content": result.scrubbed_text,
                "violation_types": [k2_response.get("reasoning", "")]
                if verdict != "ALLOW" else [],
                "harvey_confidence": k2_response.get("level", 0),
                "harvey_response": json.dumps(k2_response)[:500],
                "timestamp": timestamp,
            },
            db_path=AUDIT_DB_PATH,
        )
    except Exception as e:
        print(f"[Audit] Failed to log: {e}")

    # 5. Console output for demo visibility
    status = "FLAGGED" if verdict != "ALLOW" else "CLEAN"
    pii_str = f" | PII: {', '.join(set(pii_types))}" if pii_types else ""
    print(f"[Slack] {status} | user={user_id} | verdict={verdict}{pii_str}")


# --- Server Lifecycle ---

socket_mode_handler: AsyncSocketModeHandler | None = None
socket_mode_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global socket_mode_handler, socket_mode_task

    if APP_TOKEN:
        socket_mode_handler = AsyncSocketModeHandler(slack_app, APP_TOKEN)
        socket_mode_task = asyncio.create_task(socket_mode_handler.start_async())
        print("[Praesidia] Slack bot connected via Socket Mode")
    else:
        print("[Praesidia] No APP_TOKEN — Socket Mode disabled, using events API only")

    try:
        yield
    finally:
        if socket_mode_handler is not None:
            await socket_mode_handler.close_async()
        if socket_mode_task is not None:
            socket_mode_task.cancel()
            with suppress(asyncio.CancelledError):
                await socket_mode_task


app = FastAPI(title="Praesidia Slack Bot", lifespan=lifespan)


@app.get("/healthz")
async def healthz():
    return {"ok": True, "service": "praesidia-slack-bot", "min_length": MIN_MESSAGE_LENGTH}


if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 50)
    print("  Praesidia Slack Bot")
    print("  Min message length: 50 chars")
    print(f"  K2 Brain: {K2_BRAIN_URL}")
    print(f"  Audit DB: {AUDIT_DB_PATH}")
    print("=" * 50 + "\n")

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
