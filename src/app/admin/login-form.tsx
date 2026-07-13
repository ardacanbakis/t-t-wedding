"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <div
      className="fade-in"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <form action={action} className="admin-card" style={{ width: 360, textAlign: "center" }}>
        <div className="kicker" style={{ fontSize: 24 }}>
          Tansu &amp; Arda
        </div>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 24, color: "var(--brown)", margin: "6px 0 18px" }}>
          Admin
        </h1>
        <input
          className="text-input"
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          required
          style={{ textAlign: "center" }}
        />
        {state?.error && (
          <div style={{ color: "#a83232", fontFamily: "var(--sans)", fontSize: 13, marginTop: 10 }}>{state.error}</div>
        )}
        <button className="submit-btn" type="submit" disabled={pending} style={{ marginTop: 16, width: "100%" }}>
          {pending ? "…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
