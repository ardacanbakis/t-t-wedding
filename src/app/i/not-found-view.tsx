"use client";

import { useEffect, useState } from "react";
import { defaultTexts, type Lang } from "@/lib/i18n";
import { mergeTexts, type SiteSettings } from "@/lib/model";

export function NotFoundView({ settings }: { settings?: SiteSettings }) {
  const [lang, setLang] = useState<Lang>("tr");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ta-love-lang");
      if (stored === "tr" || stored === "en") setLang(stored);
    } catch {}
  }, []);

  const t = settings ? mergeTexts(lang, settings) : defaultTexts[lang];

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
      </div>
    </div>
  );
}
