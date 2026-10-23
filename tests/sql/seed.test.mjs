import { freshDb, setupSql, seed, check } from "./harness.mjs";

export default async function () {
  const { settings: seedSettings, chapters: seedChapters } = seed();
  const db = await freshDb();
  await db.exec(setupSql());
  check("setup.sql runs on an empty database", true);

  const rows = (await db.query("select key, value from settings")).rows;
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const wrong = Object.keys(seedSettings).filter((k) => settings[k] !== seedSettings[k]);
  check("every seed setting lands verbatim", wrong.length === 0, wrong.join(", "));
  check("multi-line message survives quoting", settings.inviteMessage.includes("İncek'te") && settings.inviteMessage.includes("\n\n🔗 {link}"));

  const ch = (await db.query("select slug, photos, tr from story_chapters order by position")).rows;
  check("every seed chapter lands, in order", ch.length === seedChapters.length &&
    ch.every((r, i) => r.slug === seedChapters[i].slug &&
      JSON.stringify(r.tr) === JSON.stringify(seedChapters[i].tr) &&
      JSON.stringify(r.photos) === JSON.stringify(seedChapters[i].photos)));

  // Re-running must be harmless on a live project: no duplicates, no overwrites.
  await db.exec(`update settings set value = 'edited' where key = 'venueName';
                 update story_chapters set tr = '{"title":"edited"}' where slug = 'c1';`);
  await db.exec(setupSql());
  check("re-run keeps an edited setting", (await db.query("select value from settings where key = 'venueName'")).rows[0].value === "edited");
  check("re-run keeps an edited chapter", (await db.query("select tr from story_chapters where slug = 'c1'")).rows[0].tr.title === "edited");
  check("re-run adds no duplicate chapters",
    (await db.query("select count(*)::int n from story_chapters")).rows[0].n === seedChapters.length);
}
