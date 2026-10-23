import { freshDb, setupSql, as, check, throws } from "./harness.mjs";

const ADMIN = "arda.theodore@gmail.com";

export default async function () {
  const db = await freshDb();
  await db.exec(setupSql());
  await db.exec(setupSql()); // idempotent with the guestbook objects too
  await db.exec(`
    insert into invitations (token, name, max_guests, status, party_size, thank_you_note, gift_note)
    values ('tok-a', 'Ayşe & Mehmet', 2, 'accepted', 2, 'Sizi görmek harikaydı!', 'çeyrek altın'),
           ('tok-b', 'John', 1, 'declined', 0, null, null);
  `);
  const anon = (sql, params) => as(db, "anon", null, () => db.query(sql, params));

  // get_invitation shows the guest their thank-you note, never the gift note.
  const inv = (await anon("select * from get_invitation('tok-a')")).rows[0];
  check("get_invitation returns thank_you_note", inv?.thank_you_note === "Sizi görmek harikaydı!");
  check("get_invitation never returns gift_note", inv && !("gift_note" in inv));

  // From a personal link the name defaults to the invitation's.
  await anon("select submit_wish('tok-a', '', 'Mutluluklar! 💛')");
  const w1 = (await db.query("select name, invitation_id, approved from wishes")).rows[0];
  check("a link's note takes the invitation name", w1.name === "Ayşe & Mehmet", w1.name);
  check("a link's note is tied to it and unapproved", w1.invitation_id != null && w1.approved === false);

  await throws("an anonymous note needs a name", anon("select submit_wish('', '', 'hi')"), "name");
  await anon("select submit_wish(null, 'Zeynep', 'Çok güzeldi')");
  await throws("an empty note is refused", anon("select submit_wish('tok-a', 'x', '   ')"), "empty");
  await throws("an unknown token is refused", anon("select submit_wish('nope', 'x', 'hi')"), "invalid");

  await anon("select submit_wish('tok-b', $1, $2)", ["n".repeat(500), "m".repeat(5000)]);
  const long = (await db.query("select length(name) ln, length(message) lm from wishes where name like 'nnn%'")).rows[0];
  check("name capped at 80 chars, message at 1000", long.ln === 80 && long.lm === 1000, JSON.stringify(long));

  for (let i = 0; i < 4; i++) await anon("select submit_wish('tok-a', '', $1)", ["note " + i]);
  await throws("a 6th note from one invitation is refused", anon("select submit_wish('tok-a', '', 'one more')"), "limit");

  await db.exec("update settings set value = 'false' where key = 'wishesOpen'");
  await throws("a closed guestbook refuses notes", anon("select submit_wish(null, 'Zeynep', 'again')"), "closed");
  await db.exec("update settings set value = 'true' where key = 'wishesOpen'");

  // Only approved notes reach the public wall; anon can't read the table itself.
  check("the wall is empty before approval", (await anon("select * from get_wishes()")).rows.length === 0);
  await db.exec("update wishes set approved = true where name = 'Zeynep'");
  const wall = (await anon("select * from get_wishes()")).rows;
  check("the wall shows approved notes only, without links to invitations",
    wall.length === 1 && wall[0].name === "Zeynep" && !("invitation_id" in wall[0]));
  check("anon reads no rows from the wishes table (RLS filters them)", (await anon("select * from wishes")).rows.length === 0);

  // Admins (email in admin_emails) moderate; any other login sees nothing.
  const asAdmin = (sql) => as(db, "authenticated", ADMIN, () => db.query(sql));
  check("an admin reads every note", (await asAdmin("select count(*)::int n from wishes")).rows[0].n === 7);
  const stranger = await as(db, "authenticated", "someone@else.com", () => db.query("select count(*)::int n from wishes"));
  check("a non-admin login sees no notes", stranger.rows[0].n === 0);
  await asAdmin("update invitations set thanked_at = now(), gift_note = 'saat' where token = 'tok-b'");
  check("an admin records a thank-you",
    (await db.query("select thanked_at is not null t from invitations where token = 'tok-b'")).rows[0].t);

  await db.exec("delete from invitations where token = 'tok-a'");
  check("notes outlive their invitation (unlinked, not deleted)",
    (await db.query("select count(*)::int n from wishes where name = 'Ayşe & Mehmet' and invitation_id is null")).rows[0].n === 5);

  // Flood guard: 30 notes a minute across the whole book.
  await db.exec("delete from wishes");
  await db.exec("insert into wishes (name, message) select 'x', 'y' from generate_series(1, 30)");
  await throws("more than 30 notes a minute are refused", anon("select submit_wish(null, 'Late', 'hi')"), "busy");
}
