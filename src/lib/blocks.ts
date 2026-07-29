import type { CSSProperties } from "react";

// Layout model for the invitation card. Every visible element is a "block"
// the admin can hide, reorder, space out, align, resize and recolour.

export type BlockId =
  | "kicker"
  | "names"
  | "dividerTop"
  | "greeting"
  | "inviteLine"
  | "personalNote"
  | "countdown"
  | "date"
  | "venue"
  | "mapButton"
  | "schedule"
  | "dividerBottom"
  | "rsvp"
  | "closing";

export type BlockStyle = {
  visible: boolean;
  /** Extra space in px above / below the block (on top of its own margins) */
  spaceAbove: number;
  spaceBelow: number;
  align: "left" | "center" | "right";
  /** 0 = keep the designed (responsive) size */
  fontSize: number;
  /** "" = keep the designed colour */
  color: string;
  /** "" = keep the designed font. Otherwise a CSS font-family value. */
  fontFamily: string;
};

export type Layout = {
  order: BlockId[];
  blocks: Record<BlockId, BlockStyle>;
  /**
   * Keys of GuestTexts the couple switched off. A hidden text renders as an
   * empty string, which also drops the element that only carried it — finer
   * grained than hiding a whole block (e.g. drop the "Dear" word but keep
   * the guest's name).
   */
  hiddenTexts: string[];
};

export const BLOCK_LABELS: Record<BlockId, string> = {
  kicker: "Kicker line",
  names: "Couple names",
  dividerTop: "Divider (under the names)",
  greeting: "Greeting (“Dear” + guest name)",
  inviteLine: "Intro paragraph",
  personalNote: "Personal message (per guest)",
  countdown: "Countdown",
  date: "Date",
  venue: "Venue name + address",
  mapButton: "Maps button",
  schedule: "Schedule",
  dividerBottom: "Divider (above the RSVP)",
  rsvp: "RSVP form",
  closing: "Closing motto",
};

export const DEFAULT_ORDER: BlockId[] = [
  "kicker",
  "names",
  "dividerTop",
  "greeting",
  "inviteLine",
  "personalNote",
  "countdown",
  "date",
  "venue",
  "mapButton",
  "schedule",
  "dividerBottom",
  "rsvp",
  "closing",
];

function block(overrides: Partial<BlockStyle> = {}): BlockStyle {
  return {
    visible: true,
    spaceAbove: 0,
    spaceBelow: 0,
    align: "center",
    fontSize: 0,
    color: "",
    fontFamily: "",
    ...overrides,
  };
}

/** Font-family choices offered per block in the dashboard. */
export const FONT_CHOICES: { label: string; value: string }[] = [
  { label: "Default (as designed)", value: "" },
  { label: "Serif — Playfair Display", value: "var(--serif)" },
  { label: "Script — Dancing Script", value: "var(--script)" },
  { label: "Sans — Mulish", value: "var(--sans)" },
];

export const DEFAULT_LAYOUT: Layout = {
  order: DEFAULT_ORDER,
  hiddenTexts: [],
  blocks: {
    kicker: block(),
    names: block(),
    dividerTop: block(),
    greeting: block(),
    inviteLine: block({ spaceAbove: 6 }),
    personalNote: block({ spaceAbove: 10 }),
    countdown: block(),
    date: block({ spaceAbove: 20 }),
    venue: block({ spaceAbove: 14 }),
    mapButton: block({ spaceAbove: 10 }),
    schedule: block({ spaceAbove: 22 }),
    dividerBottom: block(),
    rsvp: block({ align: "left" }),
    closing: block({ spaceAbove: 30 }),
  },
};

/** Parse the stored JSON, filling in anything missing or newly added. */
export function parseLayout(raw: string): Layout {
  let stored: Partial<Layout> = {};
  try {
    if (raw) stored = JSON.parse(raw);
  } catch {}

  const blocks = {} as Record<BlockId, BlockStyle>;
  for (const id of DEFAULT_ORDER) {
    blocks[id] = { ...DEFAULT_LAYOUT.blocks[id], ...(stored.blocks?.[id] ?? {}) };
  }

  // Keep the stored ordering, drop unknown ids, then slot any blocks added
  // since right after their natural predecessor (so a new block doesn't land
  // at the very bottom of an already-customised layout).
  const seen = new Set<BlockId>();
  const order: BlockId[] = [];
  for (const id of stored.order ?? []) {
    if (DEFAULT_ORDER.includes(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (let i = 0; i < DEFAULT_ORDER.length; i++) {
    const id = DEFAULT_ORDER[i];
    if (seen.has(id)) continue;
    let insertAt = order.length;
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(DEFAULT_ORDER[j]);
      if (k >= 0) {
        insertAt = k + 1;
        break;
      }
    }
    order.splice(insertAt, 0, id);
    seen.add(id);
  }

  const hiddenTexts = Array.isArray(stored.hiddenTexts)
    ? stored.hiddenTexts.filter((k): k is string => typeof k === "string")
    : [];

  return { order, blocks, hiddenTexts };
}

/** Wrapper style for one block. Font-size / colour / family overrides are
 *  exposed as CSS variables (not a plain wrapper font-size) so each block's
 *  text can opt in with `var(--blk-fs, <its own default>)` — a bare wrapper
 *  font-size can't win against the explicit sizes the blocks set themselves. */
export function blockStyle(s: BlockStyle): CSSProperties {
  const out: CSSProperties = {};
  if (s.spaceAbove) out.marginTop = s.spaceAbove;
  if (s.spaceBelow) out.marginBottom = s.spaceBelow;
  out.textAlign = s.align;
  const vars = out as Record<string, string | number>;
  if (s.fontSize) vars["--blk-fs"] = s.fontSize + "px";
  if (s.color) vars["--blk-color"] = s.color;
  if (s.fontFamily) vars["--blk-ff"] = s.fontFamily;
  return out;
}
