// POST { setId } → start (or resume) the attempt for one of MY sets. Idempotent.
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/auth";
import { currentLevel } from "@/lib/levels";
import { istToday, unlockAtMs } from "@/lib/time";
import type { Section, Slot } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const userId = await sessionUserId();
    if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

    const { setId } = await req.json();
    const set = await prisma.questionSet.findUnique({
      where: { id: setId },
      include: { attempt: true },
    });
    if (!set || set.userId !== userId) {
      return Response.json({ error: "set not found" }, { status: 404 });
    }

    if (set.attempt) {
      return Response.json({ attemptId: set.attempt.id, resumed: true });
    }

    const today = istToday();
    if (set.day !== today) {
      return Response.json({ error: "this set has moved to the archive" }, { status: 403 });
    }
    if (Date.now() < unlockAtMs(set.day, set.slot as Slot)) {
      return Response.json({ error: "session not unlocked yet" }, { status: 403 });
    }

    try {
      const attempt = await prisma.setAttempt.create({
        data: { setId, userId, levelBefore: await currentLevel(set.section as Section, userId) },
      });
      return Response.json({ attemptId: attempt.id, resumed: false });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
        const existing = await prisma.setAttempt.findUnique({ where: { setId } });
        if (existing) return Response.json({ attemptId: existing.id, resumed: true });
      }
      throw e;
    }
  } catch (e) {
    console.error("POST /api/attempts", e);
    return Response.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
