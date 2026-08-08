/**
 * LLM client using Groq's free API (OpenAI-compatible).
 * No credit card required - get a key at https://console.groq.com/keys
 * Free tier is far more generous than Gemini's (thousands of requests/day
 * vs Gemini's current 20/day free cap), which matters for hackathon-scale
 * iterative testing.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function askClaude(system: string, messages: ChatMessage[]): Promise<string> {
  // Function name kept as askClaude to avoid touching every call site -
  // it's just "ask the LLM" under the hood now.
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set. Add it to .env.local (get a free key at https://console.groq.com/keys).");
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.4,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}