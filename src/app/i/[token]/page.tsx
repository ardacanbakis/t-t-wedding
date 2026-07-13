import type { Metadata } from "next";
import { getInvitationByToken } from "@/lib/invitations";
import { deadlinePassed, getSettings, parseSchedule } from "@/lib/settings";
import { InviteView } from "./invite-view";
import { NotFoundView } from "./not-found-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tansu & Arda — Davetiye",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await getInvitationByToken(token);
  if (!inv) return <NotFoundView />;

  const s = await getSettings();

  return (
    <InviteView
      token={token}
      guestName={inv.name}
      maxGuests={inv.maxGuests}
      status={inv.status}
      partySize={inv.partySize}
      note={inv.note}
      locked={deadlinePassed(s)}
      eventDate={s.eventDate}
      rsvpDeadline={s.rsvpDeadline}
      venueName={s.venueName}
      venueAddress={s.venueAddress}
      mapsUrl={s.mapsUrl}
      schedule={parseSchedule(s.schedule)}
      storyUrl={s.storyUrl}
    />
  );
}
