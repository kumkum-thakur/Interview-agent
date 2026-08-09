# Live Submission

- Live app: https://interview-agent-drab.vercel.app
- GitHub repo: https://github.com/kumkum-thakur/Interview-agent
- This project was built entirely through an extended conversation with Claude
  (claude.ai). That conversation is the authoritative build record.

---

# PROMPTS.md

This project was built through an extended conversation with Claude (claude.ai)
rather than a single prompt. The full chat transcript is the authoritative
record and can be exported from claude.ai and attached alongside this file.

## Final architecture

- **Frontend/API**: Next.js (App Router), single deployable app on Vercel.
- **LLM**: Groq's free API (Llama 3.3 70B) generates interview questions,
  follow-ups, and final feedback, called via `lib/llm.ts`. JSON output is
  enforced via Groq's `response_format: { type: "json_object" }`.
- **Session persistence**: Upstash Redis (`lib/session-store.ts`), not an
  in-memory store — switched to this after realizing Vercel's serverless
  functions can lose in-memory state between requests hitting different
  instances mid-interview.
- **Memory**: Breeth (`lib/breeth.ts`), called directly via REST at runtime.
  A memory note is written after every candidate answer, and relevant memory
  is retrieved before generating the next question, so follow-ups are driven
  by retrieved understanding rather than just the raw transcript.

## Summary of the build process

1. Started from the official Technical Specification for Problem Statement 2
   ("The Interview Agent"), the provided `candidates.json`, and `curriculum.json`.
2. Asked Claude to design the architecture: a single stateful `POST /api/interview`
   endpoint (Next.js API route), session state, an LLM generating
   questions/follow-ups/feedback, and Breeth as a memory layer queried before
   each new question.
3. Asked Claude to scaffold the full Next.js project directly (package.json,
   tsconfig, API route, interview engine, Breeth client, chat UI) rather than
   through Claude Code CLI, since Claude Code required paid API billing that
   wasn't available — this chat interface was used as the "vibe coding"
   environment instead, with the same "AI writes the code, human directs and
   reviews" workflow.
4. Originally used Claude's API for the app's own LLM calls, then switched to
   Google Gemini's free API (no billing available), then switched again to
   Groq's free API after hitting Gemini's very low daily free-tier request
   cap (20/day) during testing. Each switch only required changing
   `lib/llm.ts` — the rest of the app was designed to be provider-agnostic.
5. Iterated on:
   - Personalization logic: ranking each candidate's curriculum days by
     skipped/high-attempt-count topics so the interview targets real gaps.
   - A structured JSON contract between the LLM and the engine (`reply`,
     `memoryNote`, `coveredDay`, `done`, `feedback`) so the model's
     natural-language output could be reliably parsed without breaking the
     API contract. Iterated this further after finding the model sometimes
     drifted into plain prose over a long conversation — fixed by enforcing
     JSON mode at the API level (Groq's `response_format`) rather than
     relying on prompt instructions alone.
   - Breeth integration: writing a short memory note after every candidate
     answer, retrieving relevant memory before generating the next question.
     Confirmed working via the Breeth dashboard's Writes/Retrievals counters
     climbing across multiple full interview test runs.
   - Server-side enforcement of the minimum 8 questions / 4 distinct days,
     so the model can't end the interview early even if it tries to — found
     and fixed a bug where an early "wrap up" attempt from the model could
     loop without ever reaching a real completion state.
   - Session persistence: switched from an in-memory Map to Upstash Redis
     after identifying that Vercel's serverless execution model could drop
     interview state mid-conversation in production, even though this never
     showed up in local testing.

## Verification before submission

- [x] Verified the Breeth REST endpoint shapes in `lib/breeth.ts` work
      against the live dashboard — Writes and Retrievals counts both climbed
      as expected across test runs.
- [x] Full interview flow tested end-to-end on the live Vercel deployment
      multiple times, with different candidates, through to a complete
      feedback card.
- [x] Session persistence verified with Upstash after the in-memory-Map
      fragility was identified and fixed.