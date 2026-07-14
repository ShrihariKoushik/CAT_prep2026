// Factory reset, protected by CRON_SECRET (Authorization: Bearer …).
// Deletes ALL users and their data — next visitor signs up fresh (and becomes
// admin, since they're the first user again). Use between testing rounds.
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function reset(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  await prisma.questionAttempt.deleteMany({});
  await prisma.setAttempt.deleteMany({});
  await prisma.reviewItem.deleteMany({});
  await prisma.dayLog.deleteMany({});
  await prisma.questionSet.deleteMany({}); // cascades questions + contexts
  await prisma.generationJob.deleteMany({});
  await prisma.user.deleteMany({});

  return Response.json({ ok: true });
}

export async function POST(req: Request) {
  return reset(req);
}
export async function GET(req: Request) {
  return reset(req);
}
