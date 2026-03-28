# Slack MVP

Minimal Slack bot using Python, FastAPI, Slack Bolt, and Socket Mode.

The bot replies with:

`Hello, I am running.`

## Project files

```text
.
├── app.py
├── requirements.txt
├── .env.example
└── README.md
```

## Prerequisites

- Python 3.10+
- A Slack workspace where you can install apps

## 1. Create the Slack app

1. Go to https://api.slack.com/apps
2. Click `Create New App`
3. Choose `From scratch`
4. Give the app a name, select your workspace, and create it

## 2. Enable Socket Mode

1. In the Slack app settings, open `Socket Mode`
2. Turn on `Enable Socket Mode`
3. Create an app-level token with the scope `connections:write`
4. Copy the generated `xapp-...` token for later

## 3. Add bot scopes

1. Open `OAuth & Permissions`
2. Under `Bot Token Scopes`, add:
   - `app_mentions:read`
   - `channels:history`
   - `chat:write`

## 4. Subscribe to events

1. Open `Event Subscriptions`
2. Turn on `Enable Events`
3. Under `Subscribe to bot events`, add:
   - `app_mention`
   - `message.channels`

Socket Mode handles event delivery, so you do not need ngrok or a public request URL.

## 5. Install the app

1. Open `Install App`
2. Click `Install to Workspace`
3. Approve the app
4. Copy the bot token that starts with `xoxb-...`

## 6. Configure local environment

From the project directory:

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-level-token
```

## 7. Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 8. Run the app locally

```bash
uvicorn app:app --reload
```

The FastAPI server starts on `http://127.0.0.1:8000` and the Slack Socket Mode connection starts with it.

## 9. Test locally

1. In Slack, invite the app to a public channel if needed
2. Test a mention:

```text
@MyBot hello
```

3. The bot should reply:

```text
Hello, I am running.
```

4. Test the automatic scan behavior with a normal channel message:

```text
hello team
```

5. The bot should also reply:

```text
Hello, I am running.
```

## Notes

- `GET /healthz` returns a simple health response from FastAPI
- Socket Mode means Slack connects to your app over WebSockets, so no public inbound URL is required
- The bot responds to any `@bot` mention
- The bot also responds to normal public-channel messages when a human sends the standalone word `hello`
- The message scan uses `message.channels`, so it applies to public channels the app can access

## Load company data into Mem0

Install dependencies:

```bash
pip install -r requirements.txt
```

Add these variables to `.env`:

```env
MEM0_API_KEY=your-mem0-api-key
MEM0_ORG_ID=your-mem0-org-id
MEM0_PROJECT_ID=your-mem0-project-id
```

Upload `data.json` into the existing Mem0 project scope:

```bash
python add_company_to_mem0.py
```

If you want to refresh the company memory instead of appending to it:

```bash
python add_company_to_mem0.py --replace-existing
```

If your existing Mem0 company uses a different stable ID than the JSON `org_id`, override it:

```bash
python add_company_to_mem0.py --company-id your-existing-company-id
```
