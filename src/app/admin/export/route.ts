import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { listInvitations } from "@/lib/invitations";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const invitations = await listInvitations();

  const header = ["Name", "Status", "Party size", "Max guests", "Note", "Responded at", "Link"];
  const rows = invitations.map((inv) => [
    csvCell(inv.name),
    csvCell(inv.status),
    csvCell(inv.status === "accepted" ? inv.partySize ?? 1 : inv.status === "declined" ? 0 : ""),
    csvCell(inv.maxGuests == null ? "unlimited" : inv.maxGuests),
    csvCell(inv.note),
    csvCell(inv.respondedAt),
    csvCell(`${origin}/i/${inv.token}`),
  ]);

  const csv = "﻿" + [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rsvp-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
