#!/usr/bin/env node
// supabase/seed.json is the one source of default settings + story chapters.
// The app reads it directly (model.ts, the mock, the story page via
// write-story-config); SQL can't, so this writes the seed block of
// supabase/setup.sql from it.
//
//   node tools/sync-seed.mjs          # rewrite the block in setup.sql
//   node tools/sync-seed.mjs --check  # exit 1 if setup.sql is out of date
//
// The inserts are `on conflict do nothing`, so re-running setup.sql on a live
// project never overwrites what the couple has edited since.

import fs from "node:fs";

const SQL = new URL("../supabase/setup.sql", import.meta.url);
const SEED = new URL("../supabase/seed.json", import.meta.url);
const BEGIN = "-- >>> seed: generated from supabase/seed.json by `npm run seed:sync` — edit the JSON, not this block";
const END = "-- <<< seed";

const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
const q = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const json = (v) => q(JSON.stringify(v)) + "::jsonb";

const settings = Object.entries(seed.settings).map(([k, v]) => `  (${q(k)}, ${q(v)})`);
const chapters = seed.chapters.map((c) =>
  "  (" +
  [
    c.position, q(c.slug), c.visible, c.night, json(c.photos), q(c.photo_layout), q(c.photo_fit),
    c.tilt, c.autoplay, c.autoplay_ms, json(c.tr), json(c.en),
  ].join(", ") +
  ")"
);

const block = [
  BEGIN,
  "insert into public.settings (key, value) values",
  settings.join(",\n"),
  "on conflict do nothing;",
  "",
  "insert into public.story_chapters",
  "  (position, slug, visible, night, photos, photo_layout, photo_fit, tilt, autoplay, autoplay_ms, tr, en) values",
  chapters.join(",\n"),
  "on conflict (slug) do nothing;",
  END,
].join("\n");

const sql = fs.readFileSync(SQL, "utf8").replace(/\r\n/g, "\n");
const start = sql.indexOf(BEGIN);
const end = sql.indexOf(END);
if (start < 0 || end < start) {
  console.error("setup.sql has no seed block (markers `-- >>> seed` … `-- <<< seed`).");
  process.exit(1);
}
const next = sql.slice(0, start) + block + sql.slice(end + END.length);

if (process.argv.includes("--check")) {
  if (next !== sql) {
    console.error("supabase/setup.sql is out of date with supabase/seed.json — run `npm run seed:sync`.");
    process.exit(1);
  }
  console.log("seed: setup.sql matches seed.json");
} else {
  fs.writeFileSync(SQL, next);
  console.log(`seed: wrote ${settings.length} settings + ${chapters.length} chapters into setup.sql`);
}
