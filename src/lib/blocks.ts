import type { CSSProperties } from "react";

// Layout model for the invitation card. Every visible element is a "block"
// the admin can hide, reorder, space out, align, resize and recolour.

export type BlockId =
  | "kicker"
  | "names"
  | "dividerTop"
  | "greeting"
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
};

export type Layout = {
  order: BlockId[];
  blocks: Record<BlockId, BlockStyle>;
};

export const BLOCK_LABELS: Record<BlockId, string> = {
  kicker: "Kicker line",
  names: "Couple names",
  dividerTop: "Divider (under the names)",
  greeting: "Greeting + intro paragraph",
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
    ...overrides,
  };
}

export const DEFAULT_LAYOUT: Layout = {
  order: DEFAULT_ORDER,
  blocks: {
    kicker: block(),
    names: block(),
    dividerTop: block(),
    greeting: block(),
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

  // Keep stored ordering, drop unknown ids, append blocks added since.
  const seen = new Set<BlockId>();
  const order: BlockId[] = [];
  for (const id of stored.order ?? []) {
    if (DEFAULT_ORDER.includes(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of DEFAULT_ORDER) if (!seen.has(id)) order.push(id);

  return { order, blocks };
}

/** Wrapper style for one block. */
export function blockStyle(s: BlockStyle): CSSProperties {
  const out: CSSProperties = {};
  if (s.spaceAbove) out.marginTop = s.spaceAbove;
  if (s.spaceBelow) out.marginBottom = s.spaceBelow;
  out.textAlign = s.align;
  if (s.fontSize) out.fontSize = s.fontSize;
  if (s.color) out.color = s.color;
  return out;
}
