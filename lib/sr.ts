// Spaced repetition for Redo Mistakes, per user.
// Stage → gap: 0→1d, 1→3d, 2→7d, 3→21d. Correct at stage 3 retires the item.
// Wrong anywhere (fresh set or redo) → stage 0, lapses+1.
import { prisma } from "./prisma";
import { istDayOffset } from "./time";

const GAPS = [1, 3, 7, 21] as const;

export async function onWrongAnswer(questionId: string, userId: string, today: string) {
  return prisma.reviewItem.upsert({
    where: { questionId },
    create: { questionId, userId, stage: 0, dueOn: istDayOffset(today, GAPS[0]), lapses: 1 },
    update: {
      stage: 0,
      dueOn: istDayOffset(today, GAPS[0]),
      lapses: { increment: 1 },
      retiredAt: null,
    },
  });
}

export async function onRedoCorrect(questionId: string, today: string) {
  const item = await prisma.reviewItem.findUnique({ where: { questionId } });
  if (!item || item.retiredAt) return item;
  if (item.stage >= 3) {
    return prisma.reviewItem.update({ where: { questionId }, data: { retiredAt: new Date() } });
  }
  const nextStage = item.stage + 1;
  return prisma.reviewItem.update({
    where: { questionId },
    data: { stage: nextStage, dueOn: istDayOffset(today, GAPS[nextStage]) },
  });
}

export async function dueReviewItems(userId: string, today: string, limit = 20) {
  return prisma.reviewItem.findMany({
    where: { userId, dueOn: { lte: today }, retiredAt: null },
    orderBy: [{ dueOn: "asc" }, { lapses: "desc" }],
    take: limit,
    include: { question: { include: { context: true, set: true } } },
  });
}

export async function dueReviewCount(userId: string, today: string) {
  return prisma.reviewItem.count({ where: { userId, dueOn: { lte: today }, retiredAt: null } });
}
