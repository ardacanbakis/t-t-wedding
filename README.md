# Tansu & Arda — Wedding RSVP

A bilingual (TR/EN) wedding invitation site with per-guest invitation links,
an admin dashboard, and the couple's story/timeline site hosted alongside it.

**Architecture: static site (GitHub Pages) + Supabase.** The whole site is a
Next.js static export — nothing to keep running yourself. All data lives in a
free Supabase project, accessed straight from the browser and protected by
row-level security and two locked-down SQL functions.

## What's inside

| Route | What it is |
| --- | --- |
| `/` | Small landing page (guests arrive via their personal links) |
| `/i/?t=<token>` | A guest's personal invitation + RSVP form (TR/EN toggle) |
| `/story/` | The timeline / love-story site (static, from the Claude design project) |
| `/admin/` | Login-protected dashboard |

### Guest features
- Personal unguessable link per invitation (one link can cover a household)
- Accept / decline, party size (capped at the per-invitation max, or free-form
  for "unlimited" invitees), free-text note (dietary needs / message)
- Guests can re-open their link and edit their answer **until the RSVP
  deadline** — enforced inside the database, not just the UI; after the
  deadline the page shows their answer but locks editing
- Countdown, date/venue with Google Maps link, optional schedule
- Turkish/English toggle — shares the `ta-love-lang` preference with the
  story site so the language follows guests across both

### Admin features (`/admin`)
- Supabase email/password login (accounts created in the Supabase dashboard;
  allowed emails are listed in the `admin_emails` table)
- Bulk import: paste one invitee per line — `Name, maxGuests`
  (e.g. `Ayşe & Mehmet Yılmaz, 4`, `John Smith, unlimited`, default max 1)
- Add / edit / delete single invitations, each with an optional **personal
  message** shown only on that guest's card
- Accepted / declined / no-response filters, party sizes, notes, total
  confirmed headcount, per-guest copy-link button, CSV export
- Settings: RSVP deadline, wedding date/time, venue, maps link, schedule,
  couple names
- **Invitation texts editor**: every string guests see (greeting, intro,
  buttons, confirmation/locked messages, closing motto, …) editable per
  language (TR/EN); clearing a field restores the default

## Setup (once)

### 1. Supabase (~5 minutes, free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste the whole of
   [`supabase/setup.sql`](supabase/setup.sql) → **Run**.
   ⚠️ First check the `admin_emails` insert near the top — those emails get
   dashboard access. The script is idempotent: re-run it after edits or
   upgrades (existing data is kept).
3. **Authentication → Users → Add user** — create an admin account (email +
   strong password) for **each** email in `admin_emails`. Those are the
   logins for `/admin`.
4. **Authentication → Sign In / Up** — turn OFF "Allow new users to sign up".
5. **Settings → API** — copy the *Project URL* and the *anon public* key.

Security model: guests never touch the tables — they only call
`get_invitation(token)` and `submit_rsvp(...)`, which look up a single row by
its unguessable token and enforce the deadline + party-size cap in SQL. The
tables themselves are only accessible to logged-in users whose email is in
`admin_emails`.

### 2. GitHub Pages

1. Repo **Settings → Secrets and variables → Actions → Variables** — add:
   - `NEXT_PUBLIC_SUPABASE_URL` — the project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key (public by design)
   - `NEXT_PUBLIC_BASE_PATH` — `/t-t-wedding` for
     `username.github.io/t-t-wedding`; leave empty/unset for a custom domain
2. Repo **Settings → Pages** — set *Source* to **GitHub Actions**.
3. Merge to `main` (or run the workflow manually). The
   [`deploy.yml`](.github/workflows/deploy.yml) workflow builds the static
   export and publishes it.

Invitation links look like `https://…/i/?t=<token>` (the admin copy-link
button produces them). The prettier `/i/<token>` form also works — a small
`404.html` redirect handles it.

## Local development

```bash
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm install
npm run dev                  # http://localhost:3000
```

To test without a real Supabase project, run the bundled mock backend and
build against it:

```bash
node tools/mock-supabase.mjs                       # terminal 1
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon npm run dev  # terminal 2
```

(Mock admin login: `admin@example.com` / `test-pass-123`.)

## Story site assets

`public/story/` contains the timeline site from the Claude design project
(React is vendored locally — no CDN dependency). Copy its images into
`public/story/assets/` (see the README in that folder), plus the
`.image-slots.state.json` sidecar if you have one, so the dropped photos
appear.

## Things to double-check

- **Wedding date**: defaults were taken from the timeline site
  (28 June 2026, 14:30, Germencik Belediyesi · Aydın) — edit in
  `/admin` → Settings if needed, including the RSVP deadline.
