"use client";

import { useState } from "react";
import type { GuestTexts } from "@/lib/i18n";
import { getSupabase, withBase } from "@/lib/supabase";

/**
 * Leave-a-note form. From a personal link (token set) the note is tied to the
 * invitation and the name is pre-filled; on the public pages a name is needed.
 * submit_wish() in setup.sql enforces the rules — this only maps its errors.
 */
export function GuestbookForm({
  token = "",
  defaultName = "",
  t,
  onSent,
}: {
  token?: string;
  defaultName?: string;
  t: GuestTexts;
  onSent?: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = message.trim() !== "" && (token !== "" || name.trim() !== "") && !pending;

  const send = async () => {
    if (!canSend) return;
    setPending(true);
    setError(null);
    try {
      const { error: rpcError } = await getSupabase().rpc("submit_wish", {
        p_token: token,
        p_name: name,
        p_message: message,
      });
      if (rpcError) {
        const m = rpcError.message;
        setError(m.includes("closed") ? t.wishClosed : m.includes("limit") ? t.wishLimit : t.error);
        return;
      }
      setSent(true);
      onSent?.();
    } catch {
      setError(t.error);
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div
        style={{
          background: "rgba(108,122,69,.12)",
          border: "1px solid rgba(108,122,69,.3)",
          borderRadius: 12,
          padding: "14px 18px",
          fontFamily: "var(--sans)",
          fontSize: 15,
          color: "#55632f",
          textAlign: "center",
        }}
      >
        {t.wishThanks}
      </div>
    );
  }

  return (
    <div style={{ textAlign: "left" }}>
      <label className="field-label" htmlFor="wish-name" style={{ marginTop: 0 }}>
        {t.wishName}
      </label>
      <input
        id="wish-name"
        className="text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        autoComplete="name"
      />
      <label className="field-label" htmlFor="wish-message">
        {t.wishMessage}
      </label>
      <textarea
        id="wish-message"
        className="textarea-input"
        style={{ minHeight: 110 }}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t.wishPlaceholder}
        maxLength={1000}
      />
      {error && <div style={{ color: "#a83232", fontFamily: "var(--sans)", fontSize: 13, marginTop: 10 }}>{error}</div>}
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <button className="submit-btn" onClick={send} disabled={!canSend} type="button">
          {pending ? "…" : t.send}
        </button>
      </div>
    </div>
  );
}

/** "Read the guestbook" link to the public wall. */
export function WallLink({ t }: { t: GuestTexts }) {
  if (!t.wishWall) return null;
  return (
    <a
      href={withBase("/wishes/")}
      style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-link)", textDecoration: "underline", textUnderlineOffset: 3 }}
    >
      {t.wishWall} →
    </a>
  );
}
