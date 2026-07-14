// POST { password } → if it matches ADMIN_PASSWORD, set the signed admin cookie.
import { cookies } from "next/headers";
import { adminPassword, makeAdminToken, ADMIN_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (typeof password !== "string" || password !== adminPassword()) {
    return Response.json({ error: "wrong admin password" }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, makeAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // re-ask monthly
    path: "/",
  });
  return Response.json({ ok: true });
}
