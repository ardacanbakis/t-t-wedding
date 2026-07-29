// Client-side domain types + helpers (the source of truth for validation
// lives in supabase/setup.sql — everything here is UX-side convenience).

import { defaultTexts, type GuestTexts, type Lang } from "./i18n";

export type Invitation = {
  id: number;
  token: string;
  name: string;
  max_guests: number | null;
  status: "pending" | "accepted" | "declined";
  party_size: number | null;
  note: string | null;
  /** Optional per-guest message written by the couple, shown on the card */
  personal_note: string | null;
  responded_at: string | null;
};

export type SiteSettings = {
  eventDate: string;
  rsvpDeadline: string;
  venueName: string;
  venueAddress: string;
  mapsUrl: string;
  /** One item per line: "HH:MM | Turkish label | English label" */
  schedule: string;
  /** Where the story/timeline site lives (hosted at /story/ by default) */
  storyUrl: string;
  /** Heading on the invitation card; an "&" gets the script styling */
  coupleNames: string;
  /** JSON overrides of the guest-facing texts (see GuestTexts) */
  textsTr: string;
  textsEn: string;
  /** JSON block layout for the invitation card (see lib/blocks.ts) */
  layout: string;
  /** JSON {name: value} custom placeholders usable in any text */
  varsTr: string;
  varsEn: string;
  /** JSON overrides of the story site's non-chapter strings */
  storyTr: string;
  storyEn: string;
};

// ── Story / timeline ────────────────────────────────────────────────
export type PhotoLayout = "carousel" | "stack" | "grid";

export type StoryChapterText = {
  nav: string;
  kicker: string;
  date: string;
  title: string;
  cap: string;
  body: string;
  tl: string;
};

export type StoryChapter = {
  id: number;
  position: number;
  slug: string;
  /** Filenames under public/story/assets/, e.g. ["hecate.jpeg"] */
  photos: string[];
  photo_layout: PhotoLayout;
  /** Photo fit inside the frame */
  photo_fit: "cover" | "contain";
  tilt: number;
  visible: boolean;
  tr: StoryChapterText;
  en: StoryChapterText;
};

export const EMPTY_CHAPTER_TEXT: StoryChapterText = {
  nav: "",
  kicker: "",
  date: "",
  title: "",
  cap: "",
  body: "",
  tl: "",
};

export function normalizeChapter(row: Partial<StoryChapter>): StoryChapter {
  return {
    id: row.id ?? 0,
    position: row.position ?? 0,
    slug: row.slug ?? "",
    photos: Array.isArray(row.photos) ? row.photos.filter((p) => typeof p === "string" && p.trim()) : [],
    photo_layout: (["carousel", "stack", "grid"] as const).includes(row.photo_layout as PhotoLayout)
      ? (row.photo_layout as PhotoLayout)
      : "carousel",
    photo_fit: row.photo_fit === "contain" ? "contain" : "cover",
    tilt: Number.isFinite(row.tilt) ? Number(row.tilt) : 0,
    visible: row.visible !== false,
    tr: { ...EMPTY_CHAPTER_TEXT, ...(row.tr ?? {}) },
    en: { ...EMPTY_CHAPTER_TEXT, ...(row.en ?? {}) },
  };
}

// Defaults pulled from the timeline site (Chapter Ten): 28 June 2026, 14:30,
// Germencik Belediyesi · Aydın. setup.sql seeds the same values; the admin
// dashboard edits them.
export const DEFAULT_SETTINGS: SiteSettings = {
  eventDate: "2026-06-28T14:30:00+03:00",
  rsvpDeadline: "2026-06-14T23:59:00+03:00",
  venueName: "Germencik Belediyesi",
  venueAddress: "Germencik, Aydın",
  mapsUrl: "https://maps.google.com/?q=Germencik+Belediyesi,+Ayd%C4%B1n",
  schedule: "14:30 | Nikah Töreni | Ceremony",
  storyUrl: "/story/",
  coupleNames: "Tansu & Arda",
  textsTr: "",
  textsEn: "",
  layout: "",
  varsTr: "",
  varsEn: "",
  storyTr: "",
  storyEn: "",
};

/** Custom {placeholder} values defined in the dashboard, per language. */
export function parseVars(raw: string): Record<string, string> {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v)) {
        if (typeof val === "string") out[k] = val;
      }
      return out;
    }
  } catch {}
  return {};
}

/** Guest texts for a language: dashboard overrides merged over defaults. */
export function mergeTexts(lang: Lang, s: SiteSettings): GuestTexts {
  const raw = lang === "tr" ? s.textsTr : s.textsEn;
  let overrides: Partial<GuestTexts> = {};
  try {
    if (raw) overrides = JSON.parse(raw);
  } catch {}
  const merged: GuestTexts = { ...defaultTexts[lang] };
  for (const k of Object.keys(merged) as (keyof GuestTexts)[]) {
    const v = overrides[k];
    if (typeof v === "string" && v.trim() !== "") merged[k] = v;
  }
  return merged;
}

export function settingsFromRows(rows: { key: string; value: string }[]): SiteSettings {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in out) (out as Record<string, string>)[row.key] = row.value;
  }
  return out;
}

export function deadlinePassed(s: SiteSettings, now = new Date()): boolean {
  const d = new Date(s.rsvpDeadline);
  return !Number.isNaN(d.getTime()) && now > d;
}

export type ScheduleItem = { time: string; tr: string; en: string };

export function parseSchedule(raw: string): ScheduleItem[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [time = "", tr = "", en = ""] = line.split("|").map((p) => p.trim());
      return { time, tr, en: en || tr };
    })
    .filter((item) => item.time || item.tr);
}

/** Unguessable invitation token: 12 chars base64url ≈ 72 bits of entropy. */
export function newToken(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Parse a pasted guest list, one invitee per line:
 *   "Ayşe & Mehmet Yılmaz, 4"  → max 4 guests
 *   "John Smith, unlimited"    → unlimited
 *   "Jane Doe"                 → max 1 (default)
 * Only the LAST comma is considered, so names may contain commas.
 */
export function parseImportLines(text: string): { name: string; maxGuests: number | null }[] {
  const out: { name: string; maxGuests: number | null }[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const idx = line.lastIndexOf(",");
    if (idx > 0) {
      const tail = line.slice(idx + 1).trim().toLowerCase();
      const head = line.slice(0, idx).trim();
      if (tail === "unlimited" || tail === "sınırsız" || tail === "sinirsiz") {
        out.push({ name: head, maxGuests: null });
        continue;
      }
      const n = Number.parseInt(tail, 10);
      if (Number.isFinite(n) && n > 0 && String(n) === tail) {
        out.push({ name: head, maxGuests: n });
        continue;
      }
    }
    out.push({ name: line, maxGuests: 1 });
  }
  return out;
}

export function parseMaxGuests(raw: string): number | null {
  const v = raw.trim().toLowerCase();
  if (v === "") return 1;
  if (v === "unlimited" || v === "sınırsız" || v === "sinirsiz" || v === "0" || v === "∞") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
