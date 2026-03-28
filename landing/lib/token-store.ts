/**
 * In-memory token store for OAuth sessions.
 * For production: swap with Vercel KV or Redis.
 * For hackathon: in-memory Map is fine (resets on deploy).
 */

interface TokenData {
  bot_token: string;
  team_name: string;
  team_id: string;
  authed_user_id: string;
  created_at: number;
}

const store = new Map<string, TokenData>();

// Clean up tokens older than 10 minutes
const TTL_MS = 10 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [key, val] of store) {
    if (now - val.created_at > TTL_MS) {
      store.delete(key);
    }
  }
}

export function setTokens(sessionId: string, data: Omit<TokenData, "created_at">) {
  cleanup();
  store.set(sessionId, { ...data, created_at: Date.now() });
}

export function getTokens(sessionId: string): TokenData | null {
  cleanup();
  const data = store.get(sessionId);
  if (!data) return null;
  // One-time retrieval — delete after returning
  store.delete(sessionId);
  return data;
}

export function hasTokens(sessionId: string): boolean {
  cleanup();
  return store.has(sessionId);
}
