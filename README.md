# Tansu & Arda — Wedding RSVP

A bilingual (TR/EN) wedding invitation site with per-guest invitation links,
an admin dashboard, and the couple's story/timeline site hosted alongside it.

Built with Next.js (App Router) + SQLite (via libSQL) — no external services
needed; designed for simple self-hosting.

## What's inside

| Route | What it is |
| --- | --- |
| `/` | Small landing page (guests arrive via their personal links) |
| `/i/<token>` | A guest's personal invitation + RSVP form (TR/EN toggle) |
| `/story` | The timeline / love-story site (static, from the Claude design project) |
| `/admin` | Password-protected dashboard |
| `/admin/export` | CSV export of all responses |

### Guest features
- Personal unguessable link per invitation (one link can cover a household)
- Accept / decline, party size (capped at the per-invitation max, or free-form
  for "unlimited" invitees), free-text note (dietary needs / message)
- Guests can re-open their link and edit their answer **until the RSVP
  deadline**; after that the page shows their answer but locks editing
- Countdown, date/venue with Google Maps link, optional schedule
- Turkish/English toggle — shares the `ta-love-lang` preference with the
  story site so the language follows guests across both

### Admin features (`/admin`)
- Single shared password (`ADMIN_PASSWORD` env var), signed session cookie
- Bulk import: paste one invitee per line — `Name, maxGuests`
  (e.g. `Ayşe & Mehmet Yılmaz, 4`, `John Smith, unlimited`, default max 1)
- Add / edit / delete single invitations
- Accepted / declined / no-response lists, party sizes, notes, total confirmed
  headcount, per-guest copy-link button, CSV export
- Settings: RSVP deadline, wedding date/time, venue, maps link, schedule,
  story URL

## Running it

```bash
cp .env.example .env   # set ADMIN_PASSWORD
npm install
npm run dev            # http://localhost:3000
```

The database is a plain SQLite file created automatically at
`data/wedding.db` — tables are created on first use, nothing to migrate.
**Back up that one file and you've backed up every RSVP.**

### Self-hosting (production)

```bash
npm install
npm run build
ADMIN_PASSWORD=your-secret npm start   # port 3000
```

Or with Docker:

```bash
docker build -t tt-wedding .
docker run -d -p 3000:3000 -e ADMIN_PASSWORD=your-secret \
  -v tt-wedding-data:/app/data tt-wedding
```

Put it behind your reverse proxy (Caddy/nginx) with HTTPS — the admin cookie
is `secure` in production, so HTTPS is required for admin login.

> **GitHub Pages note:** Pages only serves static files, so the RSVP app
> (database + per-guest forms) can't run there. The `/story` site *is* fully
> static though — the contents of `public/story/` can be deployed to Pages on
> their own if you ever want that. For the full site, use any box that can run
> Node (or the Docker image above).

### Optional: hosted database

Set `DATABASE_URL` (and `DATABASE_AUTH_TOKEN`) to a Turso/libSQL database to
use a hosted DB instead of the local file — useful if you ever move to a
serverless platform.

## Story site assets

`public/story/` contains the timeline site from the Claude design project.
Copy its images into `public/story/assets/` (see the README in that folder),
plus the `.image-slots.state.json` sidecar if you have one, so the dropped
photos appear.

## Things to double-check

- **Wedding date**: defaults were taken from the timeline site
  (28 June 2026, 14:30, Germencik Belediyesi · Aydın) — edit in
  `/admin` → Settings if needed, including the RSVP deadline.
