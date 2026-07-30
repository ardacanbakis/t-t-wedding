#!/usr/bin/env node
// Post-build step: bake social-share preview tags (Open Graph + Twitter Card)
// into the static HTML. Social crawlers (X, WhatsApp, Facebook, iMessage,
// LinkedIn, …) DO NOT run JavaScript, so these must be in the HTML at build
// time — they update on redeploy, not live from the dashboard.
//
// Runs after `next build`, over the exported `out/` directory. Title and
// description come from the Supabase `settings` table (ogTitle / ogDescription,
// editable in the dashboard), falling back to sensible defaults. The preview
// image is public/og-image.png, referenced by an absolute URL built from
// NEXT_PUBLIC_SITE_URL + NEXT_PUBLIC_BASE_PATH.

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "out");
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const DEFAULTS = {
  ogTitle: "Tansu & Arda — Düğün Davetiyesi",
  ogDescription: "Düğünümüze davetlisiniz · 28 Haziran 2026 · Germencik, Aydın",
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function fetchSettings() {
  if (!supaUrl || !supaKey) return {};
  try {
    const res = await fetch(supaUrl + "/rest/v1/settings?select=key,value", {
      headers: { apikey: supaKey, Authorization: "Bearer " + supaKey },
    });
    if (!res.ok) return {};
    const rows = await res.json();
    const map = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  } catch {
    return {};
  }
}

// Pages that should carry preview tags, mapped to the route their og:url uses.
const PAGES = [
  ["index.html", "/"],
  ["i/index.html", "/i/"],
  ["welcome/index.html", "/welcome/"],
  ["story/index.html", "/story/"],
  ["404.html", "/"],
];

function tags({ title, description, image, url }) {
  const m = [
    ['og:type', 'website', "property"],
    ['og:site_name', 'Tansu & Arda', "property"],
    ['og:title', title, "property"],
    ['og:description', description, "property"],
    ['og:url', url, "property"],
    ['twitter:card', 'summary_large_image', "name"],
    ['twitter:title', title, "name"],
    ['twitter:description', description, "name"],
  ];
  const lines = m
    .filter(([, v]) => v)
    .map(([k, v, attr]) => `<meta ${attr}="${k}" content="${esc(v)}">`);
  if (image) {
    // WhatsApp / iMessage / Facebook want an absolute URL plus the type and
    // dimensions; secure_url + type make the thumbnail render more reliably.
    lines.push(`<meta property="og:image" content="${esc(image)}">`);
    lines.push(`<meta property="og:image:secure_url" content="${esc(image)}">`);
    lines.push(`<meta property="og:image:type" content="image/png">`);
    lines.push(`<meta property="og:image:width" content="1200">`);
    lines.push(`<meta property="og:image:height" content="630">`);
    lines.push(`<meta property="og:image:alt" content="${esc(title)}">`);
    lines.push(`<meta name="twitter:image" content="${esc(image)}">`);
    lines.push(`<meta name="twitter:image:alt" content="${esc(title)}">`);
  }
  return OG_START + "\n" + lines.join("\n") + "\n" + OG_END + "\n";
}

const OG_START = "<!-- og:start (tools/write-og.mjs) -->";
const OG_END = "<!-- og:end -->";
// Strip a previously-injected block so re-runs stay idempotent (a normal
// build regenerates out/ first, but this keeps repeated runs clean too).
function stripOld(html) {
  const i = html.indexOf(OG_START);
  const j = html.indexOf(OG_END);
  if (i !== -1 && j !== -1 && j > i) {
    return html.slice(0, i) + html.slice(j + OG_END.length).replace(/^\n/, "");
  }
  return html;
}

async function main() {
  const s = await fetchSettings();
  const title = s.ogTitle || DEFAULTS.ogTitle;
  const description = s.ogDescription || DEFAULTS.ogDescription;
  const image = siteUrl ? `${siteUrl}${basePath}/og-image.png` : "";

  if (!siteUrl) {
    console.warn(
      "write-og: NEXT_PUBLIC_SITE_URL is not set — preview image omitted. " +
        "Set it (e.g. https://ardacanbakis.github.io) so shares show the picture."
    );
  }

  let done = 0;
  for (const [file, route] of PAGES) {
    const full = path.join(OUT, file);
    if (!fs.existsSync(full)) continue;
    let html = stripOld(fs.readFileSync(full, "utf8"));
    const url = siteUrl ? `${siteUrl}${basePath}${route}` : "";
    const block = tags({ title, description, image, url });
    if (html.includes("</head>")) {
      html = html.replace("</head>", block + "</head>");
      fs.writeFileSync(full, html);
      done++;
    }
  }
  console.log(`write-og: injected preview tags into ${done} page(s) — "${title}"`);
}

main();
