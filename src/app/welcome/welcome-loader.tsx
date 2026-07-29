"use client";

import { useEffect, useState } from "react";
import { settingsFromRows, type SiteSettings } from "@/lib/model";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { InviteView } from "../i/invite-view";

type State =
  | { phase: "loading" }
  | { phase: "unconfigured" }
  | { phase: "ready"; settings: SiteSettings };

export function WelcomeLoader() {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseConfigured) {
        setState({ phase: "unconfigured" });
        return;
      }
      try {
        const { data } = await getSupabase().from("settings").select("key, value");
        if (cancelled) return;
        setState({ phase: "ready", settings: settingsFromRows(data ?? []) });
      } catch {
        // Fall back to built-in defaults so the page always renders.
        if (!cancelled) setState({ phase: "ready", settings: settingsFromRows([]) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <InviteView
      token=""
      guestName=""
      maxGuests={null}
      status="pending"
      partySize={null}
      note={null}
      personalNote={null}
      locked={false}
      settings={state.settings}
      mode="general"
    />
  );
}
