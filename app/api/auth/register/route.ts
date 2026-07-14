// POST { username, password, name } → create account + log in.
// The FIRST user ever registered becomes the admin.
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword, makeSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password, name } = await req.json();
    const uname = typeof username === "string" ? username.trim().toLowerCase() : "";
    const pname = typeof name === "string" ? name.trim().slice(0, 40) : "";
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
      return Response.json({ error: "username: 3-20 chars, letters/numbers/underscore" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 6) {
      return Response.json({ error: "password must be at least 6 characters" }, { status: 400 });
    }
    if (!pname) return Response.json({ error: "name required" }, { status: 400 });

    const isFirst = (await prisma.user.count()) === 0;
    let user;
    try {
      user = await prisma.user.create({
        data: { username: uname, passwordHash: hashPassword(password), name: pname, isAdmin: isFirst },
      });
    } catch {
      return Response.json({ error: "username already taken" }, { status: 409 });
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
    console.error("POST /api/auth/register", e);
    return Response.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
