// POST { name } → save her name (asked once on first open).
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { name } = await req.json();
  const trimmed = typeof name === "string" ? name.trim().slice(0, 40) : "";
  if (!trimmed) return Response.json({ error: "name required" }, { status: 400 });

  await prisma.userState.upsert({
    where: { id: 1 },
    create: { id: 1, name: trimmed },
    update: { name: trimmed },
  });
  return Response.json({ ok: true, name: trimmed });
}
