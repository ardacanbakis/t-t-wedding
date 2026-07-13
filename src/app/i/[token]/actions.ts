"use server";

import { revalidatePath } from "next/cache";
import { getInvitationByToken, submitRsvp } from "@/lib/invitations";
import { deadlinePassed, getSettings } from "@/lib/settings";

export type RsvpResult =
  | { ok: true; status: "accepted" | "declined"; partySize: number }
  | { ok: false; error: "locked" | "invalid" };

export async function sendRsvp(
  token: string,
  answer: "accepted" | "declined",
  partySizeRaw: number,
  note: string
): Promise<RsvpResult> {
  const inv = await getInvitationByToken(token);
  if (!inv) return { ok: false, error: "invalid" };

  const s = await getSettings();
  if (deadlinePassed(s)) return { ok: false, error: "locked" };

  let partySize = Math.floor(Number(partySizeRaw));
  if (!Number.isFinite(partySize) || partySize < 1) partySize = 1;
  if (inv.maxGuests != null && partySize > inv.maxGuests) partySize = inv.maxGuests;
  // Sanity cap for "unlimited" invitations
  if (partySize > 99) partySize = 99;

  const trimmedNote = note.slice(0, 2000).trim();
  const updated = await submitRsvp(token, answer, partySize, trimmedNote);
  if (!updated) return { ok: false, error: "invalid" };

  revalidatePath(`/i/${token}`);
  return { ok: true, status: answer, partySize };
}
