import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { invitations, type Invitation } from "./schema";

export function newToken(): string {
  // 12 chars of base64url ≈ 72 bits of entropy — unguessable.
  return randomBytes(9).toString("base64url");
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  if (!token) return null;
  const db = await getDb();
  const rows = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return rows[0] ?? null;
}

export async function listInvitations(): Promise<Invitation[]> {
  const db = await getDb();
  return db.select().from(invitations).orderBy(asc(invitations.name));
}

export async function createInvitation(name: string, maxGuests: number | null): Promise<Invitation> {
  const db = await getDb();
  const rows = await db
    .insert(invitations)
    .values({ token: newToken(), name, maxGuests })
    .returning();
  return rows[0];
}

export async function updateInvitation(
  id: number,
  patch: Partial<Pick<Invitation, "name" | "maxGuests" | "status" | "partySize" | "note">>
): Promise<void> {
  const db = await getDb();
  await db
    .update(invitations)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(invitations.id, id));
}

export async function deleteInvitation(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(invitations).where(eq(invitations.id, id));
}

export async function submitRsvp(
  token: string,
  answer: "accepted" | "declined",
  partySize: number,
  note: string
): Promise<Invitation | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  const rows = await db
    .update(invitations)
    .set({
      status: answer,
      partySize: answer === "accepted" ? partySize : 0,
      note: note || null,
      respondedAt: now,
      updatedAt: now,
    })
    .where(eq(invitations.token, token))
    .returning();
  return rows[0] ?? null;
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

export async function importInvitations(text: string): Promise<number> {
  const parsed = parseImportLines(text);
  const db = await getDb();
  for (const { name, maxGuests } of parsed) {
    await db.insert(invitations).values({ token: newToken(), name, maxGuests });
  }
  return parsed.length;
}
