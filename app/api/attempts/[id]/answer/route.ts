// POST { questionId, chosenIndex|null, flagged?, timeSpentSec? }
// Records the answer. Explanation is returned ONLY when an answer was chosen —
// skipped/flagged questions see it after set submission instead.
import { prisma } from "@/lib/prisma";
import { onWrongAnswer } from "@/lib/sr";
import { istToday } from "@/lib/time";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { questionId, chosenIndex = null, flagged = false, timeSpentSec = null } = await req.json();

    const attempt = await prisma.setAttempt.findUnique({ where: { id } });
    if (!attempt) return Response.json({ error: "attempt not found" }, { status: 404 });
    if (attempt.completedAt) return Response.json({ error: "set already submitted" }, { status: 403 });

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question || question.setId !== attempt.setId) {
      return Response.json({ error: "question not in this set" }, { status: 400 });
    }

    const answered = chosenIndex !== null && chosenIndex !== undefined;
    const isCorrect = answered ? chosenIndex === question.correctIndex : null;

    await prisma.questionAttempt.upsert({
      where: { setAttemptId_questionId: { setAttemptId: id, questionId } },
      create: { questionId, setAttemptId: id, chosenIndex, isCorrect, flagged, timeSpentSec },
      update: { chosenIndex, isCorrect, flagged, timeSpentSec, answeredAt: new Date() },
    });

    if (isCorrect === false) await onWrongAnswer(questionId, istToday());

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
