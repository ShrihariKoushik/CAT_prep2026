// LEVEL RULE (see schema comment): rolling average over the last 3 completed
// sets taken AT the current level. avg >= 75% → +1 (cap 10); avg < 40% → −1
// (floor 1); fewer than 3 sets at this level → no change. Requiring the window
// to be at the current level makes each level a 3-day minimum climb — a single
// distracted morning or lucky guess-streak moves nothing.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { QUESTIONS_PER_SET, type Section } from "./types";

type Db = typeof prisma | Prisma.TransactionClient;

const LEVEL_FIELD: Record<Section, "levelQuant" | "levelVarc" | "levelLrdi"> = {
  QUANT: "levelQuant",
  VARC: "levelVarc",
  LRDI: "levelLrdi",
};

export async function getUserState(db: Db = prisma) {
  return db.userState.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

export async function currentLevel(section: Section, db: Db = prisma): Promise<number> {
  const state = await getUserState(db);
  return state[LEVEL_FIELD[section]];
}

/** Pure level rule: scores are the last ≤3 set scores (out of 8) at `before`. */
export function computeNextLevel(before: number, scores: number[]): number {
  if (scores.length < 3) return before;
  const avg = scores.reduce((s, x) => s + x / QUESTIONS_PER_SET, 0) / 3;
  if (avg >= 0.75) return Math.min(10, before + 1);
  if (avg < 0.4) return Math.max(1, before - 1);
  return before;
}

/** Apply the level rule after a set completion. Returns {before, after}. */
export async function applyLevelRule(section: Section, db: Db = prisma) {
  const state = await getUserState(db);
  const before = state[LEVEL_FIELD[section]];

  const window = await db.setAttempt.findMany({
    where: {
      completedAt: { not: null },
      levelBefore: before,
      set: { section },
    },
    orderBy: { completedAt: "desc" },
    take: 3,
  });

  const after = computeNextLevel(before, window.map((a: { score: number | null }) => a.score ?? 0));

  if (after !== before) {
    await db.userState.update({ where: { id: 1 }, data: { [LEVEL_FIELD[section]]: after } });
  }
  return { before, after };
}
