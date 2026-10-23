"use client";

import { useEffect, useState } from "react";
import { afterWedding, mergeTexts, settingsFromRows, type SiteSettings } from "@/lib/model";
import { getSupabase, supabaseConfigured, withBase } from "@/lib/supabase";

/**
 * The landing page. Static and bilingual side by side; once the wedding is
 * over (see afterWedding) it also offers the photos and the guestbook.
 */
export function HomeView() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    getSupabase()
      .from("settings")
      .select("key, value")
      .then(({ data }) => data && setSettings(settingsFromRows(data)), () => {});
  }, []);

  const after = settings ? afterWedding(settings) : false;
  const tr = settings ? mergeTexts("tr", settings) : null;
  const en = settings ? mergeTexts("en", settings) : null;
  const both = (a?: string, b?: string) => [a, b].filter(Boolean).join(" · ");

  return (
    <div
      className="fade-in"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ textAlign: "center", maxWidth: 560 }}>
        <div className="kicker" style={{ fontSize: "clamp(20px, 3vw, 28px)" }}>
          {after && tr ? both(tr.afterKicker, en?.afterKicker) : "bir aşk hikâyesi"}
        </div>
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontWeight: 600,
            fontSize: "clamp(44px, 9vw, 80px)",
            color: "var(--brown)",
            margin: "10px 0 4px",
            lineHeight: 1.08,
          }}
        >
          Tansu <span style={{ fontFamily: "var(--script)", color: "var(--gold)", fontWeight: 500 }}>&amp;</span> Arda
        </h1>
        <div className="divider">
          <div className="line-l" />
          <span className="heart">♥</span>
          <div className="line-r" />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          <a className="pill-btn" href={withBase("/story/")}>
            Hikâyemiz · Our Story
          </a>
          {after && settings?.photosUrl && (
            <a className="pill-btn" href={settings.photosUrl} target="_blank" rel="noopener noreferrer">
              📷 {both(tr?.photosButton, en?.photosButton)}
            </a>
          )}
          {after && tr && (
            <a className="pill-btn" href={withBase("/wishes/")}>
              ✍️ {both(tr.wishTitle, en?.wishTitle)}
            </a>
          )}
        </div>
        {!after && (
          <p style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 12, color: "var(--brown-soft)", marginTop: 28 }}>
            Davetiyeniz size özel bir bağlantıyla gönderildi. · Your invitation was sent to you as a personal link.
          </p>
        )}
      </div>
    </div>
  );
}
