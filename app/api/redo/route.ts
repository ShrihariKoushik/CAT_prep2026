// POST { questionId, chosenIndex } → answer a redo question.
// Updates the SR schedule; never touches DayLog or the streak.
import { prisma } from "@/lib/prisma";
import { onWrongAnswer, onRedoCorrect } from "@/lib/sr";
import { istToday } from "@/lib/time";

export async function POST(req: Request) {
  try {
    const { questionId, chosenIndex } = await req.json();
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) return Response.json({ error: "question not found" }, { status: 404 });
    if (typeof chosenIndex !== "number" || chosenIndex < 0 || chosenIndex > 3) {
      return Response.json({ error: "chosenIndex must be 0-3" }, { status: 400 });
    }

    const isCorrect = chosenIndex === question.correctIndex;
    const today = istToday();

    await prisma.questionAttempt.create({
      data: { questionId, isRedo: true, chosenIndex, isCorrect },
    });

    const item = isCorrect
      ? await onRedoCorrect(questionId, today)
      : await onWrongAnswer(questionId, today);

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
