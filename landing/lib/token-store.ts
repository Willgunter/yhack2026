/**
 * Token store backed by Vercel KV (Redis).
 * Shared across all serverless function instances — no more "infinite loading" bug.
 *
 * Setup: Vercel Dashboard → Storage → Create KV Database → link to this project.
 * The KV_* env vars are automatically injected by Vercel after linking.
 */

import { kv } from '@vercel/kv';

interface TokenData {
  bot_token: string;
  team_name: string;
  team_id: string;
  authed_user_id: string;
  created_at: number;
}

const KEY_PREFIX = 'slack:session:';
const TTL_SECONDS = 10 * 60; // 10 minutes

export async function setTokens(
  sessionId: string,
  data: Omit<TokenData, 'created_at'>
): Promise<void> {
  await kv.setex(`${KEY_PREFIX}${sessionId}`, TTL_SECONDS, {
    ...data,
    created_at: Date.now(),
  });
}

export async function getTokens(sessionId: string): Promise<TokenData | null> {
  const data = await kv.get<TokenData>(`${KEY_PREFIX}${sessionId}`);
  if (!data) return null;
  // One-time retrieval — delete after returning
  await kv.del(`${KEY_PREFIX}${sessionId}`);
  return data;
}

export async function hasTokens(sessionId: string): Promise<boolean> {
  const result = await kv.exists(`${KEY_PREFIX}${sessionId}`);
  return result === 1;
}
