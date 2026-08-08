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
   - `GEMINI_API_KEY` — a **free** key from https://aistudio.google.com (no credit card required)
   - `BREETH_API_KEY` — from your Breeth dashboard's API Keys page

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

## Notes on Breeth integration

`lib/breeth.ts` calls Breeth's REST API directly (not MCP — MCP is used by the
coding assistant while building, this app talks to Breeth at runtime). The
exact endpoint shape was best-effort matched against Breeth's public docs at
build time; if the retrieval endpoint differs, only `lib/breeth.ts` needs
adjusting, nothing else in the app depends on its internals.

## Deploying

Deploy to Vercel, add the same two environment variables in the Vercel project
settings, and you're live.
