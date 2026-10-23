import { freshDb, setupSql, as, check, throws } from "./harness.mjs";

export default async function () {
  const db = await freshDb();
  await db.exec(setupSql());
  await db.exec(`
    insert into invitations (token, name, max_guests) values ('two', 'Ayşe & Mehmet', 2), ('open', 'Big Family', null);
    update settings set value = (now() + interval '1 day')::text where key = 'rsvpDeadline';
  `);
  const rsvp = (token, answer, size) =>
    as(db, "anon", null, () => db.query("select * from submit_rsvp($1, $2, $3, 'note')", [token, answer, size]));

  check("accepting clamps the party to the invite's max", (await rsvp("two", "accepted", 5)).rows[0].party_size === 2);
  check("an unlimited invite is capped at 99", (await rsvp("open", "accepted", 500)).rows[0].party_size === 99);
  check("declining records a party of 0", (await rsvp("two", "declined", 2)).rows[0].party_size === 0);
  await throws("an unknown token is refused", rsvp("nope", "accepted", 1), "invalid");
  await throws("a bogus answer is refused", rsvp("two", "maybe", 1), "invalid");

  await db.exec("update settings set value = (now() - interval '1 minute')::text where key = 'rsvpDeadline'");
  await throws("answers lock after the deadline", rsvp("two", "accepted", 1), "locked");

  await throws("anon cannot read invitations directly",
    as(db, "anon", null, () => db.query("select * from invitations")).then((r) => {
      if (r.rows.length) throw new Error("leaked rows");
      throw new Error("filtered");
    }), "filtered");
}
