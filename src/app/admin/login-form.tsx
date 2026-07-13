"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({ email, password });
      if (authError) setError("Wrong email or password.");
      // On success the auth listener in AdminPage swaps in the dashboard.
    } catch {
      setError("Could not reach Supabase — check your connection.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fade-in"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <form onSubmit={submit} className="admin-card" style={{ width: 360, textAlign: "center" }}>
        <div className="kicker" style={{ fontSize: 24 }}>
          Tansu &amp; Arda
        </div>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 24, color: "var(--brown)", margin: "6px 0 18px" }}>
          Admin
        </h1>
        <input
          className="text-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoFocus
          required
          style={{ textAlign: "center", marginBottom: 10 }}
        />
        <input
          className="text-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          style={{ textAlign: "center" }}
        />
        {error && <div style={{ color: "#a83232", fontFamily: "var(--sans)", fontSize: 13, marginTop: 10 }}>{error}</div>}
        <button className="submit-btn" type="submit" disabled={pending} style={{ marginTop: 16, width: "100%" }}>
          {pending ? "…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
