"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { parseVars, type SiteSettings } from "@/lib/model";

// The placeholders the app fills in by itself. Listed here so the panel can
// explain what each one becomes and where it is allowed.
const BUILT_INS: { token: string; where: string; becomes: string }[] = [
  { token: "{n}", where: "Saved / locked messages about an accepted answer", becomes: "the party size the guest chose, e.g. 3" },
  { token: "{max}", where: "Party size hint", becomes: "that invitation's guest limit, e.g. 4" },
  { token: "{date}", where: "Edit-until note", becomes: "the RSVP deadline, e.g. 14 Haziran 2027" },
];

type VarRow = { name: string; value: string };

function toRows(raw: string): VarRow[] {
  return Object.entries(parseVars(raw)).map(([name, value]) => ({ name, value }));
}

/**
 * Reference for the built-in {placeholders} plus a place to define custom
 * ones ({venueShort}, {dressCode}, …) usable in any invitation text.
 */
export function VarsCard({
  settings,
  onSave,
  pending,
}: {
  settings: SiteSettings;
  onSave: (varsTr: Record<string, string>, varsEn: Record<string, string>) => void;
  pending: boolean;
}) {
  const [tab, setTab] = useState<Lang>("tr");
  const [rows, setRows] = useState<Record<Lang, VarRow[]>>(() => ({
    tr: toRows(settings.varsTr),
    en: toRows(settings.varsEn),
  }));
  const seedKey = settings.varsTr + " " + settings.varsEn;
  const [seed, setSeed] = useState(seedKey);
  if (seed !== seedKey) {
    setSeed(seedKey);
    setRows({ tr: toRows(settings.varsTr), en: toRows(settings.varsEn) });
  }

  const current = rows[tab];
  const setCurrent = (next: VarRow[]) => setRows((prev) => ({ ...prev, [tab]: next }));

  const pack = (list: VarRow[]) => {
    const out: Record<string, string> = {};
    for (const r of list) {
      const name = r.name.trim().replace(/[^A-Za-z0-9_]/g, "");
      if (name) out[name] = r.value;
    }
    return out;
  };

  return (
    <div className="admin-card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h2 className="admin-h2" style={{ margin: 0 }}>
          Placeholders &amp; values
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

      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "10px 0", lineHeight: 1.6 }}>
        These are filled in automatically wherever you type them in <strong>Invitation texts</strong>:
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Placeholder</th>
              <th>Becomes</th>
              <th>Used in</th>
            </tr>
          </thead>
          <tbody>
            {BUILT_INS.map((b) => (
              <tr key={b.token}>
                <td>
                  <code style={{ fontWeight: 700, color: "var(--gold)" }}>{b.token}</code>
                </td>
                <td>{b.becomes}</td>
                <td style={{ fontSize: 13 }}>{b.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 600,
          fontSize: 16,
          color: "var(--brown)",
          margin: "20px 0 6px",
        }}
      >
        Your own placeholders
      </h3>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "0 0 12px", lineHeight: 1.6 }}>
        Define a name and a value, then use <code>{"{name}"}</code> in any invitation text. Handy for anything you repeat —
        a dress code, a hashtag, a nickname — so changing it once updates every text.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {current.length === 0 && (
          <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-soft)" }}>
            None yet — add one below.
          </div>
        )}
        {current.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "var(--gold)", fontWeight: 700 }}>{"{"}</span>
            <input
              className="text-input"
              style={{ flex: "1 1 130px" }}
              value={r.name}
              onChange={(e) => setCurrent(current.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              placeholder="dressCode"
            />
            <span style={{ color: "var(--gold)", fontWeight: 700 }}>{"}"}</span>
            <input
              className="text-input"
              style={{ flex: "2 1 220px" }}
              value={r.value}
              onChange={(e) => setCurrent(current.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              placeholder="şık günlük"
            />
            <button className="mini-btn danger" onClick={() => setCurrent(current.filter((_, j) => j !== i))} type="button">
              Remove
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button className="mini-btn" onClick={() => setCurrent([...current, { name: "", value: "" }])} type="button">
          + Add placeholder
        </button>
        <button
          className="submit-btn"
          onClick={() => onSave(pack(rows.tr), pack(rows.en))}
          disabled={pending}
          type="button"
        >
          Save placeholders
        </button>
      </div>
    </div>
  );
}
