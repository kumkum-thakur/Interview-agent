import { NextRequest, NextResponse } from "next/server";
import { startInterview, continueInterview, findCandidateById, type Candidate } from "@/lib/interview-engine";

function normalizeCandidate(input: any): Candidate | null {
  if (!input) return null;
  // Accept a full candidate object directly.
  if (input.member && input.missions) return input as Candidate;
  // Accept { candidates: [...] } and take the first entry.
  if (Array.isArray(input.candidates) && input.candidates.length > 0) {
    return input.candidates[0] as Candidate;
  }
  // Accept a bare candidate id string, looked up against our local dataset.
  if (typeof input === "string") {
    return findCandidateById(input) ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, candidate, message } = body ?? {};

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    if (candidate && !message) {
      const normalized = normalizeCandidate(candidate);
      if (!normalized) {
        return NextResponse.json({ error: "candidate object is invalid or unrecognized" }, { status: 400 });
      }
      const result = await startInterview(sessionId, normalized);
      return NextResponse.json(result);
    }

    if (typeof message === "string") {
      const result = await continueInterview(sessionId, message);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Request must include either 'candidate' (to start) or 'message' (to continue)" }, { status: 400 });
  } catch (err: any) {
    console.error("Interview endpoint error:", err);
    return NextResponse.json({ error: "Internal error", detail: String(err?.message ?? err) }, { status: 500 });
  }
}
