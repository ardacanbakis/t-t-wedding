"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { afterWedding, mergeTexts, settingsFromRows, type SiteSettings } from "@/lib/model";
import { getSupabase, supabaseConfigured, withBase } from "@/lib/supabase";
import { CoupleNames, Divider } from "../i/invite-view";
import { GuestbookForm } from "./guestbook-form";

type Note = { name: string; message: string; created_at: string };

// A little scatter, like notes pinned to a board — stable per position.
const TILTS = [-1.4, 0.9, -0.6, 1.3, -1, 0.5];

/**
 * The guestbook wall: the notes the couple approved, and a form for anyone
 * with the link. New notes wait for approval, so they don't appear at once.
 */
export function WishesView() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [lang, setLang] = useState<Lang>("tr");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseConfigured) {
        setSettings(settingsFromRows([]));
        return;
      }
      const supabase = getSupabase();
      const [setRes, wishRes] = await Promise.all([supabase.from("settings").select("key, value"), supabase.rpc("get_wishes")]);
      if (cancelled) return;
      const s = settingsFromRows(setRes.data ?? []);
      setSettings(s);
      setNotes((wishRes.data as Note[] | null) ?? []);
      // Same language rule as the invitations: a stored choice, else the
      // site default ("auto" follows the browser).
      let initial: Lang = s.defaultLang === "en" ? "en" : "tr";
      try {
        const stored = localStorage.getItem("ta-love-lang");
        if (stored === "tr" || stored === "en") initial = stored;
        else if (s.defaultLang === "auto" && (navigator.language || "").toLowerCase().startsWith("en")) initial = "en";
      } catch {}
      setLang(initial);
    })().catch(() => {
      if (!cancelled) setSettings(settingsFromRows([]));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const t = useMemo(() => (settings ? mergeTexts(lang, settings) : null), [lang, settings]);

  const pickLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("ta-love-lang", l);
    } catch {}
  };

  if (!settings || !t) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="kicker" style={{ fontSize: 26, animation: "heartBeat 1.6s ease-in-out infinite" }}>
          Tansu &amp; Arda ♥
        </div>
      </div>
    );
  }

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

  return (
    <div className="fade-in" style={{ minHeight: "100vh", padding: "60px 16px 70px" }}>
      {settings.showInviteLang !== "false" && (
        <div style={{ position: "fixed", top: 16, left: 16, zIndex: 90, display: "flex", gap: 6 }}>
          <button className={`pill-btn${lang === "tr" ? " active" : ""}`} onClick={() => pickLang("tr")} type="button">
            TR
          </button>
          <button className={`pill-btn${lang === "en" ? " active" : ""}`} onClick={() => pickLang("en")} type="button">
            EN
          </button>
        </div>
      )}

      <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        {t.wishTitle && (
          <div className="kicker" style={{ fontSize: "clamp(22px, 3.4vw, 30px)" }}>
            {t.wishTitle}
          </div>
        )}
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: "clamp(36px, 7vw, 58px)", color: "var(--brown)", margin: "6px 0 0", lineHeight: 1.08 }}>
          <CoupleNames value={settings.coupleNames} />
        </h1>
        <Divider />

        {notes.length === 0 ? (
          <p style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 15, color: "var(--brown-mid)", margin: "18px 0 30px" }}>
            {t.wallEmpty}
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: 18,
              margin: "22px 0 34px",
              textAlign: "left",
            }}
          >
            {notes.map((n, i) => (
              <figure
                key={i}
                style={{
                  flex: "0 1 260px",
                  margin: 0,
                  background: "var(--paper)",
                  borderRadius: 8,
                  padding: "18px 18px 14px",
                  boxShadow: "0 6px 18px -10px rgba(120,72,40,.35), 0 18px 40px -26px rgba(120,72,40,.4)",
                  transform: `rotate(${TILTS[i % TILTS.length]}deg)`,
                }}
              >
                <blockquote
                  style={{
                    margin: 0,
                    fontFamily: "var(--sans)",
                    fontWeight: 300,
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: "var(--brown-mid)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {n.message}
                </blockquote>
                <figcaption style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: "var(--script)", fontSize: 22, color: "var(--gold)" }}>{n.name}</span>
                  <span style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--brown-soft)" }}>{fmtDate(n.created_at)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {settings.wishesOpen !== "false" && (
          <div
            style={{
              maxWidth: 480,
              margin: "0 auto",
              background: "var(--paper)",
              borderRadius: 12,
              padding: "26px 22px 24px",
              boxShadow: "0 8px 22px -12px rgba(120,72,40,.3)",
            }}
          >
            {t.wishButton && (
              <h2 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 22, color: "var(--brown)", margin: "0 0 14px" }}>
                {t.wishButton}
              </h2>
            )}
            <GuestbookForm t={t} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 30 }}>
          {afterWedding(settings) && settings.photosUrl && t.photosButton && (
            <a className="pill-btn" href={settings.photosUrl} target="_blank" rel="noopener noreferrer">
              📷 {t.photosButton}
            </a>
          )}
          {t.storyButton && (
            <a className="pill-btn" href={withBase(settings.storyUrl)}>
              {t.storyButton} ♥
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
