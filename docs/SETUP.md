# Setup & deployment

Everything you need to stand the site up. You do this once; after that you run
the whole thing from the `/admin` dashboard.

## 1. Supabase (~5 minutes, free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste the whole of
   [`../supabase/setup.sql`](../supabase/setup.sql) → **Run**.
   - ⚠️ First check the `admin_emails` insert near the top — those emails get
     dashboard access.
   - The script is **idempotent**: safe to re-run after edits or upgrades
     (existing data is kept, new columns/settings are added).
3. **Authentication → Users → Add user** — create an admin account (email +
   strong password) for **each** email in `admin_emails`. Those are the logins
   for `/admin`.
4. **Authentication → Sign In / Up** — turn **off** "Allow new users to sign up".
5. *(Recommended)* **Authentication → password settings** — turn on
   **Leaked password protection**.
6. **Settings → API** — copy the *Project URL* and the *anon public* key.

**Security model:** guests never touch the tables. They only call the
`SECURITY DEFINER` functions (`get_invitation`, `submit_rsvp`, `general_track`,
`mark_invitation_opened`), which act on a single row by its unguessable token
and enforce the deadline + party-size cap in SQL. The tables are readable/
writable only by logged-in users whose email is in `admin_emails`.

## 2. GitHub Pages

1. Repo **Settings → Secrets and variables → Actions → Variables** — add:
   - `NEXT_PUBLIC_SUPABASE_URL` — the project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key (public by design)
   - `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BASE_PATH` — **optional**. The
     [deploy workflow](../.github/workflows/deploy.yml) defaults these to the
     project-page location (`https://<owner>.github.io` + `/<repo>`), so link
     previews work out of the box. Only set them for a custom domain (below).
2. Repo **Settings → Pages** — set *Source* to **GitHub Actions**.
3. Merge to `main` (or run the workflow manually). It builds the static export
   and publishes it.

Invitation links look like `https://…/i/?t=<token>` (the admin **Copy link**
button produces them). The prettier `/i/<token>` form also works via a small
`404.html` redirect.

### Custom domain — subdomain `wedding.ardacanbakis.com` (Cloudflare DNS)

`public/CNAME` contains `wedding.ardacanbakis.com`, and the deploy workflow
reads it — so links, the base path, and share-preview URLs all switch to the
subdomain automatically. A subdomain leaves the apex (`ardacanbakis.com`,
e.g. a portfolio) completely untouched. You just need one DNS record + the
GitHub setting:

1. **Cloudflare DNS — do this first.** Add a single record:
   - **Type:** CNAME
   - **Name:** `wedding`  (Cloudflare shows it as `wedding.ardacanbakis.com`)
   - **Target:** `ardacanbakis.github.io`
   - **Proxy status:** **DNS only (grey cloud)** — important. Turn the orange
     cloud OFF, at least until HTTPS is working. Proxying (orange cloud) can
     block GitHub from issuing the certificate and cause redirect loops. If you
     later want Cloudflare's proxy, first confirm HTTPS works DNS-only, then
     enable the proxy with SSL/TLS mode **Full (strict)**.
   - No apex A/AAAA records are needed for a subdomain.
2. **GitHub → repo Settings → Pages → Custom domain** — enter
   `wedding.ardacanbakis.com`, Save. Once it verifies (green check), tick
   **Enforce HTTPS**.
3. Merge to `main`. The site deploys at `https://wedding.ardacanbakis.com`; new
   invitation links and the WhatsApp preview image use it.

To move back to `username.github.io/<repo>`, delete `public/CNAME` (and clear
the Pages custom-domain setting). Setting repo Actions Variables still overrides
everything if you ever need to.

## 3. Local development

```bash
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm install
npm run dev                  # http://localhost:3000
```

### Without a real Supabase project (mock backend)

```bash
node tools/mock-supabase.mjs                          # terminal 1
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon npm run dev   # terminal 2
```

Mock admin login: `admin@example.com` / `test-pass-123`.

## 4. Photos

### Story / timeline photos
`public/story/` holds the timeline site (React vendored locally — no CDN). Drop
images into `public/story/assets/` and reference the filenames from
**/admin → Story & Timeline → each chapter**.

### Smaller phone images (optional but recommended)
The story page can load a lighter copy on phones. For any `photo.jpg`, add a
`photo-mobile.jpg` next to it in `public/story/assets/`. On phones the site
requests the `-mobile` file and **falls back to the full image automatically**
if it's missing. Toggle under **Story & Timeline → Smaller images on phones**.

