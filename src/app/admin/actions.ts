"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, loginWithPassword, logout } from "@/lib/auth";
import {
  createInvitation,
  deleteInvitation,
  importInvitations,
  updateInvitation,
} from "@/lib/invitations";
import { saveSettings, type SiteSettings } from "@/lib/settings";

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const password = String(formData.get("password") ?? "");
  const ok = await loginWithPassword(password);
  if (!ok) return { error: "Wrong password." };
  revalidatePath("/admin");
  return null;
}

export async function logoutAction(): Promise<void> {
  await logout();
  revalidatePath("/admin");
}

export async function importAction(text: string): Promise<{ count: number }> {
  await requireAdmin();
  const count = await importInvitations(text);
  revalidatePath("/admin");
  return { count };
}

export async function addInvitationAction(name: string, maxGuestsRaw: string): Promise<void> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  const maxGuests = parseMax(maxGuestsRaw);
  await createInvitation(trimmed, maxGuests);
  revalidatePath("/admin");
}

export async function updateInvitationAction(
  id: number,
  name: string,
  maxGuestsRaw: string
): Promise<void> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  await updateInvitation(id, { name: trimmed, maxGuests: parseMax(maxGuestsRaw) });
  revalidatePath("/admin");
}

export async function deleteInvitationAction(id: number): Promise<void> {
  await requireAdmin();
  await deleteInvitation(id);
  revalidatePath("/admin");
}

export async function saveSettingsAction(patch: Partial<SiteSettings>): Promise<void> {
  await requireAdmin();
  await saveSettings(patch);
  revalidatePath("/admin");
  revalidatePath("/");
}

function parseMax(raw: string): number | null {
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "unlimited" || v === "sınırsız" || v === "sinirsiz" || v === "0") return v === "" ? 1 : null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
