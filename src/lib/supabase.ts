import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Both values are safe to embed in the static bundle: the anon key is public
// by design — row-level security + the SECURITY DEFINER functions in
// supabase/setup.sql are what protect the data.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) client = createClient(url, anonKey);
  return client;
}

/** Prefix site-relative URLs with the GitHub Pages base path. */
export function withBase(u: string): string {
  if (/^https?:/i.test(u)) return u;
  if (u.startsWith("/")) return BASE_PATH + u;
  return u;
}
