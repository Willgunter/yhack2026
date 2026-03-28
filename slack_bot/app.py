"""
Praesidia Slack Monitor
Monitors the user's own Slack messages via user token (not a bot).
Scrubs PII locally via Presidio, forwards scrubbed content to K2 Brain,
and sends desktop notifications when violations are detected.

No bot in the workspace. No extension needed. Works across all Slack clients.
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
POLL_INTERVAL = 2  # seconds between Slack API polls


def load_user_token() -> dict:
    """Load Slack user token from file (written by OAuth flow) or env vars."""
    token = os.getenv("SLACK_USER_TOKEN", "")
    user_id = os.getenv("SLACK_USER_ID", "")

    # Try token file if env vars not set
    if not token and os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            data = json.load(f)
            token = data.get("bot_token", "")  # stored under bot_token key
            user_id = data.get("authed_user_id", "")

    if not token:
        print("[Praesidia] No Slack user token found.")
        print(f"  Connect via: https://praesidia.dev/api/slack/install?session=YOUR_SESSION")
        return {}

    return {"token": token, "user_id": user_id}


SLACK_CREDS = load_user_token()


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


# --- Desktop Notification ---

def send_desktop_notification(title: str, message: str):
    """Send a native OS desktop notification."""
    try:
        from plyer import notification
        notification.notify(
            title=title,
            message=message[:256],  # OS limit
            app_name="Praesidia",
            timeout=10,
        )
    except Exception:
        # Fallback: console
        print(f"\n[DESKTOP NOTIFICATION] {title}: {message}\n")


# --- Message Poller ---

class SlackMonitor:
    """Polls Slack conversations for the user's own messages and runs them through the pipeline."""

    def __init__(self, token: str, user_id: str):
        self.token = token
        self.user_id = user_id
        self.seen_timestamps: set = set()  # Track processed messages
        self.channels: list = []
        self._running = False

    async def _slack_get(self, method: str, params: dict = {}) -> dict:
        """Call a Slack Web API method."""
        url = f"https://slack.com/api/{method}"
        headers = {"Authorization": f"Bearer {self.token}"}
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as resp:
                return await resp.json()

    async def _fetch_channels(self):
        """Get list of channels the user is in."""
        result = await self._slack_get("conversations.list", {
            "types": "public_channel,private_channel,im,mpim",
            "limit": "200",
        })
        if result.get("ok"):
            self.channels = [ch["id"] for ch in result.get("channels", [])]
            print(f"[Monitor] Watching {len(self.channels)} channels")

    async def _check_channel(self, channel_id: str):
        """Check a channel for new messages from this user."""
        result = await self._slack_get("conversations.history", {
            "channel": channel_id,
            "limit": "5",  # Only recent messages
        })
        if not result.get("ok"):
            return

        for msg in result.get("messages", []):
            ts = msg.get("ts", "")

            # Skip: already processed
            if ts in self.seen_timestamps:
                continue

            # Skip: not from this user
            if msg.get("user") != self.user_id:
                continue

            # Skip: has subtype (joins, edits, etc.)
            if msg.get("subtype"):
                continue

            text = msg.get("text", "")

            # Skip: short messages
            if len(text) < MIN_MESSAGE_LENGTH:
                self.seen_timestamps.add(ts)
                continue

            self.seen_timestamps.add(ts)
            await self._process_message(text, channel_id)

    async def _process_message(self, text: str, channel: str):
        """Core pipeline: scrub → K2 → desktop notification if needed → log."""
        timestamp = datetime.utcnow().isoformat() + "Z"

        # 1. Scrub PII locally via Presidio
        result = scrub(text)
        pii_types = [f.entity_type for f in result.detected]
        original_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

        # 2. Send scrubbed text to K2 Brain
        k2_response = await call_k2(result.scrubbed_text, self.user_id)
        verdict = k2_response.get("verdict", "ALLOW")

        # 3. Desktop notification if K2 says DENY or WARN
        if verdict in ("DENY", "WARN"):
            reasoning = k2_response.get("reasoning", "Potential compliance violation")
            pii_str = f" | PII: {', '.join(set(pii_types))}" if pii_types else ""

            send_desktop_notification(
                f"Praesidia: {verdict}",
                f"Your Slack message was flagged.\n{reasoning[:150]}{pii_str}",
            )

        # 4. Log to audit trail
        try:
            log_event(
                {
                    "user": self.user_id,
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

        # 5. Console output
        status = "FLAGGED" if verdict != "ALLOW" else "CLEAN"
        pii_log = f" | PII: {', '.join(set(pii_types))}" if pii_types else ""
        print(f"[Slack] {status} | verdict={verdict}{pii_log} | {text[:60]}...")

    async def run(self):
        """Main polling loop."""
        self._running = True
        await self._fetch_channels()

        # Seed seen_timestamps with current messages so we don't flag old history
        for ch in self.channels[:10]:  # Check first 10 channels
            try:
                result = await self._slack_get("conversations.history", {
                    "channel": ch, "limit": "10",
                })
                if result.get("ok"):
                    for msg in result.get("messages", []):
                        self.seen_timestamps.add(msg.get("ts", ""))
            except Exception:
                pass

        print(f"[Monitor] Seeded {len(self.seen_timestamps)} existing messages (won't re-scan)")
        print(f"[Monitor] Polling every {POLL_INTERVAL}s for new messages...")

        while self._running:
            for ch in self.channels:
                try:
                    await self._check_channel(ch)
                except Exception as e:
                    pass  # Don't crash on individual channel errors
            await asyncio.sleep(POLL_INTERVAL)

    def stop(self):
        self._running = False


# --- Server Lifecycle ---

monitor: SlackMonitor | None = None
monitor_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global monitor, monitor_task

    if SLACK_CREDS.get("token"):
        monitor = SlackMonitor(SLACK_CREDS["token"], SLACK_CREDS["user_id"])
        monitor_task = asyncio.create_task(monitor.run())
        print("[Praesidia] Slack monitor started (user token mode)")
    else:
        print("[Praesidia] No Slack token — monitor disabled")
        print("  Connect at: https://praesidia.dev/api/slack/install?session=demo")

    try:
        yield
    finally:
        if monitor:
            monitor.stop()
        if monitor_task:
            monitor_task.cancel()
            with suppress(asyncio.CancelledError):
                await monitor_task


app = FastAPI(title="Praesidia Slack Monitor", lifespan=lifespan)


@app.get("/healthz")
async def healthz():
    connected = bool(SLACK_CREDS.get("token"))
    return {
        "ok": True,
        "service": "praesidia-slack-monitor",
        "connected": connected,
        "min_length": MIN_MESSAGE_LENGTH,
        "channels_watched": len(monitor.channels) if monitor else 0,
    }


if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 50)
    print("  Praesidia Slack Monitor")
    print("  Mode: User token (no bot)")
    print(f"  Min message length: {MIN_MESSAGE_LENGTH} chars")
    print(f"  K2 Brain: {K2_BRAIN_URL}")
    print(f"  Audit DB: {AUDIT_DB_PATH}")
    print(f"  Poll interval: {POLL_INTERVAL}s")
    print("=" * 50 + "\n")

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
