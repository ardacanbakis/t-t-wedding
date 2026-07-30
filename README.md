# Tansu & Arda — Wedding RSVP

A bilingual (Turkish / English) wedding site: per-guest invitation links with
an RSVP form, a general "come one, come all" invite, a login-protected admin
dashboard, and the couple's animated **story / timeline** site — all in one
place.

**Static site (GitHub Pages) + Supabase.** The whole thing is a Next.js static
export, so there's nothing to keep running. Data lives in a free Supabase
project, read straight from the browser and protected by row-level security
and a handful of locked-down SQL functions.

> **Setting it up?** See **[docs/SETUP.md](docs/SETUP.md)**.
> **Working on the code (incl. AI sessions)?** See **[CLAUDE.md](CLAUDE.md)**.

## What's inside

| Route | What it is |
| --- | --- |
| `/i/?t=<token>` | A guest's personal invitation + RSVP (TR/EN) |
| `/welcome/` | The general, no-RSVP invitation — one link for anyone |
| `/story/` | The animated love-story + timeline site |
| `/admin/` | The couple's dashboard |
| `/` | Small landing page |

## For guests

- A personal, unguessable link per invitation (one link can cover a household).
- Accept / decline with party size (capped at the per-invitation max, or
  free-form for "unlimited" guests) and an optional note.
- Picking an answer gently pulses the choices, fades the rest of the card to
  spotlight **Send**, and asks a short, polite confirmation before submitting —
  then a warm thank-you popup invites them into the story.
- Editable **until the RSVP deadline** — enforced in the database, not just the
  UI; afterwards the card shows their answer but locks editing.
- Countdown, date, venue with a Maps link, optional schedule, and a Turkish /
  English toggle shared with the story site.
- A friendly WhatsApp contact + a link into the story if a link is ever wrong.

## The story / timeline site

- Scroll through the couple's story chapters (day → dusk → starry night) or flip
  to a **timeline** view of the same chapters.
- Per-chapter photo layouts (framed carousel, bare/native, fanned stack, grid,
  single) with optional auto-rotating photos.
- **Auto-cycle** mode walks through the chapters on its own — configurable
  seconds-per-photo, pauses on any touch, loops back to the start.
- A 🐾 button releases a romp of cats; smaller phone-optimized images load
  automatically when provided.

## For the couple (`/admin`)

- **Invitations:** bulk-import or add guests, optional per-guest personal
  message, **group tags** (e.g. "Tansu's Invites") with filtering, a **Sent**
  checkbox and **Opened** indicator to track who's been messaged and who's
  clicked, per-row **Copy link / Copy message / Copy reminder** buttons, filters,
  headcount, and CSV export. You can also set or correct any guest's RSVP by
  hand (for stats).
- **WhatsApp templates:** editable invite and reminder messages with
  `{name}` / `{link}` placeholders, previewed live.
- **Invitation styling:** reorder / show / space / align / resize / recolour
  every block of the card, edit **every** guest-facing string per language
  (TR/EN), custom placeholders, and toggle the RSVP pulse / fade / confirm-popup
  behaviours.
- **Story & Timeline:** edit chapters, photos and layouts, the day→night point,
  language picker, auto-cycle, and mobile-image handling.
- **General invitation:** one universal link with open / "I'll be there"
  tracking, plus its own editable texts.
- **Social preview:** the title/description baked into link previews.

## Tech at a glance

Next.js (App Router, static export) · Supabase (Postgres + RLS + RPCs) ·
a small self-contained template runtime for the story site · GitHub Actions →
GitHub Pages. No external runtime services, no CDNs.
