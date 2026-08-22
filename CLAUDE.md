# CLAUDE.md — project map for AI sessions

Bilingual (TR/EN) wedding site for **Tansu & Arda**. Two things in one repo:
a Next.js **static export** (invitation + RSVP + admin) deployed to GitHub
Pages, and a hand-built static **story/timeline** site under `public/story/`.
All data lives in **Supabase**, reached straight from the browser with the
anon key and guarded by RLS + `SECURITY DEFINER` RPCs.

There is no server to run. The app is 100% static (`output: "export"`).

## Routes (Next.js App Router, `src/app/`)

| Route | File(s) | What it is |
| --- | --- | --- |
| `/` | `page.tsx` | Landing page |
| `/i/?t=<token>` | `i/page.tsx` → `i/invite-loader.tsx` → `i/invite-view.tsx` | Personal invitation + RSVP. `not-found-view.tsx` for bad tokens |
| `/welcome/` | `welcome/page.tsx` → `welcome/welcome-loader.tsx` | General (no-RSVP) invite — reuses `InviteView` with `mode="general"` |
| `/admin/` | `admin/page.tsx` → `admin/dashboard.tsx` (+ `*-card.tsx`) | Login-gated dashboard: Invitations, Table Planner, Styling, Story, General |
| `/story/` | `public/story/index.html` | Story + timeline (NOT a Next route — plain static file) |

`invite-view.tsx` renders both personal and general invites and holds all the
guest-facing RSVP UX (pulse, fade, confirm popup, thank-you/story popup).

## Core libraries (`src/lib/`)

- **`model.ts`** — `SiteSettings` (the whole key/value settings surface, with
  `DEFAULT_SETTINGS`), `Invitation`, `StoryChapter`, general-invite texts,
  `settingsFromRows`, `fillInviteMessage`, message-template defaults. Adding a
  setting = add to `SiteSettings` + `DEFAULT_SETTINGS` here first.
- **`i18n.ts`** — `GuestTexts` (every guest-facing string), `defaultTexts`
  (tr/en), `TEXT_FIELDS` (drives the admin Texts editor), formatters.
- **`blocks.ts`** — the invitation card's block layout model (order / show /
  spacing / align / font-size / colour / font per block) + CSS-var emitter.
- **`supabase.ts`** — `getSupabase()`, `BASE_PATH`, `withBase()`,
  `supabaseConfigured`.

## Settings model (important pattern)

Almost every configurable thing is a row in the `settings` table (key→value
strings), typed by `SiteSettings`. In the dashboard:
- Most settings are edited on `s` and written by the main **Save settings**
  button — which writes every key **except** those in `CARD_OWNED`.
- `CARD_OWNED` keys have their own `doSave*` handlers (story toggles, message
  templates, etc.) and must NOT be double-written by the generic save.

So: a new setting is either (a) added to `CARD_OWNED` + its own `doSave*`, or
(b) left out of `CARD_OWNED` and bound to `s` in the Styling "Settings"
section. Thread every new setting through: `model.ts`, `supabase/setup.sql`
seed, `tools/mock-supabase.mjs` seed, and the admin UI.

## Supabase (`supabase/setup.sql`, idempotent)

Tables: `invitations`, `settings`, `admin_emails`, `story_chapters`,
`general_stats`, `seating_plans`. RLS: tables are admin-only (email in `admin_emails`, checked
by `is_admin()`); guests only reach data through `SECURITY DEFINER` RPCs:
`get_invitation`, `submit_rsvp`, `general_track`, `general_reset` (admin),
`mark_invitation_opened`. All pin `search_path`. Re-running the file is safe;
new columns use `add column if not exists`.

## Story / timeline site (`public/story/index.html`)

A single self-contained file: a small **"dc-runtime" template engine**
(`<sc-if>`, `<sc-for>`, `{{ }}`) compiled to a React app (React is vendored in
`public/story/vendor/`, no CDN). It reads chapters + settings live from
Supabase via `window.__TT_CONFIG` (written at build by
`tools/write-story-config.mjs`).

