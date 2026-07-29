"use client";

import { useState } from "react";
import { BLOCK_LABELS, DEFAULT_LAYOUT, parseLayout, type BlockId, type BlockStyle, type Layout } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/model";

/**
 * Per-element editor for the invitation card: show/hide, reorder, spacing,
 * alignment, size and colour for every block on the page.
 */
export function LayoutCard({
  settings,
  onSave,
  pending,
}: {
  settings: SiteSettings;
  onSave: (layout: Layout) => void;
  pending: boolean;
}) {
  const [layout, setLayout] = useState<Layout>(() => parseLayout(settings.layout));
  const [openId, setOpenId] = useState<BlockId | null>(null);
  const [seed, setSeed] = useState(settings.layout);
  if (seed !== settings.layout) {
    setSeed(settings.layout);
    setLayout(parseLayout(settings.layout));
  }

  const move = (index: number, delta: number) => {
    const next = [...layout.order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLayout({ ...layout, order: next });
  };

  const patch = (id: BlockId, p: Partial<BlockStyle>) =>
    setLayout({ ...layout, blocks: { ...layout.blocks, [id]: { ...layout.blocks[id], ...p } } });

  return (
    <div className="admin-card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h2 className="admin-h2" style={{ margin: 0 }}>
          Invitation layout
        </h2>
        <button className="mini-btn" onClick={() => setLayout(structuredClone(DEFAULT_LAYOUT))} type="button">
          Reset to default
        </button>
      </div>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "10px 0 14px", lineHeight: 1.6 }}>
        Drag order with ↑ ↓, switch elements off with the eye, and open one to adjust spacing, alignment, size and colour.
        The wording of each element lives in <strong>Invitation texts</strong> below.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {layout.order.map((id, i) => {
          const b = layout.blocks[id];
          const open = openId === id;
          return (
            <div
              key={id}
              style={{
                border: "1px solid var(--gold-soft)",
                borderRadius: 10,
                background: b.visible ? "rgba(255,253,248,.7)" : "rgba(0,0,0,.03)",
                opacity: b.visible ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button
                    className="mini-btn"
                    style={{ padding: "1px 7px", lineHeight: 1.3 }}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    type="button"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="mini-btn"
                    style={{ padding: "1px 7px", lineHeight: 1.3 }}
                    onClick={() => move(i, 1)}
                    disabled={i === layout.order.length - 1}
                    type="button"
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
                <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 600, fontSize: 14, color: "var(--brown)" }}>
                  {BLOCK_LABELS[id]}
                </span>
                <button
                  className="mini-btn"
                  onClick={() => patch(id, { visible: !b.visible })}
                  type="button"
                  title={b.visible ? "Hide this element" : "Show this element"}
                >
                  {b.visible ? "👁 Shown" : "🚫 Hidden"}
                </button>
                <button className="mini-btn" onClick={() => setOpenId(open ? null : id)} type="button">
                  {open ? "Close" : "Style"}
                </button>
              </div>

              {open && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "0 14px",
                    padding: "0 12px 12px",
                    borderTop: "1px solid rgba(191,155,95,.2)",
                  }}
                >
                  <div>
                    <label className="field-label">Space above (px)</label>
                    <input
                      className="text-input"
                      type="number"
                      value={b.spaceAbove}
                      onChange={(e) => patch(id, { spaceAbove: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="field-label">Space below (px)</label>
                    <input
                      className="text-input"
                      type="number"
                      value={b.spaceBelow}
                      onChange={(e) => patch(id, { spaceBelow: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="field-label">Alignment</label>
                    <select
                      className="select-input"
                      value={b.align}
                      onChange={(e) => patch(id, { align: e.target.value as BlockStyle["align"] })}
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Font size (px, 0 = default)</label>
                    <input
                      className="text-input"
                      type="number"
                      value={b.fontSize}
                      onChange={(e) => patch(id, { fontSize: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="field-label">Colour (blank = default)</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        className="text-input"
                        value={b.color}
                        onChange={(e) => patch(id, { color: e.target.value })}
                        placeholder="#4a3226"
                      />
                      <input
                        type="color"
                        value={/^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#4a3226"}
                        onChange={(e) => patch(id, { color: e.target.value })}
                        style={{ width: 42, border: "1px solid var(--gold-soft)", borderRadius: 10, background: "none" }}
                        title="Pick a colour"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="submit-btn" style={{ marginTop: 16 }} onClick={() => onSave(layout)} disabled={pending} type="button">
        Save layout
      </button>
    </div>
  );
}
