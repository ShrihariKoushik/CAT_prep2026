// POST → finalize the set: score, level rule, streak/day rollup.
// Idempotent AND race-safe: completion is "claimed" with a conditional update,
// so two simultaneous submits can't double-apply the streak or level rule.
import { prisma } from "@/lib/prisma";
import { applyLevelRule, getUserState } from "@/lib/levels";
import { registerSessionCompletion, displayStreak } from "@/lib/streak";
import { istToday } from "@/lib/time";
import { QUESTIONS_PER_SET, type Section } from "@/lib/types";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const attempt = await prisma.setAttempt.findUnique({
      where: { id },
      include: {
        set: { include: { questions: { orderBy: { orderInSet: "asc" } } } },
        answers: true,
      },
    });
    if (!attempt) return Response.json({ error: "attempt not found" }, { status: 404 });

    const buildBreakdown = () =>
      attempt.set.questions.map((q) => {
        const a = attempt.answers.find((x) => x.questionId === q.id);
        return {
          questionId: q.id,
          text: q.text,
          options: JSON.parse(q.options) as string[],
          chosenIndex: a?.chosenIndex ?? null,
          correctIndex: q.correctIndex,
          isCorrect: a?.isCorrect ?? false,
          flagged: a?.flagged ?? false,
          explanation: q.explanation, // set is submitted — everything is revealed now
          timeSpentSec: a?.timeSpentSec ?? null,
        };
      });

    const score = attempt.answers.filter((a) => a.isCorrect === true).length;
    const answered = attempt.answers.filter((a) => a.chosenIndex !== null).length;
    const totalTimeSec = attempt.answers.reduce((s, a) => s + (a.timeSpentSec ?? 0), 0);

    // Atomic claim: only ONE request transitions completedAt from null.
    const { count } = await prisma.setAttempt.updateMany({
      where: { id, completedAt: null },
      data: { completedAt: new Date(), score, totalTimeSec },
    });

    if (count === 0) {
      // Already completed (by an earlier submit or a concurrent one) — return the stored summary.
      const done = await prisma.setAttempt.findUnique({ where: { id } });
      return Response.json({
        score: done?.score ?? score,
        total: QUESTIONS_PER_SET,
        totalTimeSec: done?.totalTimeSec ?? totalTimeSec,
        levelBefore: attempt.levelBefore,
        levelAfter: done?.levelAfter ?? attempt.levelBefore,
        breakdown: buildBreakdown(),
        alreadyCompleted: true,
      });
    }

    const today = istToday();
    const { before, after } = await applyLevelRule(attempt.set.section as Section);
    await prisma.setAttempt.update({ where: { id }, data: { levelAfter: after } });
    await registerSessionCompletion(today, answered, score);

    const state = await getUserState();
    return Response.json({
      score,
      total: QUESTIONS_PER_SET,
      totalTimeSec,
      levelBefore: before,
      levelAfter: after,
      streak: displayStreak(state, today),
      breakdown: buildBreakdown(),
    });
  } catch (e) {
    console.error("POST /api/attempts/[id]/complete", e);
    return Response.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