Gotchas when editing it:
- `on*` handlers work as `{{ }}` bindings inside their scope (`ch.`, `s.`,
  `p.`); a bare top-level `{{ handler }}` inside a `sc-for` does NOT resolve —
  don't put `onError` etc. there (use a `window` capture-phase listener, as the
  `-mobile` image fallback does).
- React serialises inline styles (`bottom:0` → `bottom: 0px`), so don't
  string-match raw style in tests.
- Photos: `url()` swaps in `<name>-mobile.<ext>` on phones when `mobileImages`
  is on; a window `error` listener falls back to the full file.
- Auto-cycle, per-chapter photo autoplay, the cat pool, and night/day
  transition all live in the same class component.

## Build / deploy

- `npm run build` = `write-story-config` → `next build` → `write-og`
  (`tools/write-og.mjs` bakes Open Graph tags; reads real `og-image.png`
  dimensions).
- `.github/workflows/deploy.yml` builds on push to `main` and publishes to
  Pages. It derives `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BASE_PATH` from the
  repo by default (override via repo Actions Variables for a custom domain).
- **Base-path gotcha:** build WITH `NEXT_PUBLIC_BASE_PATH=/t-t-wedding` for
  GitHub project-page deploys, but WITHOUT it for the e2e tests (they serve
  `out/` at the root; Next-page assets 404 under a base path, though the story
  page survives via relative paths).

## Testing (no framework; Playwright scripts)

`tools/mock-supabase.mjs` is an in-memory PostgREST/GoTrue subset (admin login
`admin@example.com` / `test-pass-123`). E2E scripts live in the session
scratchpad and are run via `run-e2e.sh <suite>` (restarts the mock fresh, then
runs the script against `out/` served at root). Keep the mock's seeds/handlers
in sync with `setup.sql`. Continuously-animated buttons need Playwright
`{ force: true }` clicks.

## Conventions

- Bilingual: every guest-facing string flows through `GuestTexts`/`TEXT_FIELDS`
  (or the general-invite texts); admin UI is English-only.
- Keep `setup.sql`, `mock-supabase.mjs`, `model.ts` (+ admin wiring) in lockstep
  when touching data.
- Money-shot files: `invite-view.tsx`, `admin/dashboard.tsx`,
  `public/story/index.html`.

## Table planner (`admin/seating-card.tsx`)

The TABLE PLANNER tab seats guests. Accepted + still-to-answer only — declines
are excluded outright. Head counts: accepted use `party_size`, everyone else
their `max_guests` (so tables aren't under-booked), overridable per invitation.

Seats are allocated **per invitation per table**
(`assignments[tableId][invitationId] = n`), so a family of four can sit
two-and-two across two tables. Select a guest → set how many → click a table.

The plan is one row in **`seating_plans`**, which is **admin-only — it has no
`anon` read policy**, unlike `settings`. `normalizePlan()` coerces the jsonb
columns into shape on load, so a malformed row can't take down the admin page.
`SeatTable` carries optional `x`/`y`, reserved for a future floor-plan view.

## Known trade-offs

- **`settings` is world-readable** (`for select to anon using (true)`) and every
  guest page fetches all of it. Never put anything private in a setting — that
  is exactly why the seating plan has its own table.
- **`settingsFromRows` silently drops unknown keys** (`if (row.key in out)`). A
  setting missing from `SiteSettings`/`DEFAULT_SETTINGS` reads back as absent
  with no error — the easiest footgun in the codebase.
- **Three-way manual lockstep** between `supabase/setup.sql`,
  `tools/mock-supabase.mjs` and `src/lib/model.ts`; drift fails silently.
- **`dashboard.tsx` is ~1550 lines** — filters, sorting, column visibility, bulk
  edit, CSV export, stats and every settings save handler in one component.
- **No committed tests** — Playwright suites live in the session scratchpad and
  are lost between sessions; nothing runs in CI.
- **Admin view state is in-memory**: column/filter/sort choices reset on reload.
- **Free-tier Supabase has no automatic backups.** See the Backup & restore
  section of [docs/SETUP.md](docs/SETUP.md) — and note admin logins live in
  `auth.users`, outside a `public`-schema dump.

Setup instructions live in **[docs/SETUP.md](docs/SETUP.md)**, not here.
