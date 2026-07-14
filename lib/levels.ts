// LEVEL RULE: rolling average over the last 3 completed sets taken AT the
// current level. avg >= 75% → +1 (cap 10); avg < 40% → −1 (floor 1); fewer
// than 3 sets at this level → no change. Per user.
import { prisma } from "./prisma";
import { QUESTIONS_PER_SET, type Section } from "./types";

const LEVEL_FIELD: Record<Section, "levelQuant" | "levelVarc" | "levelLrdi"> = {
  QUANT: "levelQuant",
  VARC: "levelVarc",
  LRDI: "levelLrdi",
};

export async function currentLevel(section: Section, userId: string): Promise<number> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user[LEVEL_FIELD[section]];
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
export async function applyLevelRule(section: Section, userId: string) {
  const before = await currentLevel(section, userId);

  const window = await prisma.setAttempt.findMany({
    where: {
      userId,
      completedAt: { not: null },
      levelBefore: before,
      set: { section },
    },
    orderBy: { completedAt: "desc" },
    take: 3,
  });

  const after = computeNextLevel(before, window.map((a) => a.score ?? 0));

  if (after !== before) {
    await prisma.user.update({ where: { id: userId }, data: { [LEVEL_FIELD[section]]: after } });
  }
  return { before, after };
}