### Share-preview image
`public/og-image.png` is the WhatsApp/iMessage/Facebook link thumbnail. It's
center-cropped to a square in WhatsApp chats, so a **square** image (e.g.
1080×1080) fits best. The build reads its real dimensions automatically — just
drop in a replacement.

## 5. Things to double-check

- **Defaults** (event details, texts, story chapters) come from
  [`supabase/seed.json`](../supabase/seed.json) — a snapshot of the live site
  (29 Aug 2026, Mango Garden · İncek, Ankara). Change the live values in
  **/admin**; change the defaults in `seed.json`, then `npm run seed:sync`.
- **WhatsApp templates** (invite + reminder) and the **contact number** are at
  the bottom of the Invitations tab / in Settings.

## 6. Backup, restore & a staging copy

The project runs on Supabase's **free tier**, which has **no automatic daily
backups** and pauses after ~1 week of inactivity (a paused project can be
resumed from the dashboard for 90 days). The guest list is irreplaceable, so
take a snapshot before any schema change.

The whole site is three things:

| Part | Where it lives | Covered by |
| --- | --- | --- |
| Code, story photos, OG image | git (`public/story/assets/`, `public/og-image.png`) | a git tag (below) |
| Guests, settings, story text, seating, counters | Supabase `public` schema | `tools/db-snapshot.sh` |
| Admin logins | Supabase `auth.users` | **not copied** — re-create them (§1.3) |

Supabase Storage isn't used, so there is nothing else to save.

### Snapshot

You only need **Docker Desktop**, running. The script runs `pg_dump`/`psql`
from the `postgres:17` image, so there's nothing to install or version-match.
Run it from **Git Bash**. In PowerShell, `bash` may start WSL instead.

```bash
bash tools/db-snapshot.sh dump
```

It asks for the live project's **Session pooler** URI (Dashboard → **Connect**
→ *Session pooler*; the direct host is IPv6-only, which Docker can't reach).
The input is hidden, so the database password stays out of your shell history.
You get `backups/<date_time>/`:

- `data.sql` — every row of the `public` schema (what a restore loads)
- `schema.sql` — production's actual schema, to diff against `setup.sql`
- `counts.txt` — rows per table, which the restore checks against

`backups/` is gitignored. Dumps contain guest names and notes, so never commit
one.

### Restore / clone into another project

```bash
bash tools/db-snapshot.sh restore backups/<date_time>
```

It asks for the **target** project's URI and makes you type its project ref.
Then it runs `setup.sql` (schema, RLS, RPCs), **truncates every public table**,
loads `data.sql` in one transaction, and compares row counts with the snapshot.
It refuses to restore into the project the snapshot came from. For a deliberate
disaster recovery onto that same project, set `ALLOW_SAME_PROJECT=1`.

> **Why the truncate:** `setup.sql` seeds default settings, the ten story
> chapters and the general-invite counters with `on conflict do nothing`.
> Loading a dump on top of those keeps the *defaults* and silently drops your
> real event date, venue, texts and story. The script clears the tables first
> for that reason.

If the load fails on a missing table or column, `setup.sql` has drifted from
production. Compare it with `schema.sql`, fix `setup.sql`, and run it again.

### A staging copy to develop against

Keep the live site untouched while you change things:

1. Create a second Supabase project, e.g. `t-t-wedding-staging` (the free tier
   allows two active projects).
2. `bash tools/db-snapshot.sh restore backups/<date_time>` into it.
3. In the staging project: **Authentication → Users → Add user** for each
   admin email, and turn off sign-ups (§1.3–1.4).
4. Put the *staging* Project URL and anon key in `.env.local` (§3), then
   `npm install` and `npm run dev`. That's a working copy of the real site and
   data at http://localhost:3000. Nothing reaches production until you merge
   to `main`.

Guest tokens are copied too, so a staging invite link opens the same guest's
invitation. RSVPs made there only change staging.

No Docker to hand? **Table Editor → (each table) → Export CSV** is a decent
belt-and-braces copy, but it carries no schema, RLS or RPCs — you'd re-run
`setup.sql` and re-import the rows by hand.

### Code restore points

| Tag | Commit | What it is |
| --- | --- | --- |
| `v1-admin-baseline` | `12cd267` | Full admin panel before the Table Planner was added |
| `live-2026-10-10` | `dbc0609` | The site as it stood after the wedding (29 Aug 2026), before post-wedding work |

```bash
git tag -a live-2026-10-10 dbc0609 -m "Live site after the wedding"
git push origin --tags        # tags only exist locally until pushed
git checkout live-2026-10-10  # inspect / rebuild that exact version
```
