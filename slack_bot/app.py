import asyncio
import os
import re
from contextlib import asynccontextmanager, suppress

from dotenv import load_dotenv
from fastapi import FastAPI
from slack_bolt.adapter.socket_mode.aiohttp import AsyncSocketModeHandler
from slack_bolt.app.async_app import AsyncApp

load_dotenv()

SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
SLACK_APP_TOKEN = os.getenv("SLACK_APP_TOKEN")

if not SLACK_BOT_TOKEN or not SLACK_APP_TOKEN:
    raise RuntimeError(
        "Missing Slack credentials. Set SLACK_BOT_TOKEN and SLACK_APP_TOKEN in .env."
    )

DEFAULT_RESPONSE = "Hello, I am running."
HELLO_PATTERN = re.compile(r"\bhello\b", re.IGNORECASE)

# Async Bolt app used to register Slack listeners.
slack_app = AsyncApp(token=SLACK_BOT_TOKEN)


def should_reply_to_message(event: dict) -> bool:
    """Reply only to human-authored messages containing the word 'hello'."""
    if event.get("subtype") is not None or event.get("bot_id"):
        return False

    text = event.get("text") or ""

    # Let the app_mention handler handle explicit @bot messages so we avoid duplicates.
    if "<@" in text:
        return False

    return bool(HELLO_PATTERN.search(text))


@slack_app.event("app_mention")
async def handle_app_mention(say):
    # Reply whenever the bot is mentioned in a channel.
    await say(DEFAULT_RESPONSE)


@slack_app.event("message")
async def handle_message_events(body, say):
    event = body.get("event", {})

    if should_reply_to_message(event):
        await say(DEFAULT_RESPONSE)


socket_mode_handler: AsyncSocketModeHandler | None = None
socket_mode_task: asyncio.Task[None] | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global socket_mode_handler, socket_mode_task

    # Start the Slack Socket Mode connection alongside the FastAPI app.
    socket_mode_handler = AsyncSocketModeHandler(slack_app, SLACK_APP_TOKEN)
    socket_mode_task = asyncio.create_task(socket_mode_handler.start_async())

    try:
        yield
    finally:
        if socket_mode_handler is not None:
            await socket_mode_handler.close_async()
        if socket_mode_task is not None:
            socket_mode_task.cancel()
            with suppress(asyncio.CancelledError):
                await socket_mode_task


app = FastAPI(title="Slack MVP", lifespan=lifespan)


@app.get("/healthz")
async def healthz():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
