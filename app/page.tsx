"use client";

import { useState } from "react";
import candidatesData from "@/data/candidates.json";

type Msg = { role: "assistant" | "user"; text: string };

type Feedback = {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
};

const candidates = candidatesData.candidates;

function randomSessionId() {
  return `sess-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  const [candidateId, setCandidateId] = useState(candidates[0]?.member.id ?? "");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function startInterview() {
    const candidate = candidates.find((c) => c.member.id === candidateId);
    if (!candidate) return;

    const newSessionId = randomSessionId();
    setSessionId(newSessionId);
    setMessages([]);
    setDone(false);
    setFeedback(null);
    setLoading(true);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: newSessionId, candidate }),
      });
      const data = await res.json();
      setMessages([{ role: "assistant", text: data.reply }]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !sessionId || loading) return;
    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: userText }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
      if (data.done) {
        setDone(true);
        setFeedback(data.feedback ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>AI Interview Agent</h1>
      <p className="subtitle">Personalized technical interviews, adapted from each candidate's cohort history.</p>

      {!sessionId && (
        <div className="picker">
          <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            {candidates.map((c) => (
              <option key={c.member.id} value={c.member.id}>
                {c.member.name} — {c.member.jobRole}
              </option>
            ))}
          </select>
          <button onClick={startInterview} disabled={loading}>
            {loading ? "Starting…" : "Start Interview"}
          </button>
        </div>
      )}

      {sessionId && (
        <>
          <div className="status">
            Session: {sessionId} {done ? "· Completed" : "· In progress"}
          </div>
          <div className="chat">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="bubble assistant">…</div>}
          </div>

          {!done && (
            <div className="composer">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your answer…"
                disabled={loading}
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()}>
                Send
              </button>
            </div>
          )}

          {done && feedback && (
            <div className="feedback">
              <h2>Interview Feedback</h2>
              <p>{feedback.summary}</p>
              <h3>Strengths</h3>
              <ul>
                {feedback.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <h3>Gaps</h3>
              <ul>
                {feedback.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
              <h3>Next Steps</h3>
              <ul>
                {feedback.next.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
