"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  deadlinePassed,
  settingsFromRows,
  type Invitation,
  type SiteSettings,
} from "@/lib/model";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { InviteView } from "./invite-view";
import { NotFoundView } from "./not-found-view";

type Guest = Pick<Invitation, "name" | "max_guests" | "status" | "party_size" | "note" | "personal_note">;

type State =
  | { phase: "loading" }
  | { phase: "unconfigured" }
  | { phase: "notfound"; settings?: SiteSettings }
  | { phase: "ready"; guest: Guest; settings: SiteSettings };

export function InviteLoader() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseConfigured) {
        setState({ phase: "unconfigured" });
        return;
      }
      if (!token) {
        setState({ phase: "notfound" });
        return;
      }
      try {
        const supabase = getSupabase();
        const [invRes, setRes] = await Promise.all([
          supabase.rpc("get_invitation", { p_token: token }),
          supabase.from("settings").select("key, value"),
        ]);
        if (cancelled) return;
        const guest = (invRes.data as Guest[] | null)?.[0];
        const settings = settingsFromRows(setRes.data ?? []);
        if (invRes.error || !guest) {
          setState({ phase: "notfound", settings: setRes.data ? settings : undefined });
          return;
        }
        setState({ phase: "ready", guest, settings });
      } catch {
        if (!cancelled) setState({ phase: "notfound" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.phase === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="kicker" style={{ fontSize: 26, animation: "heartBeat 1.6s ease-in-out infinite" }}>
          Tansu &amp; Arda ♥
        </div>
      </div>
    );
  }

  if (state.phase === "unconfigured") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="admin-card" style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--brown)" }}>Not configured</h1>
          <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--brown-mid)", lineHeight: 1.7 }}>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> at build time — see
            the README.
          </p>
        </div>
      </div>
    );
  }

  if (state.phase === "notfound") return <NotFoundView settings={state.settings} />;

  return (
    <InviteView
      token={token}
      guestName={state.guest.name}
      maxGuests={state.guest.max_guests}
      status={state.guest.status}
      partySize={state.guest.party_size}
      note={state.guest.note}
      personalNote={state.guest.personal_note}
      locked={deadlinePassed(state.settings)}
      settings={state.settings}
    />
  );
}
