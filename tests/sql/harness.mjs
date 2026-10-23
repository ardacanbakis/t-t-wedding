// Runs supabase/setup.sql on a real Postgres (PGlite — Postgres compiled to
// WebAssembly, so no Docker or server) dressed up enough like Supabase: the
// anon/authenticated roles and an auth.jwt() fed from a GUC, so RLS policies
// and SECURITY DEFINER functions behave as they do in production.

import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const ROOT = new URL("../../", import.meta.url);
export const readRepo = (rel) => fs.readFileSync(new URL(rel, ROOT), "utf8");
export const setupSql = () => readRepo("supabase/setup.sql");
export const seed = () => JSON.parse(readRepo("supabase/seed.json"));

/** A fresh database with Supabase's roles + auth.jwt(), before setup.sql. */
export async function freshDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    -- Supabase grants table rights broadly and leaves access control to RLS.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
  `);
  return db;
}

/** Run fn as a role — "anon", or "authenticated" with a login email. */
export async function as(db, role, email, fn) {
  const claims = JSON.stringify(email ? { email } : {});
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}

let failures = 0;
export function check(name, cond, detail = "") {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail ? " — " + detail : ""}`);
  if (!cond) failures++;
}
export async function throws(name, promise, match) {
  try {
    await promise;
    check(name, false, "did not throw");
  } catch (e) {
    check(name, !match || String(e.message).includes(match), e.message);
  }
}
export const failed = () => failures;
