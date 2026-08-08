/**
 * Persistent session store using Upstash Redis (free tier, no credit card).
 *
 * Why this exists: Vercel runs API routes as serverless functions. Each
 * request can hit a fresh instance with empty memory, so a plain in-memory
 * Map (fine for local dev) can silently lose interview state mid-conversation
 * in production. Upstash's REST API is a perfect fit here - no persistent
 * connection needed, just simple HTTP calls, and it works from any
 * serverless environment.
 *
 * Get a free database at https://console.upstash.com -> Create Database
 * -> copy the REST URL and REST TOKEN into your env vars.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Sessions expire after 6 hours - plenty for a single interview, and keeps
// the free-tier database from accumulating stale data indefinitely.
const SESSION_TTL_SECONDS = 6 * 60 * 60;

async function redisCommand(command: (string | number)[]): Promise<any> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. Add them to .env.local (free database at https://console.upstash.com)."
    );
  }
  const res = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.result;
}

export async function getSessionState<T>(sessionId: string): Promise<T | null> {
  const key = `interview-session:${sessionId}`;
  const result = await redisCommand(["GET", key]);
  if (!result) return null;
  try {
    return JSON.parse(result) as T;
  } catch {
    return null;
  }
}

export async function setSessionState<T>(sessionId: string, state: T): Promise<void> {
  const key = `interview-session:${sessionId}`;
  await redisCommand(["SET", key, JSON.stringify(state), "EX", SESSION_TTL_SECONDS]);
}