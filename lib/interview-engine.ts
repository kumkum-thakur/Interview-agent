import candidatesData from "@/data/candidates.json";
import curriculumData from "@/data/curriculum.json";
import { askClaude, type ChatMessage } from "@/lib/llm";
import { writeEpisode, searchEpisodes } from "@/lib/breeth";
import { getSessionState, setSessionState } from "@/lib/session-store";

type Mission = {
  day: number;
  title: string;
  passed?: boolean;
  skipped?: boolean;
  attempts?: number;
};

export type Candidate = {
  member: {
    id: string;
    name: string;
    jobRole: string;
    yearsExperience: number;
    education: string;
    status: string;
  };
  missions: Mission[];
  signals: { commitDays: number; missionsCompleted: number; missionsFirstTry: number };
};

type CurriculumDay = {
  day: number;
  title: string;
  type: string;
  tools: string[];
  objectives: string[];
};

type Feedback = {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
};

type ModelTurn = {
  reply: string;
  memoryNote?: string;
  coveredDay?: number | null;
  done: boolean;
  feedback?: Feedback | null;
};

type SessionState = {
  candidate: Candidate;
  messages: ChatMessage[];
  daysCovered: number[];
  questionCount: number;
  priorityDays: number[];
};

const MIN_QUESTIONS = 8;
const MIN_DAYS = 4;

const curriculumDays: CurriculumDay[] = (curriculumData as any).days;

function getCurriculumDay(day: number): CurriculumDay | undefined {
  return curriculumDays.find((d) => d.day === day);
}

