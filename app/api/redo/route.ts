// POST { questionId, chosenIndex } → answer one of MY redo questions.
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/auth";
import { onWrongAnswer, onRedoCorrect } from "@/lib/sr";
import { istToday } from "@/lib/time";

export async function POST(req: Request) {
  try {
    const userId = await sessionUserId();
    if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

    const { questionId, chosenIndex } = await req.json();
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { set: true },
    });
    if (!question || question.set?.userId !== userId) {
      return Response.json({ error: "question not found" }, { status: 404 });
    }
    if (typeof chosenIndex !== "number" || chosenIndex < 0 || chosenIndex > 3) {
      return Response.json({ error: "chosenIndex must be 0-3" }, { status: 400 });
    }

    const isCorrect = chosenIndex === question.correctIndex;
    const today = istToday();

    await prisma.questionAttempt.create({
      data: { questionId, userId, isRedo: true, chosenIndex, isCorrect },
    });

    const item = isCorrect
      ? await onRedoCorrect(questionId, today)
      : await onWrongAnswer(questionId, userId, today);

    return Response.json({
      isCorrect,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      retired: !!item?.retiredAt,
      nextDueOn: item?.retiredAt ? null : item?.dueOn ?? null,
    });
  } catch (e) {
    console.error("POST /api/redo", e);
    return Response.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
