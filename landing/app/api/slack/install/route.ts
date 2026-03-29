import { NextRequest, NextResponse } from "next/server";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || "";
const REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/callback`
  : "https://praesidia.dev/api/slack/callback";

// User token scopes — acts AS the user, not as a bot
const USER_SCOPES = [
  "channels:history",
  "groups:history",
  "im:history",
  "mpim:history",
  "channels:read",
  "groups:read",
  "users:read",
].join(",");

export async function GET(req: NextRequest) {
  const session = req.nextUrl.searchParams.get("session");

  if (!session) {
    return NextResponse.json({ error: "Missing session parameter" }, { status: 400 });
  }

  if (!SLACK_CLIENT_ID) {
    return NextResponse.json({ error: "SLACK_CLIENT_ID not configured" }, { status: 500 });
  }

  const slackUrl = new URL("https://slack.com/oauth/v2/authorize");
  slackUrl.searchParams.set("client_id", SLACK_CLIENT_ID);
  slackUrl.searchParams.set("user_scope", USER_SCOPES);
  slackUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  slackUrl.searchParams.set("state", session);

  return NextResponse.redirect(slackUrl.toString());
}
