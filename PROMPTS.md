# Live Submission

- Live app: https://interview-agent-drab.vercel.app
- GitHub repo: https://github.com/kumkum-thakur/Interview-agent
- This project was built entirely through an extended conversation with Claude
  (claude.ai). That conversation is the authoritative build record. Export
  attached separately as chat-transcript.md / .pdf (or linked here).

---

# PROMPTS.md

This project was built through an extended conversation with Claude (claude.ai)
rather than a single prompt. The full chat transcript is the authoritative
record and can be exported from claude.ai and attached alongside this file.

## Summary of the build process

1. Started from the official Technical Specification for Problem Statement 2
   ("The Interview Agent"), the provided `candidates.json`, and `curriculum.json`.
2. Asked Claude to design the architecture: a single stateful `POST /api/interview`
   endpoint (Next.js API route), in-memory session state, Claude (Sonnet)
   generating questions/follow-ups/feedback, and Breeth as a memory layer
   queried before each new question.
3. Asked Claude to scaffold the full Next.js project directly (package.json,
   tsconfig, API route, interview engine, Breeth client, chat UI) rather than
   through Claude Code CLI, since Claude Code required paid API billing that
   wasn't available — this chat interface was used as the "vibe coding"
   environment instead, with the same "AI writes the code, human directs and
   reviews" workflow.
4. Iterated on:
   - Personalization logic: ranking each candidate's curriculum days by
     skipped/high-attempt-count topics so the interview targets real gaps.
   - A structured JSON contract between the LLM and the engine (`reply`,
     `memoryNote`, `coveredDay`, `done`, `feedback`) so the model's natural-language
     output could be reliably parsed without breaking the API contract.
   - Breeth integration: writing a short memory note after every candidate
     answer, retrieving relevant memory before generating the next question.
   - Server-side enforcement of the minimum 8 questions / 4 distinct days,
     so the model can't end the interview early even if it tries to.

## To finish before submission

- [ ] Verify the Breeth REST endpoint shapes in `lib/breeth.ts` against the
      actual dashboard docs and adjust if needed.
- [ ] Export this full chat transcript from claude.ai and include it here or
      as a linked file, per the hackathon's "exported chat transcripts" option.
- [ ] Add any additional prompts used for debugging/fixes during local testing.
