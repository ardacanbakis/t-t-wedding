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

- **Event details** default to 28 June 2026, 14:30, Germencik Belediyesi ·
  Aydın. Change them (and the RSVP deadline) in **/admin → Invitation Styling →
  Settings**.
- **WhatsApp templates** (invite + reminder) and the **contact number** are at
  the bottom of the Invitations tab / in Settings.

## 6. Backup & restore

The project runs on Supabase's **free tier**, which has **no automatic daily
backups** and pauses after ~1 week of inactivity. The guest list is
irreplaceable, so take a manual dump before any schema change (and again close
to the wedding).

**Step 1 — connection string.** Dashboard → *Project Settings → Database →
Connection string → URI*. If a direct connection fails, use the **Session
pooler** URI (direct connections are IPv6-only on newer projects). Then:

```bash
export SUPABASE_DB_URL='postgresql://postgres:...@...supabase.com:5432/postgres'
```

**Step 2 — match the Postgres version.** Check it under *Settings →
Infrastructure*. `pg_dump` refuses to dump from a server **newer** than itself,
so a PG17 project needs pg_dump 17 (or the Supabase CLI, which bundles a
matching version).

**Step 3 — take both dumps.** Only the `public` schema; `auth` and `storage`
are Supabase-managed.

```bash
mkdir -p backups

# Data only — the one you'll normally restore.
pg_dump "$SUPABASE_DB_URL" --schema=public --data-only \
  --inserts --on-conflict-do-nothing --no-owner --no-privileges \
  -f backups/tt-data-$(date +%F).sql

# Full schema + data — a snapshot for rebuilding from nothing.
pg_dump "$SUPABASE_DB_URL" --schema=public \
  --no-owner --no-privileges -f backups/tt-full-$(date +%F).sql
```

`--inserts --on-conflict-do-nothing` is what makes the data dump safe to re-run
against a database that already has rows; a plain `COPY` dump collides on
primary keys.

**Step 4 — verify it.** An untested backup is not a backup. Compare the row
counts in the dump against the live database:

```bash
psql "$SUPABASE_DB_URL" -c "select 'invitations' t, count(*) from invitations
  union all select 'settings', count(*) from settings
  union all select 'story_chapters', count(*) from story_chapters
  union all select 'seating_plans', count(*) from seating_plans;"
grep -c "^INSERT INTO public.invitations" backups/tt-data-$(date +%F).sql
```

**Step 5 — restore.** Into a fresh or reset project:

```bash
psql "$SUPABASE_DB_URL" -f supabase/setup.sql          # schema, RLS, RPCs, seeds
psql "$SUPABASE_DB_URL" -f backups/tt-data-<date>.sql  # rows
```

**Step 6 — keep dumps out of git.** `backups/` is gitignored. Dumps contain
guest names and notes, and the connection string embeds the database password —
never commit one.

> ⚠️ **Admin logins are not in the backup.** They live in `auth.users`, outside
> the `public` schema. After restoring into a *new* project, re-create an admin
> user (step 1.3 above) for each address in `admin_emails` — that table *is* in
> `public`, so the allow-list itself restores fine.

No tooling to hand? **Table Editor → (each table) → Export CSV** is a decent
belt-and-braces copy, but it carries no schema, RLS or RPCs — you'd re-run
`setup.sql` and re-import the rows by hand.

### Code restore points

| Tag | Commit | What it is |
| --- | --- | --- |
| `v1-admin-baseline` | `12cd267` | Full admin panel before the Table Planner was added |

```bash
git checkout 12cd267          # inspect the baseline
git tag -a v1-admin-baseline 12cd267 -m "Baseline before the seating simulator"
git push origin v1-admin-baseline
```
