# AI Interview Agent

Built for the ABTalks Vibe Code Hackathon — Problem Statement 2.

An AI agent that conducts a personalized, multi-turn technical interview based on
a candidate's actual progress through a 31-day AI engineering cohort. Questions
and follow-ups are prioritized toward each candidate's own weak spots (skipped
missions, high-attempt-count topics), and the agent uses [Breeth](https://www.thebreeth.com)
as a memory layer — writing a note after every answer and retrieving relevant
memory before generating the next question, so follow-ups are driven by
retrieved understanding rather than just replaying the raw transcript.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in:
   - `GROQ_API_KEY` — a **free** key from https://console.groq.com/keys (no credit card)
   - `BREETH_API_KEY` — from your Breeth dashboard's API Keys page
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — a **free** database from https://console.upstash.com (no credit card)

3. Run the dev server:
   ```
   npm run dev
   ```
   Open http://localhost:3000

## API

Single endpoint per the technical spec:

```
POST /api/interview
```

**Start:** `{ "sessionId": "...", "candidate": { ...candidate object... } }`
**Turn:** `{ "sessionId": "...", "message": "..." }`
**Response:** `{ "reply": "...", "done": false }` or, when finished, `{ "reply": "...", "done": true, "feedback": {...} }`

## Architecture

- **Frontend/API**: Next.js (App Router), single deployable app
- **LLM**: Groq's free API (Llama 3.3 70B), called via `lib/llm.ts`. JSON output is enforced via Groq's `response_format: { type: "json_object" }` so the model reliably returns structured turns instead of drifting into prose over a long conversation.
- **Session persistence**: Upstash Redis (`lib/session-store.ts`) — chosen over an in-memory store because Vercel runs API routes as serverless functions, where a plain in-memory Map can lose state between requests hitting different instances.
- **Memory**: Breeth (`lib/breeth.ts`) — called directly via REST at runtime (separate from MCP, which is used by the coding assistant during development, not by the deployed app). A memory note is written after every candidate answer, and relevant memory is retrieved before generating the next question.

## Notes on Breeth integration

`lib/breeth.ts` calls Breeth's REST API directly. The exact endpoint shape was
best-effort matched against Breeth's public docs at build time and confirmed
working via the dashboard's Writes/Retrievals counters during testing (both
climbed as expected across multiple full interview runs).

## Deploying

Deploy to Vercel, add the same four environment variables in the Vercel project
settings (Production and Preview), and you're live.