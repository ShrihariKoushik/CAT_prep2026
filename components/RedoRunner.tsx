"use client";
import { useState } from "react";
import Link from "next/link";
import { postJson } from "@/lib/clientFetch";
import type { ClientQuestion } from "./QuizRunner";

type Result = { isCorrect: boolean; correctIndex: number; explanation: string; retired: boolean; nextDueOn: string | null };
const L = ["A", "B", "C", "D"];

export default function RedoRunner({ items }: { items: ClientQuestion[] }) {
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goHome = () => {
    window.location.assign("/");
  };

  if (done || items.length === 0) {
    return (
      <div className="pt-8 flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Redo mistakes</h1>
        <div className="rounded-2xl bg-cream-100 dark:bg-night-800 p-5 text-center">
          {items.length === 0 ? (
            <p>Nothing due for review. Come back after your next slip-up.</p>
          ) : (
            <>
              <div className="text-4xl font-semibold">{correctCount}/{items.length}</div>
              <div className="text-sm text-ink-600 dark:text-cream-300 mt-1">
                cleared this round — the rest come back sooner
              </div>
            </>
          )}
        </div>
        <Link href="/" className="rounded-full bg-terra-500 text-white text-center font-medium py-3">Back home</Link>
      </div>
    );
  }

  const q = items[idx];

  async function check() {
    if (chosen === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<Result>("/api/redo", { questionId: q.id, chosenIndex: chosen });
      if (r.isCorrect) setCorrectCount((c) => c + 1);
      setResult(r);
    } catch (e) {
      setError(`Couldn't save — ${(e as Error).message}. Tap Check again.`);
    }
    setBusy(false);
  }

  function next() {
    setChosen(null);
    setResult(null);
    if (idx < items.length - 1) setIdx(idx + 1);
    else setDone(true);
  }

  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="flex items-center gap-2 text-sm text-ink-600 dark:text-cream-300">
        <button
          type="button"
          onClick={goHome}
          aria-label="Back home"
          className="rounded-full border border-cream-300 dark:border-night-600 px-3 py-1.5"
        >
          ←
        </button>
        Redo mistakes · {idx + 1}/{items.length}
      </div>

      {q.contextBody && (
        <details open className="rounded-xl bg-cream-100 dark:bg-night-800 p-3">
          <summary className="text-sm font-medium cursor-pointer">{q.contextTitle ?? "Context"}</summary>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{q.contextBody}</p>
        </details>
      )}

      <p className="text-base leading-relaxed whitespace-pre-wrap">{q.text}</p>

      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          let cls = "border-cream-200 dark:border-night-700 bg-cream-50 dark:bg-night-800";
          if (result) {
            if (i === result.correctIndex) cls = "border-sage-500 bg-sage-100 dark:bg-sage-600/20";
            else if (i === chosen) cls = "border-terra-500 bg-terra-100 dark:bg-terra-600/20";
          } else if (i === chosen) {
            cls = "border-terra-500 bg-terra-100 dark:bg-terra-600/20";
          }
          return (
            <button
              key={i}
              disabled={!!result}
              onClick={() => setChosen(i)}
              className={`rounded-2xl border p-4 text-left text-base min-h-14 active:scale-[0.99] transition ${cls}`}
            >
              <span className="font-medium mr-2">{L[i]}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {result && (
        <div className={`rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
          result.isCorrect ? "bg-sage-100 dark:bg-sage-600/15" : "bg-terra-100 dark:bg-terra-600/15"
        }`}>
          <div className="font-medium mb-1">
            {result.isCorrect
              ? result.retired
                ? "Correct — retired for good. That one's yours now."
                : `Correct — comes back ${result.nextDueOn}.`
              : "Still tricky — back tomorrow."}
          </div>
          {result.explanation}
        </div>
      )}

      {error && <p className="text-sm text-terra-600 dark:text-terra-200">{error}</p>}

      {!result ? (
        <button
          onClick={check}
          disabled={chosen === null || busy}
          className="rounded-full bg-terra-500 text-white font-medium py-3 disabled:opacity-40"
        >
          Check answer
        </button>
      ) : (
        <button onClick={next} className="rounded-full bg-terra-500 text-white font-medium py-3">
          {idx < items.length - 1 ? "Next" : "Finish"}
        </button>
      )}
    </div>
  );
}
