"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionCardData } from "@/lib/home";
import { SECTION_LABEL, SLOT_LABEL } from "@/lib/types";

const SLOT_WINDOW: Record<string, string> = {
  MORNING: "5:00 am – 12:00 pm",
  AFTERNOON: "12:00 pm – 6:00 pm",
  EVENING: "6:00 pm – midnight",
};

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}:${String(sec).padStart(2, "0")}`;
}

export default function SessionCard(props: SessionCardData) {
  const { section, slot, state, unlockAt, setId, isFallback, started, score, levelDelta } = props;
  const router = useRouter();
  // null until mounted — Date.now() during SSR causes a hydration mismatch,
  // so the countdown text only renders on the client.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (state !== "LOCKED") return;
    setNow(Date.now());
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= unlockAt) router.refresh();
    }, 1000);
    return () => clearInterval(t);
  }, [state, unlockAt, router]);

  const base = "rounded-2xl p-4 flex items-center justify-between gap-3";

  if (state === "COMPLETED") {
    return (
      <div className={`${base} bg-sage-100 dark:bg-night-800 border border-sage-200 dark:border-night-700`}>
        <div>
          <div className="text-xs text-ink-600 dark:text-cream-300">{SLOT_LABEL[slot]}</div>
          <div className="font-medium">{SECTION_LABEL[section]}</div>
          <div className="text-sm text-sage-600 dark:text-sage-200">
            {score}/8
            {levelDelta ? (levelDelta > 0 ? " · level up ↑" : " · level down ↓") : ""}
          </div>
        </div>
        <div className="text-2xl text-sage-600 dark:text-sage-200" aria-label="completed">✓</div>
      </div>
    );
  }

  if (state === "LOCKED") {
    return (
      <div className={`${base} bg-cream-100/60 dark:bg-night-900 border border-dashed border-cream-300 dark:border-night-700 opacity-80`}>
        <div>
          <div className="text-xs text-ink-600 dark:text-cream-300">{SLOT_LABEL[slot]} · {SLOT_WINDOW[slot]}</div>
          <div className="font-medium">{SECTION_LABEL[section]}</div>
          <div className="text-sm text-ink-600 dark:text-cream-300">
            {now === null ? "locked for now" : `unlocks in ${fmt(unlockAt - now)}`}
          </div>
        </div>
        <div className="text-xl" aria-label="locked">🔒</div>
      </div>
    );
  }

  return (
    <Link
      href={setId ? `/quiz/${setId}` : "#"}
      className={`${base} bg-terra-100 dark:bg-night-800 border border-terra-200 dark:border-night-600 active:scale-[0.99] transition`}
    >
      <div>
        <div className="text-xs text-ink-600 dark:text-cream-300">{SLOT_LABEL[slot]} · open until midnight</div>
        <div className="font-medium">{SECTION_LABEL[section]}</div>
        <div className="text-sm text-terra-600 dark:text-terra-200">
          {started ? "in progress — picks up where you left off" : "8 questions"}
          {isFallback ? " · backup set" : ""}
        </div>
      </div>
      <div className="rounded-full bg-terra-500 text-white text-sm font-medium px-4 py-2">
        {started ? "Continue" : "Start"}
      </div>
    </Link>
  );
}
