// POST { name } → rename the logged-in user.
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/auth";

export async function POST(req: Request) {
  const userId = await sessionUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { name } = await req.json();
  const trimmed = typeof name === "string" ? name.trim().slice(0, 40) : "";
  if (!trimmed) return Response.json({ error: "name required" }, { status: 400 });

  await prisma.user.update({ where: { id: userId }, data: { name: trimmed } });
  return Response.json({ ok: true, name: trimmed });
}
