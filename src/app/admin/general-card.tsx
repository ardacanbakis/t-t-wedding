"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { defaultGeneral, GENERAL_FIELDS, mergeGeneral, type GeneralTexts, type SiteSettings } from "@/lib/model";
import { BASE_PATH, getSupabase } from "@/lib/supabase";

/**
 * The GENERAL INVITATION tab: the one universal (no-RSVP) link, its open /
 * "I'll be there" counts, and the general-page texts. Layout & typography are
 * shared with the personal invite (edited under INVITATION STYLING).
 */
export function GeneralCard({
  settings,
  onSave,
  pending,
}: {
  settings: SiteSettings;
  onSave: (generalTr: GeneralTexts, generalEn: GeneralTexts) => void;
  pending: boolean;
}) {
  const [tab, setTab] = useState<Lang>("tr");
  const [texts, setTexts] = useState<Record<Lang, GeneralTexts>>(() => ({
    tr: mergeGeneral("tr", settings),
    en: mergeGeneral("en", settings),
  }));
  const seedKey = settings.generalTr + " " + settings.generalEn;
  const [seed, setSeed] = useState(seedKey);
  if (seed !== seedKey) {
    setSeed(seedKey);
    setTexts({ tr: mergeGeneral("tr", settings), en: mergeGeneral("en", settings) });
  }

  const [counts, setCounts] = useState<{ opens: number; yes: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    setLink(`${window.location.origin}${BASE_PATH}/welcome/`);
  }, []);

  const loadCounts = useCallback(async () => {
    const { data } = await getSupabase().from("general_stats").select("kind, count");
    if (!data) return;
    const map: Record<string, number> = {};
    for (const row of data as { kind: string; count: number }[]) map[row.kind] = row.count;
    setCounts({ opens: map.opens ?? 0, yes: map.yes ?? 0 });
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy the link:", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const current = texts[tab];
  const setField = (key: keyof GeneralTexts, value: string) =>
    setTexts((prev) => ({ ...prev, [tab]: { ...prev[tab], [key]: value } }));

  return (
    <div className="admin-card">
      <h2 className="admin-h2">General invitation</h2>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "0 0 14px", lineHeight: 1.6 }}>
        One universal link for anyone — same card as the personal invite (styled under <strong>INVITATION STYLING</strong>),
        but with no RSVP form. Instead it shows an <em>“I&apos;ll be there”</em> button and a note asking guests to reply to
        you.
      </p>

      {/* The link */}
      <label className="field-label" style={{ marginTop: 0 }}>
        Universal link
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="text-input" style={{ flex: "1 1 260px" }} value={link} readOnly onFocus={(e) => e.target.select()} />
        <button className="mini-btn" onClick={copy} type="button">
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        <a className="mini-btn" href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          Preview
        </a>
      </div>

      {/* Counts */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "18px 0" }}>
        <div className="stat-tile">
          <div className="num">{counts ? counts.opens : "—"}</div>
          <div className="lbl">Opened (per device)</div>
        </div>
        <div className="stat-tile">
          <div className="num">{counts ? counts.yes : "—"}</div>
          <div className="lbl">“I&apos;ll be there”</div>
        </div>
        <button className="mini-btn" style={{ alignSelf: "center" }} onClick={loadCounts} type="button">
          Refresh counts
        </button>
      </div>

      {/* Texts */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 16, color: "var(--brown)", margin: 0 }}>
          General page texts
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          {(["tr", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              className="mini-btn"
              style={tab === l ? { background: "var(--gold)", color: "#fffdf8", borderColor: "var(--gold)" } : undefined}
              onClick={() => setTab(l)}
              type="button"
            >
              {l === "tr" ? "Türkçe" : "English"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0 22px", marginTop: 8 }}>
        {GENERAL_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="field-label">{f.label}</label>
            {f.multiline ? (
              <textarea
                className="textarea-input"
                style={{ minHeight: 64 }}
                value={current[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={defaultGeneral[tab][f.key]}
              />
            ) : (
              <input
                className="text-input"
                value={current[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={defaultGeneral[tab][f.key]}
              />
            )}
          </div>
        ))}
      </div>
      <button
        className="submit-btn"
        style={{ marginTop: 16 }}
        onClick={() => onSave(texts.tr, texts.en)}
        disabled={pending}
        type="button"
      >
        Save general texts
      </button>
    </div>
  );
}
