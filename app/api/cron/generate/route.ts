// Vercel Cron target. vercel.json schedules "35 18 * * *" UTC = 00:05 IST.
import { prisma } from "@/lib/prisma";
import { cronGenerate } from "@/lib/generation/generate";
import { istToday } from "@/lib/time";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const day = istToday();

  // ?force=1 → throw away today's UNSTARTED sets and regenerate them
  // (e.g. after changing difficulty descriptors). Started/completed sets are kept.
  if (new URL(req.url).searchParams.get("force") === "1") {
    await prisma.questionSet.deleteMany({ where: { day, attempt: null } });
    await prisma.generationJob.deleteMany({ where: { day } });
  }

  const results = await cronGenerate(day);
  return Response.json({ ok: true, day, results });
}