function priorityDaysFor(candidate: Candidate): number[] {
  const scored = candidate.missions.map((m) => {
    const skippedScore = m.skipped ? 1000 : 0;
    const attemptsScore = (m.attempts ?? 1) * 10;
    const failedScore = m.passed === false ? 500 : 0;
    return { day: m.day, score: skippedScore + failedScore + attemptsScore };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.day);
}

function buildSystemPrompt(state: SessionState, breethContext: string): string {
  const { candidate, daysCovered, questionCount, priorityDays } = state;

  const missionSummary = candidate.missions
    .map((m) => {
      const status = m.skipped ? "SKIPPED" : m.passed === false ? "FAILED" : "PASSED";
      return `Day ${m.day} (${m.title}): ${status}${m.attempts ? `, ${m.attempts} attempt(s)` : ""}`;
    })
    .join("\n");

  const remainingPriority = priorityDays
    .filter((d) => !daysCovered.includes(d))
    .slice(0, 6)
    .map((d) => {
      const cd = getCurriculumDay(d);
      return cd ? `Day ${d}: ${cd.title} — objectives: ${cd.objectives.join("; ")}` : `Day ${d}`;
    })
    .join("\n");

  return `You are conducting a live, spoken-style technical interview for an AI engineering cohort graduate.

CANDIDATE
Name: ${candidate.member.name}
Role: ${candidate.member.jobRole} (${candidate.member.yearsExperience} yrs experience, ${candidate.member.education})
Commit days: ${candidate.signals.commitDays}, Missions completed: ${candidate.signals.missionsCompleted}, First-try passes: ${candidate.signals.missionsFirstTry}

FULL MISSION HISTORY
${missionSummary}

INTERVIEW PROGRESS SO FAR
Questions asked: ${questionCount}
Distinct curriculum days already covered: ${daysCovered.length > 0 ? daysCovered.join(", ") : "none yet"}
Minimum required before ending: ${MIN_QUESTIONS} questions across ${MIN_DAYS} distinct days.

TOPICS TO PRIORITIZE NEXT (their weakest spots — skipped topics and high-attempt-count topics ranked first)
${remainingPriority || "(all priority topics covered — pick any remaining curriculum day, or wrap up if minimums are met)"}

MEMORY FROM EARLIER IN THIS INTERVIEW (retrieved from Breeth, not just raw transcript)
${breethContext || "(no memory yet — this is early in the interview)"}

HOW TO INTERVIEW
- Sound like a real, warm-but-rigorous technical interviewer, not a scripted quiz.
- Prioritize topics from the list above — those are where this specific candidate is statistically weakest (skipped or struggled with high attempt counts). A distinguished 20-year veteran and a bootcamp grad should get noticeably different interviews based on their own history.
- Ask ONE question or ONE natural follow-up at a time.
- When the candidate answers, generate a genuine follow-up based on what they actually said (probe deeper, ask them to clarify, or challenge a weak point) before moving to a new topic — don't just fire the next scripted question.
- Only end the interview once you've asked at least ${MIN_QUESTIONS} questions covering at least ${MIN_DAYS} distinct curriculum days AND you have enough signal to write real feedback.

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown fences, matching exactly:
{
  "reply": "the exact text to show the candidate right now — your question, follow-up, or closing remarks",
  "memoryNote": "one short sentence: what topic you probed and what it revealed about this candidate (for memory retrieval later)",
  "coveredDay": <curriculum day number this question/follow-up is primarily about, or null if this is a general/wrap-up message>,
  "done": <true only when the interview is fully complete and you are delivering final feedback, otherwise false>,
  "feedback": <null while done is false. When done is true, an object: { "summary": string, "strengths": string[], "gaps": string[], "next": string[] } built from the WHOLE interview and the candidate's mission history — call out specific moments, e.g. "struggled to explain X, consistent with 5 attempts on Day Y in the cohort.">
}`;
}

function safeParseModelTurn(raw: string): ModelTurn {
  let text = raw.trim();

  if (text.startsWith("```")) {
    text = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(text);
    return {
      reply: parsed.reply ?? "Let's continue.",
      memoryNote: parsed.memoryNote,
      coveredDay: parsed.coveredDay ?? null,
      done: Boolean(parsed.done),
      feedback: parsed.feedback ?? null,
    };
  } catch (err) {
    console.error("Failed to parse model JSON turn. Raw text was:", raw);
    return { reply: "Sorry, could you say that again?", done: false, coveredDay: null };
  }
}

function fallbackFeedback(candidate: Candidate): Feedback {
  const skipped = candidate.missions.filter((m) => m.skipped).map((m) => m.title);
  const struggled = candidate.missions
    .filter((m) => (m.attempts ?? 1) >= 4)
    .map((m) => m.title);
  const strong = candidate.missions
    .filter((m) => m.passed && (m.attempts ?? 1) === 1)
    .map((m) => m.title);

  return {
    summary: `${candidate.member.name} completed the interview. Based on cohort history, review areas around ${
      struggled[0] ?? "the topics discussed"
    } are worth another look.`,
    strengths: strong.slice(0, 3).length ? strong.slice(0, 3) : ["Completed the cohort end to end"],
    gaps: [...skipped, ...struggled].slice(0, 3).length
      ? [...skipped, ...struggled].slice(0, 3)
      : ["No major gaps flagged"],
    next: ["Revisit flagged topics", "Do a hands-on rebuild of the weakest module", "Schedule a follow-up interview"],
  };
}

export function findCandidateById(id: string): Candidate | undefined {
  return (candidatesData as any).candidates.find((c: Candidate) => c.member.id === id);
}

export async function startInterview(sessionId: string, candidate: Candidate) {
  const state: SessionState = {
    candidate,
    messages: [],
    daysCovered: [],
    questionCount: 0,
    priorityDays: priorityDaysFor(candidate),
  };
  await setSessionState(sessionId, state);

  const system = buildSystemPrompt(state, "");
  const kickoff: ChatMessage = {
    role: "user",
    content:
      "[control] Begin the interview now. Greet the candidate briefly by name, then ask your first question, targeting their highest-priority weak topic.",
  };

  const raw = await askClaude(system, [kickoff]);
  const turn = safeParseModelTurn(raw);

  state.messages.push({ role: "assistant", content: turn.reply });
  state.questionCount += 1;
  if (turn.coveredDay && !state.daysCovered.includes(turn.coveredDay)) {
    state.daysCovered.push(turn.coveredDay);
  }

  await setSessionState(sessionId, state);

  await writeEpisode({
    sessionId,
    content: `Interview started for ${candidate.member.name} (${candidate.member.jobRole}). ${
      turn.memoryNote ?? `Opening question targeted day ${turn.coveredDay ?? "n/a"}.`
    }`,
    extractIntent: true,
  });

  return { reply: turn.reply, done: false };
}

export async function continueInterview(sessionId: string, message: string) {
  const state = await getSessionState<SessionState>(sessionId);

  if (!state) {
    return {
      reply:
        "It looks like this interview session expired on the server. Could we restart? Please begin a new session.",
      done: true,
      feedback: {
        summary: "Session state was lost before the interview could complete.",
        strengths: [],
        gaps: [],
        next: ["Restart the interview with a fresh sessionId"],
      },
    };
  }

  state.messages.push({ role: "user", content: message });

  const memoryHits = await searchEpisodes(sessionId, message, 5);
  const breethContext = memoryHits.length
    ? memoryHits.map((m: any) => `- ${m.content ?? m.text ?? JSON.stringify(m)}`).join("\n")
    : "";

  const system = buildSystemPrompt(state, breethContext);
  const raw = await askClaude(system, state.messages);
  const turn = safeParseModelTurn(raw);

  state.messages.push({ role: "assistant", content: turn.reply });

  if (!turn.done) {
    state.questionCount += 1;
    if (turn.coveredDay && !state.daysCovered.includes(turn.coveredDay)) {
      state.daysCovered.push(turn.coveredDay);
    }
  }

  await writeEpisode({
    sessionId,
    content: turn.memoryNote ?? `Candidate answered on day ${turn.coveredDay ?? "n/a"}: "${message.slice(0, 140)}"`,
    extractIntent: true,
  });

  const metMinimums = state.questionCount >= MIN_QUESTIONS && state.daysCovered.length >= MIN_DAYS;
  const done = turn.done && metMinimums;

  if (turn.done && !metMinimums) {
    state.messages.push({
      role: "user",
      content: `[control] You have not yet met the minimum of ${MIN_QUESTIONS} questions across ${MIN_DAYS} distinct curriculum days (currently at ${state.questionCount} questions, ${state.daysCovered.length} days). Do not say goodbye or wrap up. Ask a genuine new technical question on a topic not yet covered.`,
    });
    const raw2 = await askClaude(system, state.messages);
    const turn2 = safeParseModelTurn(raw2);
    state.messages.push({ role: "assistant", content: turn2.reply });
    state.questionCount += 1;
    if (turn2.coveredDay && !state.daysCovered.includes(turn2.coveredDay)) {
      state.daysCovered.push(turn2.coveredDay);
    }
    await setSessionState(sessionId, state);
    await writeEpisode({
      sessionId,
      content: turn2.memoryNote ?? `Continued interview after early-end correction, now on day ${turn2.coveredDay ?? "n/a"}.`,
      extractIntent: true,
    });
    return { reply: turn2.reply, done: false };
  }

  await setSessionState(sessionId, state);

  if (done) {
    const feedback = turn.feedback ?? fallbackFeedback(state.candidate);
    return { reply: turn.reply, done: true, feedback };
  }

  return { reply: turn.reply, done: false };
}