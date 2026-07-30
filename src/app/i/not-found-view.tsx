"use client";

import { useEffect, useState } from "react";
import { defaultTexts, type Lang } from "@/lib/i18n";
import { DEFAULT_SETTINGS, mergeTexts, type SiteSettings } from "@/lib/model";
import { withBase } from "@/lib/supabase";

export function NotFoundView({ settings }: { settings?: SiteSettings }) {
  const [lang, setLang] = useState<Lang>("tr");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ta-love-lang");
      if (stored === "tr" || stored === "en") setLang(stored);
    } catch {}
  }, []);

  const t = settings ? mergeTexts(lang, settings) : defaultTexts[lang];
  const storyUrl = settings?.storyUrl ?? DEFAULT_SETTINGS.storyUrl;
  const phone = (settings?.contactWhatsapp ?? DEFAULT_SETTINGS.contactWhatsapp).replace(/[^\d]/g, "");
  const waText =
    lang === "tr"
      ? "Merhaba! Davetiye bağlantımda bir sorun var, yardımcı olabilir misiniz?"
      : "Hi! There seems to be a problem with my invitation link — could you help?";
  const waHref = `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`;
  const waLabel = lang === "tr" ? "WhatsApp’tan bize yazın" : "Message us on WhatsApp";

  return (
    <div
      className="fade-in"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div className="kicker" style={{ fontSize: 26 }}>
          {settings?.coupleNames ?? "Tansu & Arda"}
        </div>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 32, color: "var(--brown)", margin: "10px 0" }}>
          {t.notFoundTitle}
        </h1>
        <p style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 15, lineHeight: 1.8, color: "var(--brown-mid)" }}>
          {t.notFoundBody}
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 26 }}>
          {phone && (
            <a
              className="pill-btn"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <span aria-hidden style={{ fontSize: 15 }}>💬</span> {waLabel}
            </a>
          )}
          <a className="pill-btn story-cta pulse-inline" href={withBase(storyUrl)}>
            {t.storyButton} ♥
          </a>
        </div>
      </div>
    </div>
  );
}
