"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { Dashboard } from "./dashboard";
import { LoginForm } from "./login-form";

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setChecked(true);
      return;
    }
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!checked) return null;

  if (!supabaseConfigured) {
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

  if (!session) return <LoginForm />;

  return <Dashboard />;
}
