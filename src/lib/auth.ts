import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "tt_admin";

function adminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  // Dev convenience only — in production ADMIN_PASSWORD must be set.
  if (process.env.NODE_ENV !== "production") return "dev-password";
  return "";
}

function sessionValue(): string {
  const pw = adminPassword();
  if (!pw) return "";
  return createHmac("sha256", pw).update("tt-admin-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function isAdmin(): Promise<boolean> {
  const expected = sessionValue();
  if (!expected) return false;
  const jar = await cookies();
  const got = jar.get(COOKIE)?.value;
  return !!got && safeEqual(got, expected);
}

export async function loginWithPassword(password: string): Promise<boolean> {
  const pw = adminPassword();
  if (!pw || !safeEqual(password, pw)) return false;
  const jar = await cookies();
  jar.set(COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return true;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
