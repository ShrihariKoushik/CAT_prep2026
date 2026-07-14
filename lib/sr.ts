// Spaced repetition for Redo Mistakes.
// Stage → gap: 0→1d, 1→3d, 2→7d, 3→21d. Correct at stage 3 retires the item.
// Wrong anywhere (fresh set or redo) → stage 0, lapses+1.
import { prisma } from "./prisma";
import { istDayOffset } from "./time";

const GAPS = [1, 3, 7, 21] as const;

/** Called whenever she answers a question WRONG (fresh or redo). */
export async function onWrongAnswer(questionId: string, today: string) {
  return prisma.reviewItem.upsert({
    where: { questionId },
    create: { questionId, stage: 0, dueOn: istDayOffset(today, GAPS[0]), lapses: 1 },
    update: {
      stage: 0,
      dueOn: istDayOffset(today, GAPS[0]),
      lapses: { increment: 1 },
      retiredAt: null,
    },
  });
}

/** Called when she answers CORRECTLY in redo mode. Returns the updated item. */
export async function onRedoCorrect(questionId: string, today: string) {
  const item = await prisma.reviewItem.findUnique({ where: { questionId } });
  if (!item || item.retiredAt) return item;
  if (item.stage >= 3) {
    return prisma.reviewItem.update({
      where: { questionId },
      data: { retiredAt: new Date() },
    });
  }
  const nextStage = item.stage + 1;
  return prisma.reviewItem.update({
    where: { questionId },
    data: { stage: nextStage, dueOn: istDayOffset(today, GAPS[nextStage]) },
  });
}

export async function dueReviewItems(today: string, limit = 20) {
  return prisma.reviewItem.findMany({
    where: { dueOn: { lte: today }, retiredAt: null },
    orderBy: [{ dueOn: "asc" }, { lapses: "desc" }],
    take: limit,
    include: { question: { include: { context: true, set: true } } },
  });
}

export async function dueReviewCount(today: string) {
  return prisma.reviewItem.count({ where: { dueOn: { lte: today }, retiredAt: null } });
}
