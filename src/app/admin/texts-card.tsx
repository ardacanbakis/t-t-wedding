"use client";

import { useState } from "react";
import { defaultTexts, TEXT_FIELDS, type GuestTexts, type Lang } from "@/lib/i18n";
import { parseLayout } from "@/lib/blocks";
import { mergeTexts, type SiteSettings } from "@/lib/model";

/**
 * Every guest-facing string, per language — each with its own show/hide
 * switch so single lines (the "Dear" word, a label, the closing motto) can
 * be dropped without touching the block around them.
 */
export function TextsCard({
  settings,
  onSave,
  pending,
}: {
  settings: SiteSettings;
  onSave: (textsTr: GuestTexts, textsEn: GuestTexts, hiddenTexts: string[]) => void;
  pending: boolean;
}) {
  const [tab, setTab] = useState<Lang>("tr");
  const [texts, setTexts] = useState<Record<Lang, GuestTexts>>(() => ({
    tr: mergeTexts("tr", settings),
    en: mergeTexts("en", settings),
  }));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(parseLayout(settings.layout).hiddenTexts));

  // Re-seed when the stored values change (a reload from the server), not on
  // every keystroke in an unrelated field.
  const seedKey = settings.textsTr + " " + settings.textsEn + " " + settings.layout;
  const [seed, setSeed] = useState(seedKey);
  if (seed !== seedKey) {
    setSeed(seedKey);
    setTexts({ tr: mergeTexts("tr", settings), en: mergeTexts("en", settings) });
    setHidden(new Set(parseLayout(settings.layout).hiddenTexts));
  }

  const current = texts[tab];
  const setField = (key: keyof GuestTexts, value: string) =>
    setTexts((prev) => ({ ...prev, [tab]: { ...prev[tab], [key]: value } }));

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="admin-card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h2 className="admin-h2" style={{ margin: 0 }}>
          Invitation texts
        </h2>
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
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "10px 0 6px", lineHeight: 1.6 }}>
        Every string guests see, per language. Switch one off with its eye button to drop just that line. Placeholders in
        curly braces (<code>{"{n}"}</code>, <code>{"{max}"}</code>, <code>{"{date}"}</code>) fill in automatically. Clearing
        a field restores the default. Visibility is shared by both languages.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0 22px" }}>
        {TEXT_FIELDS.map((f) => {
          const off = hidden.has(f.key);
          return (
            <div key={f.key} style={{ opacity: off ? 0.55 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
                <label className="field-label" style={{ flex: 1 }}>
                  {f.label}
                </label>
                <button
                  className="mini-btn"
                  style={{ marginBottom: 8, padding: "3px 9px" }}
                  onClick={() => toggle(f.key)}
                  type="button"
                  title={off ? "Show this text" : "Hide this text"}
                >
                  {off ? "🚫" : "👁"}
                </button>
              </div>
              {f.multiline ? (
                <textarea
                  className="textarea-input"
                  style={{ minHeight: 64 }}
                  value={current[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={defaultTexts[tab][f.key]}
                  disabled={off}
                />
              ) : (
                <input
                  className="text-input"
                  value={current[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={defaultTexts[tab][f.key]}
                  disabled={off}
                />
              )}
            </div>
          );
        })}
      </div>
      <button
        className="submit-btn"
        style={{ marginTop: 16 }}
        onClick={() => onSave(texts.tr, texts.en, [...hidden])}
        disabled={pending}
        type="button"
      >
        Save texts (both languages)
      </button>
    </div>
  );
}
