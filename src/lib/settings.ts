import { getDb } from "./db";
import { settings } from "./schema";

export type SiteSettings = {
  /** ISO datetime of the wedding */
  eventDate: string;
  /** ISO datetime after which RSVPs are locked */
  rsvpDeadline: string;
  venueName: string;
  venueAddress: string;
  mapsUrl: string;
  /** One item per line: "HH:MM | Turkish label | English label" */
  schedule: string;
  /** Where the story/timeline site lives (hosted at /story by default) */
  storyUrl: string;
};

// Defaults pulled from the timeline site (Chapter Ten): 28 June 2026, 14:30,
// Germencik Belediyesi · Aydın. All editable from the admin dashboard.
export const DEFAULT_SETTINGS: SiteSettings = {
  eventDate: "2026-06-28T14:30:00+03:00",
  rsvpDeadline: "2026-06-14T23:59:00+03:00",
  venueName: "Germencik Belediyesi",
  venueAddress: "Germencik, Aydın",
  mapsUrl: "https://maps.google.com/?q=Germencik+Belediyesi,+Ayd%C4%B1n",
  schedule: "14:30 | Nikah Töreni | Ceremony",
  storyUrl: "/story",
};

export async function getSettings(): Promise<SiteSettings> {
  const db = await getDb();
  const rows = await db.select().from(settings);
  const out = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in out) (out as Record<string, string>)[row.key] = row.value;
  }
  return out;
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<void> {
  const db = await getDb();
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
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
