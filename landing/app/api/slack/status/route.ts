import { NextRequest, NextResponse } from "next/server";
import { getTokens, hasTokens } from "@/lib/token-store";

export async function GET(req: NextRequest) {
  const session = req.nextUrl.searchParams.get("session");

  if (!session) {
    return NextResponse.json({ error: "Missing session parameter" }, { status: 400 });
  }

  // Check if tokens are ready (without consuming them)
  if (!hasTokens(session)) {
    return NextResponse.json({ status: "pending" });
  }

  // Retrieve and consume tokens (one-time retrieval)
  const tokens = getTokens(session);
  if (!tokens) {
    return NextResponse.json({ status: "pending" });
  }

  return NextResponse.json({
    status: "connected",
    bot_token: tokens.bot_token,
    team_name: tokens.team_name,
    team_id: tokens.team_id,
    authed_user_id: tokens.authed_user_id,
  });
}
