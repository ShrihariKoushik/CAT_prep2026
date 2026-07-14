// POST { username, password } → verify against DB, set session cookie (1 year).
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword, makeSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    const uname = typeof username === "string" ? username.trim().toLowerCase() : "";
    const user = uname ? await prisma.user.findUnique({ where: { username: uname } }) : null;

    if (!user || typeof password !== "string" || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "wrong username or password" }, { status: 401 });
    }

    const jar = await cookies();
    jar.set(SESSION_COOKIE, makeSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return Response.json({ ok: true, name: user.name, isAdmin: user.isAdmin });
  } catch (e) {
    console.error("POST /api/auth/login", e);
    return Response.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
