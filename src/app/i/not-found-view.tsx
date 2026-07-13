"use client";

import { useEffect, useState } from "react";
import { dict, type Lang } from "@/lib/i18n";

export function NotFoundView() {
  const [lang, setLang] = useState<Lang>("tr");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ta-love-lang");
      if (stored === "tr" || stored === "en") setLang(stored);
    } catch {}
  }, []);

  const t = dict[lang];

  return (
    <div
      className="fade-in"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div className="kicker" style={{ fontSize: 26 }}>
          Tansu &amp; Arda
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
