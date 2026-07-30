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

### Custom domain (e.g. `ardacanbakis.com`)

1. Add a `public/CNAME` file containing just the domain, and point the domain's
   DNS at GitHub Pages (Settings → Pages → Custom domain).
2. Set repo Actions **Variables**: `NEXT_PUBLIC_SITE_URL=https://ardacanbakis.com`
   and `NEXT_PUBLIC_BASE_PATH=` (empty — a custom domain serves from the root).
3. Redeploy. Links and share-preview images then use the custom domain.

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
