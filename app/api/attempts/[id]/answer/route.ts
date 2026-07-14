// POST { questionId, chosenIndex|null, flagged?, timeSpentSec? } — records MY answer.
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/auth";
import { onWrongAnswer } from "@/lib/sr";
import { istToday } from "@/lib/time";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUserId();
    if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const { questionId, chosenIndex = null, flagged = false, timeSpentSec = null } = await req.json();

    const attempt = await prisma.setAttempt.findUnique({ where: { id } });
    if (!attempt || attempt.userId !== userId) {
      return Response.json({ error: "attempt not found" }, { status: 404 });
    }
    if (attempt.completedAt) return Response.json({ error: "set already submitted" }, { status: 403 });

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question || question.setId !== attempt.setId) {
      return Response.json({ error: "question not in this set" }, { status: 400 });
    }

    const answered = chosenIndex !== null && chosenIndex !== undefined;
    const isCorrect = answered ? chosenIndex === question.correctIndex : null;

    await prisma.questionAttempt.upsert({
      where: { setAttemptId_questionId: { setAttemptId: id, questionId } },
      create: { questionId, setAttemptId: id, userId, chosenIndex, isCorrect, flagged, timeSpentSec },
      update: { chosenIndex, isCorrect, flagged, timeSpentSec, answeredAt: new Date() },
    });

    if (isCorrect === false) await onWrongAnswer(questionId, userId, istToday());

    if (!answered) return Response.json({ recorded: true });
    return Response.json({
      recorded: true,
      isCorrect,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    });
  } catch (e) {
    console.error("POST /api/attempts/[id]/answer", e);
    return Response.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
