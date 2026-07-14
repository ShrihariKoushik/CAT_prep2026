"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { postJson } from "@/lib/clientFetch";

export type ClientQuestion = {
  id: string;
  kind: string;
  topic: string;
  text: string;
  options: string[];
  contextTitle?: string;
  contextBody?: string;
};

type Result = { isCorrect: boolean; correctIndex: number; explanation: string };

// Previously saved answer (server-side) so a set can be resumed mid-way.
// correctIndex/explanation are only populated for questions she already answered.
export type InitialAnswer = {
  chosenIndex: number | null;
  isCorrect: boolean | null;
  correctIndex: number;
  explanation: string;
  flagged: boolean;
  timeSpentSec: number | null;
};
type QState = {
  chosen: number | null;
  flagged: boolean;
  result: Result | null;
  timeSpent: number;
};
type Summary = {
  score: number;
  total: number;
  totalTimeSec: number;
  levelBefore: number;
  levelAfter: number;
  streak?: number;
  breakdown: {
    questionId: string;
    text: string;
    options: string[];
    chosenIndex: number | null;
    correctIndex: number;
    isCorrect: boolean;
    explanation: string;
  }[];
};

const OPTION_LABELS = ["A", "B", "C", "D"];

export default function QuizRunner({
  setId,
  sectionLabel,
  timerSeconds,
  questions,
  initialAnswers,
}: {
  setId: string;
  sectionLabel: string;
  timerSeconds: number;
  questions: ClientQuestion[];
  initialAnswers?: Record<string, InitialAnswer>;
}) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  // Resume support: restore saved answers, open at the first unanswered question.
  const firstOpenIdx = questions.findIndex((q) => initialAnswers?.[q.id]?.chosenIndex == null);
  const anyAnswered = questions.some((q) => initialAnswers?.[q.id]?.chosenIndex != null);
  const [idx, setIdx] = useState(firstOpenIdx === -1 ? 0 : firstOpenIdx);
  const [phase, setPhase] = useState<"quiz" | "review" | "summary">(
    firstOpenIdx === -1 && anyAnswered ? "review" : "quiz"
  );
  const [qs, setQs] = useState<QState[]>(() =>
    questions.map((q) => {
      const a = initialAnswers?.[q.id];
      if (!a || a.chosenIndex === null) {
        return { chosen: null, flagged: a?.flagged ?? false, result: null, timeSpent: a?.timeSpentSec ?? 0 };
      }
      return {
        chosen: a.chosenIndex,
        flagged: a.flagged,
        result: { isCorrect: a.isCorrect === true, correctIndex: a.correctIndex, explanation: a.explanation },
        timeSpent: a.timeSpentSec ?? 0,
      };
    })
  );
  const [timerOn, setTimerOn] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(timerSeconds);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enteredAt = useRef(Date.now());
  const startedRef = useRef(false); // single-flight: StrictMode double-fires effects in dev
  // Plain browser navigation: immune to any client-router state, and a full
  // load of "/" always shows fresh data. Progress is already saved server-side.
  const goHome = () => {
    window.location.assign("/");
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    postJson<{ attemptId: string }>("/api/attempts", { setId })
      .then((d) => setAttemptId(d.attemptId))
      .catch((e) => setError(`Couldn't start the set — ${e.message}`));
  }, [setId]);

  // per-question countdown (purely informational — nothing auto-submits)
  useEffect(() => {
    if (phase !== "quiz" || !timerOn || qs[idx].result) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, timerOn, idx, qs]);

  const q = questions[idx];
  const st = qs[idx];
  const revealed = !!st.result;

  const patch = (i: number, p: Partial<QState>) =>
    setQs((prev) => prev.map((s, j) => (j === i ? { ...s, ...p } : s)));

  const spentNow = () => Math.round((Date.now() - enteredAt.current) / 1000);

  const goTo = (i: number) => {
    setIdx(i);
    setSecondsLeft(timerSeconds);
    enteredAt.current = Date.now();
    setPhase("quiz");
  };

  async function checkAnswer() {
    if (st.chosen === null || !attemptId || busy) return;
    setBusy(true);
    setError(null);
    const timeSpent = st.timeSpent + spentNow();
    try {
      const r = await postJson<Result & { recorded: boolean }>(
        `/api/attempts/${attemptId}/answer`,
        { questionId: q.id, chosenIndex: st.chosen, flagged: st.flagged, timeSpentSec: timeSpent }
      );
      patch(idx, {
        timeSpent,
        result: { isCorrect: r.isCorrect, correctIndex: r.correctIndex, explanation: r.explanation },
      });
    } catch (e) {
      setError(`Couldn't save that answer — ${(e as Error).message}. Tap Check again.`);
    }
    setBusy(false);
  }

  async function skip(flag: boolean) {
    if (!attemptId) return;
    const timeSpent = st.timeSpent + spentNow();
    patch(idx, { flagged: flag || st.flagged, timeSpent });
    postJson(`/api/attempts/${attemptId}/answer`, {
      questionId: q.id,
      chosenIndex: null,
      flagged: flag || st.flagged,
      timeSpentSec: timeSpent,
    }).catch(() => {}); // skip is best-effort; unanswered counts as wrong at submit anyway
    next();
  }

  const next = () => (idx < questions.length - 1 ? goTo(idx + 1) : setPhase("review"));

  async function submitSet() {
    if (!attemptId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await postJson<Summary>(`/api/attempts/${attemptId}/complete`);
      setSummary(s);
      setPhase("summary");
    } catch (e) {
      setError(`Couldn't submit — ${(e as Error).message}. Try again.`);
    }
    setBusy(false);
  }

  // ---------- summary ----------
  if (phase === "summary" && summary) {
    const delta = summary.levelAfter - summary.levelBefore;
    const mins = Math.floor(summary.totalTimeSec / 60);
    return (
      <div className="flex flex-col gap-5 pt-8">
        <h1 className="text-xl font-semibold">{sectionLabel} — done</h1>
        <div className="rounded-2xl bg-cream-100 dark:bg-night-800 p-5 text-center">
          <div className="text-4xl font-semibold">{summary.score}/{summary.total}</div>
          <div className="text-sm text-ink-600 dark:text-cream-300 mt-1">
            {mins}m {summary.totalTimeSec % 60}s ·{" "}
            {delta > 0 ? `level up — L${summary.levelAfter} ↑` : delta < 0 ? `level L${summary.levelAfter} ↓` : `level L${summary.levelAfter} unchanged`}
          </div>
          {summary.streak != null && (
            <div className="text-sm text-terra-600 dark:text-terra-200 mt-1">{summary.streak} day streak</div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {summary.breakdown.map((b, i) => (
            <details key={b.questionId} className="rounded-xl border border-cream-200 dark:border-night-700 p-3">
              <summary className="flex items-center gap-2 cursor-pointer list-none">
                <span className={b.isCorrect ? "text-sage-600 dark:text-sage-200" : "text-terra-600 dark:text-terra-200"}>
                  {b.isCorrect ? "✓" : b.chosenIndex === null ? "–" : "✗"}
                </span>
                <span className="text-sm line-clamp-1 flex-1">Q{i + 1}. {b.text}</span>
              </summary>
              <div className="mt-3 text-sm flex flex-col gap-2">
                <div>
                  {b.chosenIndex !== null
                    ? `You chose ${OPTION_LABELS[b.chosenIndex]}. `
                    : "You skipped this. "}
                  Correct: {OPTION_LABELS[b.correctIndex]}. {b.options[b.correctIndex]}
                </div>
                <p className="text-ink-600 dark:text-cream-300 whitespace-pre-wrap">{b.explanation}</p>
              </div>
            </details>
          ))}
        </div>
        <Link href="/" className="rounded-full bg-terra-500 text-white text-center font-medium py-3">
          Back home
        </Link>
      </div>
    );
  }

  // ---------- review before submit ----------
  if (phase === "review") {
    const unanswered = qs.filter((s) => s.chosen === null && !s.result).length;
    return (
      <div className="flex flex-col gap-5 pt-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goHome}
            aria-label="Back home — progress is saved"
            className="rounded-full border border-cream-300 dark:border-night-600 px-3 py-1.5 text-sm"
          >
            ←
          </button>
          <h1 className="text-xl font-semibold">Review</h1>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {questions.map((_, i) => {
            const s = qs[i];
            const answered = s.result !== null;
            return (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-xl py-3 text-sm font-medium border ${
                  answered
                    ? "bg-cream-100 dark:bg-night-800 border-cream-200 dark:border-night-700"
                    : "border-dashed border-terra-500 text-terra-600 dark:text-terra-200"
                }`}
              >
                {i + 1}{s.flagged ? " ⚑" : ""}{answered ? " ·✓" : ""}
              </button>
            );
          })}
        </div>
        {unanswered > 0 && (
          <p className="text-sm text-ink-600 dark:text-cream-300">
            {unanswered} unanswered — they'll count as incorrect once you submit.
          </p>
        )}
        {error && <p className="text-sm text-terra-600 dark:text-terra-200">{error}</p>}
        <button
          onClick={submitSet}
          disabled={busy}
          className="rounded-full bg-terra-500 text-white font-medium py-3 disabled:opacity-50"
        >
          Submit set
        </button>
      </div>
    );
  }

  // ---------- quiz ----------
  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="flex items-center justify-between text-sm text-ink-600 dark:text-cream-300">
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={goHome}
            aria-label="Back home — progress is saved"
            className="rounded-full border border-cream-300 dark:border-night-600 px-3 py-1.5 -ml-1"
          >
            ←
          </button>
          {sectionLabel} · {idx + 1}/{questions.length}
        </span>
        <button onClick={() => setTimerOn((t) => !t)} className="tabular-nums">
          {timerOn ? (
            <span className={secondsLeft === 0 ? "text-terra-600 dark:text-terra-200" : ""}>
              ⏱ {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </span>
          ) : (
            "⏱ off"
          )}
        </button>
      </div>

      <div className="flex gap-1">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i === idx ? "bg-terra-500" : qs[i].result ? "bg-sage-500" : "bg-cream-200 dark:bg-night-700"
            }`}
          />
        ))}
      </div>

      {q.contextBody && (
        <details open={idx === 0 || questions[idx - 1]?.contextBody !== q.contextBody} className="rounded-xl bg-cream-100 dark:bg-night-800 p-3">
          <summary className="text-sm font-medium cursor-pointer">{q.contextTitle ?? "Passage"}</summary>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{q.contextBody}</p>
        </details>
      )}

      <p className="text-base leading-relaxed whitespace-pre-wrap">{q.text}</p>

      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          let cls = "border-cream-200 dark:border-night-700 bg-cream-50 dark:bg-night-800";
          if (revealed) {
            if (i === st.result!.correctIndex) cls = "border-sage-500 bg-sage-100 dark:bg-sage-600/20";
            else if (i === st.chosen) cls = "border-terra-500 bg-terra-100 dark:bg-terra-600/20";
          } else if (i === st.chosen) {
            cls = "border-terra-500 bg-terra-100 dark:bg-terra-600/20";
          }
          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() => patch(idx, { chosen: i })}
              className={`rounded-2xl border p-4 text-left text-base min-h-14 active:scale-[0.99] transition ${cls}`}
            >
              <span className="font-medium mr-2">{OPTION_LABELS[i]}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className={`rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
          st.result!.isCorrect ? "bg-sage-100 dark:bg-sage-600/15" : "bg-terra-100 dark:bg-terra-600/15"
        }`}>
          <div className="font-medium mb-1">{st.result!.isCorrect ? "Correct." : "Not quite."}</div>
          {st.result!.explanation}
        </div>
      )}

      {error && <p className="text-sm text-terra-600 dark:text-terra-200">{error}</p>}

      <div className="flex gap-2 mt-1">
        {!revealed ? (
          <>
            <button
              onClick={() => skip(true)}
              className="rounded-full border border-cream-300 dark:border-night-600 px-4 py-3 text-sm"
            >
              ⚑ Later
            </button>
            <button
              onClick={() => skip(false)}
              className="rounded-full border border-cream-300 dark:border-night-600 px-4 py-3 text-sm"
            >
              Skip
            </button>
            <button
              onClick={checkAnswer}
              disabled={st.chosen === null || busy || !attemptId}
              className="flex-1 rounded-full bg-terra-500 text-white font-medium py-3 disabled:opacity-40"
            >
              Check answer
            </button>
          </>
        ) : (
          <button onClick={next} className="flex-1 rounded-full bg-terra-500 text-white font-medium py-3">
            {idx < questions.length - 1 ? "Next question" : "Review & submit"}
          </button>
        )}
      </div>
    </div>
  );
}
