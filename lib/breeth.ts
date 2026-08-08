/**
 * Minimal Breeth REST client.
 *
 * NOTE: This uses Breeth's REST API directly (not MCP), since MCP is meant
 * for your coding assistant, not your deployed app's runtime.
 * Endpoints below follow Breeth's documented write pattern
 * (POST /v1/episodes) and a best-effort search endpoint. Before final
 * submission, double check the exact retrieval path/shape against
 * "Quickstart and MCP setup" on your Breeth dashboard - if it differs,
 * only the two functions below need updating, nothing else in the app.
 *
 * Every call is wrapped so a Breeth outage/shape-mismatch never breaks
 * the interview itself - it just skips memory for that turn.
 */

const BREETH_BASE_URL = "https://api.thebreeth.com";
const BREETH_API_KEY = process.env.BREETH_API_KEY;

type WriteEpisodeParams = {
  sessionId: string;
  content: string;
  extractIntent?: boolean;
};

export async function writeEpisode({ sessionId, content, extractIntent = false }: WriteEpisodeParams) {
  if (!BREETH_API_KEY) return null;
  try {
    const res = await fetch(`${BREETH_BASE_URL}/v1/episodes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BREETH_API_KEY}`,
      },
      body: JSON.stringify({
        group_id: sessionId,
        content,
        extract_intent: extractIntent,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function searchEpisodes(sessionId: string, query: string, limit = 5) {
  if (!BREETH_API_KEY) return [];
  try {
    const res = await fetch(`${BREETH_BASE_URL}/v1/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BREETH_API_KEY}`,
      },
      body: JSON.stringify({
        group_id: sessionId,
        query,
        limit,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.results ?? data?.episodes ?? [];
  } catch {
    return [];
  }
}
