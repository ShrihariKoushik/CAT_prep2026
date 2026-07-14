// Home-screen data assembly for the logged-in user. Also the retry-on-page-load
// path: missing/failed sets get an instant seed-bank fallback, and real
// generation retries in the background (through the per-user lock) via after().
import { after } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";
import { istToday, istDayOffset, unlockAtMs, endOfDayMs } from "./time";
import { SECTIONS, SLOT_FOR_SECTION, type Section, type Slot } from "./types";
import { replenishFreeze, displayStreak } from "./streak";
import { createFallbackSet } from "./seedBank";
import { generateWithLock } from "./generation/generate";
import { dueReviewCount } from "./sr";

export type SessionCardData = {
  section: Section;
  slot: Slot;
  state: "LOCKED" | "OPEN" | "COMPLETED";
  unlockAt: number;
  expiresAt: number;
  setId: string | null;
  isFallback: boolean;
  started: boolean;
  score: number | null;
  levelDelta: number | null;
};

export type HeatmapCell = { day: string; count: number; freezeUsed: boolean };

export async function getHomeData(user: User) {
  const today = istToday();
  const now = Date.now();
  const userId = user.id;

  const state = await replenishFreeze(userId, today);

  const sessions: SessionCardData[] = [];
  for (const section of SECTIONS) {
    const slot = SLOT_FOR_SECTION[section];
    let set = await prisma.questionSet.findUnique({
      where: { day_section_userId: { day: today, section, userId } },
      include: { attempt: true },
    });

    if (!set) {
      await createFallbackSet(today, section, userId);
      set = await prisma.questionSet.findUnique({
        where: { day_section_userId: { day: today, section, userId } },
        include: { attempt: true },
      });
      after(() => generateWithLock(today, section, userId).catch(() => {}));
    } else if (set.status === "FALLBACK" && !set.attempt) {
      after(() => generateWithLock(today, section, userId).catch(() => {}));
    }

    const unlocked = now >= unlockAtMs(today, slot);
    const completed = !!set?.attempt?.completedAt;
    sessions.push({
      section,
      slot,
      state: completed ? "COMPLETED" : unlocked ? "OPEN" : "LOCKED",
      unlockAt: unlockAtMs(today, slot),
      expiresAt: endOfDayMs(today),
      setId: set?.id ?? null,
      isFallback: set?.isFallback ?? false,
      started: !!set?.attempt && !completed,
      score: set?.attempt?.score ?? null,
      levelDelta:
        set?.attempt?.levelAfter != null
          ? set.attempt.levelAfter - set.attempt.levelBefore
          : null,
    });
  }

  const since = istDayOffset(today, -89);
  const logs = await prisma.dayLog.findMany({ where: { userId, day: { gte: since } } });
  const byDay = new Map<string, (typeof logs)[number]>(logs.map((l) => [l.day, l]));
  const heatmap: HeatmapCell[] = [];
  for (let i = 0; i < 90; i++) {
    const day = istDayOffset(since, i);
    const l = byDay.get(day);
    heatmap.push({ day, count: l?.sessionsCompleted ?? 0, freezeUsed: l?.freezeUsed ?? false });
  }

  return {
    today,
    name: state.name,
    isAdmin: state.isAdmin,
    sessions,
    levels: { QUANT: state.levelQuant, VARC: state.levelVarc, LRDI: state.levelLrdi },
    streak: {
      current: displayStreak(state, today),
      longest: state.longestStreak,
      freezeAvailable: state.freezeAvailable,
    },
    totals: { answered: state.totalAnswered, correct: state.totalCorrect },
    heatmap,
    redoDue: await dueReviewCount(userId, today),
  };
}
