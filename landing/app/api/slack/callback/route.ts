import { NextRequest, NextResponse } from "next/server";
import { setTokens } from "@/lib/token-store";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || "";
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/callback`
  : "https://praesidia.dev/api/slack/callback";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/connected?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  // Exchange code for tokens
  const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await tokenResponse.json();

  if (!data.ok) {
    console.error("Slack OAuth error:", data.error);
    return NextResponse.redirect(
      new URL(`/connected?error=${encodeURIComponent(data.error || "oauth_failed")}`, req.url)
    );
  }

  // Store user token keyed by session ID
  // User token comes from authed_user.access_token (not top-level access_token)
  const userToken = data.authed_user?.access_token || data.access_token;

  setTokens(state, {
    bot_token: userToken,  // "bot_token" key reused but holds user token
    team_name: data.team?.name || "Workspace",
    team_id: data.team?.id || "",
    authed_user_id: data.authed_user?.id || "",
  });

  // Redirect to success page
  const teamName = encodeURIComponent(data.team?.name || "your workspace");
  return NextResponse.redirect(
    new URL(`/connected?team=${teamName}`, req.url)
  );
}
