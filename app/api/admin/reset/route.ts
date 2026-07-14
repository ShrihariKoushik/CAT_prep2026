// POST (or GET) with Authorization: Bearer CRON_SECRET →
// wipe all personal state so the app starts fresh (name prompt, streak 0,
// levels 1, empty archive of attempts). Generated question sets are kept
// unless ?sets=1 is passed, which deletes them too (next open regenerates).
// Use before handing the app over after testing.
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function reset(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const wipeSets = new URL(req.url).searchParams.get("sets") === "1";

  await prisma.questionAttempt.deleteMany({});
  await prisma.setAttempt.deleteMany({});
  await prisma.reviewItem.deleteMany({});
  await prisma.dayLog.deleteMany({});
  await prisma.userState.deleteMany({}); // recreated (blank) on next page load

  if (wipeSets) {
    await prisma.questionSet.deleteMany({}); // cascades questions + contexts
    await prisma.generationJob.deleteMany({});
  }

  return Response.json({ ok: true, wipedSets: wipeSets });
}

export async function POST(req: Request) {
  return reset(req);
}
export async function GET(req: Request) {
  return reset(req);
}
