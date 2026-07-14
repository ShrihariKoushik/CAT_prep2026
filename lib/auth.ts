// Auth: scrypt password hashing (no external deps) + HMAC-signed session cookie.
// Server-side only.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SECRET = process.env.AUTH_SECRET ?? process.env.CRON_SECRET ?? "dev-only-secret";
export const SESSION_COOKIE = "dc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // remembered for a year

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function makeSessionToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (sign(payload) !== sig) return null; // tampered
  return payload.split(".")[0] || null;
}

/** userId from the session cookie, or null. */
export async function sessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return parseSessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Full user row for the session, or null. */
export async function currentUser() {
  const id = await sessionUserId();
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

// ---------------------------------------------------------------------------
// Admin access: gated by a dedicated password (ADMIN_PASSWORD env), completely
// independent of user accounts. Knowing the password sets a signed admin
// cookie; no account flag grants admin anymore.
// ---------------------------------------------------------------------------
export const ADMIN_COOKIE = "dc_admin";

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "AdminCat2026";
}

export function makeAdminToken(): string {
  const payload = `admin.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export async function isAdminSession(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const i = token.lastIndexOf(".");
  if (i <= 0) return false;
  const payload = token.slice(0, i);
  return payload.startsWith("admin.") && sign(payload) === token.slice(i + 1);
}
