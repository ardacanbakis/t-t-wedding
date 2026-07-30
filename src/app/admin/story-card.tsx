"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";
import {
  EMPTY_CHAPTER_TEXT,
  normalizeChapter,
  type PhotoLayout,
  type SiteSettings,
  type StoryChapter,
  type StoryChapterText,
} from "@/lib/model";
import { BASE_PATH, getSupabase } from "@/lib/supabase";

const TEXT_FIELDS: { key: keyof StoryChapterText; label: string; multiline?: boolean }[] = [
  { key: "nav", label: "Rail label (short)" },
  { key: "kicker", label: "Kicker (“Chapter One”)" },
  { key: "date", label: "Date line" },
  { key: "title", label: "Chapter title" },
  { key: "cap", label: "Photo caption" },
  { key: "body", label: "Story text", multiline: true },
  { key: "tl", label: "Timeline caption (short)", multiline: true },
];

const SITE_FIELDS: { key: string; label: string }[] = [
  { key: "navStory", label: "Nav: story button" },
  { key: "navTimeline", label: "Nav: timeline button" },
  { key: "heroKicker", label: "Hero kicker" },
  { key: "heroTagline", label: "Hero tagline" },
  { key: "navStart", label: "Rail: first label" },
  { key: "navEnd", label: "Rail: last label" },
  { key: "top", label: "Back-to-top tooltip" },
  { key: "closeSub", label: "Closing subtitle" },
  { key: "closeCredit", label: "Closing credit" },
  { key: "closeBtn", label: "Closing button (“release the cats”)" },
];

function parseSite(raw: string): Record<string, string> {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === "object") return v as Record<string, string>;
  } catch {}
  return {};
}

function PhotoEditor({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const move = (i: number, d: number) => {
    const next = [...photos];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div>
      <label className="field-label">Photos — filenames inside public/story/assets/</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {photos.length === 0 && (
          <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-soft)" }}>
            No photos yet — the frame shows an empty placeholder.
          </div>
        )}
        {photos.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE_PATH}/story/assets/${p}`}
              alt=""
              style={{
                width: 54,
                height: 40,
                objectFit: "cover",
                borderRadius: 5,
                border: "1px solid var(--gold-soft)",
                background: "rgba(0,0,0,.04)",
              }}
            />
            <input
              className="text-input"
              style={{ flex: "1 1 180px" }}
              value={p}
              onChange={(e) => onChange(photos.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button className="mini-btn" onClick={() => move(i, -1)} disabled={i === 0} type="button" title="Move left">
              ←
            </button>
            <button
              className="mini-btn"
              onClick={() => move(i, 1)}
              disabled={i === photos.length - 1}
              type="button"
              title="Move right"
            >
              →
            </button>
            <button className="mini-btn danger" onClick={() => onChange(photos.filter((_, j) => j !== i))} type="button">
              Remove
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input
          className="text-input"
          style={{ flex: "1 1 200px" }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="hecate.jpeg"
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onChange([...photos, draft.trim()]);
              setDraft("");
            }
          }}
        />
        <button
          className="mini-btn"
          onClick={() => {
            if (!draft.trim()) return;
            onChange([...photos, draft.trim()]);
            setDraft("");
          }}
          type="button"
        >
          + Add photo
        </button>
      </div>
    </div>
  );
}

export function StoryCard({
  settings,
  onSaveSite,
  onSaveNightFrom,
  onSaveShowLang,
  onSaveHideNavMobile,
  reloadSettings,
}: {
  settings: SiteSettings;
  onSaveSite: (storyTr: Record<string, string>, storyEn: Record<string, string>) => Promise<void>;
  onSaveNightFrom: (n: string) => Promise<void>;
  onSaveShowLang: (v: string) => Promise<void>;
  onSaveHideNavMobile: (v: string) => Promise<void>;
  reloadSettings: () => Promise<void>;
}) {
  const [chapters, setChapters] = useState<StoryChapter[]>([]);
  const [nightFrom, setNightFrom] = useState(settings.nightFrom || "9");
  const [nfSeed, setNfSeed] = useState(settings.nightFrom);
  if (nfSeed !== settings.nightFrom) {
    setNfSeed(settings.nightFrom);
    setNightFrom(settings.nightFrom || "9");
  }
  const showLang = settings.showLangPicker !== "false";
  const hideNavMobile = settings.hideNavMobile === "true";
  const [openId, setOpenId] = useState<number | null>(null);
  const [tab, setTab] = useState<Lang>("tr");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState<Record<Lang, Record<string, string>>>({
    tr: parseSite(settings.storyTr),
    en: parseSite(settings.storyEn),
  });
  const siteSeed = settings.storyTr + " " + settings.storyEn;
  const [seed, setSeed] = useState(siteSeed);
  if (seed !== siteSeed) {
    setSeed(siteSeed);
    setSite({ tr: parseSite(settings.storyTr), en: parseSite(settings.storyEn) });
  }

  const load = useCallback(async () => {
    const { data, error: e } = await getSupabase()
      .from("story_chapters")
      .select("*")
      .order("position", { ascending: true });
    if (e) {
      setError(e.message + " — has the latest supabase/setup.sql been run?");
      return;
    }
    setError(null);
    setChapters(((data as Partial<StoryChapter>[]) ?? []).map(normalizeChapter));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };

  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    try {
      await fn();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  const patch = (id: number, p: Partial<StoryChapter>) =>
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const patchText = (id: number, lang: Lang, p: Partial<StoryChapterText>) =>
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, [lang]: { ...c[lang], ...p } } : c)));

  const saveChapter = (c: StoryChapter) =>
    run(async () => {
      const { error: e } = await getSupabase()
        .from("story_chapters")
        .update({
          slug: c.slug,
          photos: c.photos.filter((p) => p.trim()),
          photo_layout: c.photo_layout,
          photo_fit: c.photo_fit,
          tilt: c.tilt,
          autoplay: c.autoplay,
          autoplay_ms: c.autoplay_ms,
          visible: c.visible,
          tr: c.tr,
          en: c.en,
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id);
      if (e) throw new Error(e.message);
      flash("Chapter saved.");
      await load();
    });

  const move = (index: number, delta: number) =>
    run(async () => {
      const target = index + delta;
      if (target < 0 || target >= chapters.length) return;
      const a = chapters[index];
      const b = chapters[target];
      const supabase = getSupabase();
      // Swap positions; two round-trips keeps it simple and the table is tiny.
      const r1 = await supabase.from("story_chapters").update({ position: b.position }).eq("id", a.id);
      const r2 = await supabase.from("story_chapters").update({ position: a.position }).eq("id", b.id);
      if (r1.error || r2.error) throw new Error((r1.error ?? r2.error)!.message);
      await load();
    });

  const addChapter = () =>
    run(async () => {
      const maxPos = chapters.reduce((m, c) => Math.max(m, c.position), 0);
      const slug = `c${maxPos + 1}-${Math.random().toString(36).slice(2, 6)}`;
      const { error: e } = await getSupabase()
        .from("story_chapters")
        .insert({
          position: maxPos + 1,
          slug,
          photos: [],
          tr: { ...EMPTY_CHAPTER_TEXT, title: "Yeni Bölüm", nav: "Yeni" },
          en: { ...EMPTY_CHAPTER_TEXT, title: "New Chapter", nav: "New" },
        });
      if (e) throw new Error(e.message);
      await load();
    });

  const removeChapter = (c: StoryChapter) =>
    run(async () => {
      const { error: e } = await getSupabase().from("story_chapters").delete().eq("id", c.id);
      if (e) throw new Error(e.message);
      await load();
    });

  return (
    <div className="admin-card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h2 className="admin-h2" style={{ margin: 0 }}>
          Story &amp; timeline
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
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "10px 0 14px", lineHeight: 1.6 }}>
        Chapters appear both as scroll sections on <em>Our Story</em> and as slides in the <em>Timeline</em>. Upload photos to{" "}
        <code>public/story/assets/</code> with GitHub Desktop, then list their filenames here — several per chapter is fine.
      </p>

      {error && (
        <div
          style={{
            background: "rgba(168,50,50,.08)",
            border: "1px solid rgba(168,50,50,.25)",
            borderRadius: 12,
            padding: "10px 16px",
            marginBottom: 14,
            fontFamily: "var(--sans)",
            fontSize: 13,
            color: "#a83232",
          }}
        >
          {error}
        </div>
      )}
      {msg && <div style={{ color: "#55632f", fontFamily: "var(--sans)", fontSize: 13, marginBottom: 10 }}>{msg}</div>}

      {/* Background transition point */}
      {(() => {
        const shown = chapters.filter((c) => c.visible);
        return (
          <div style={{ marginBottom: 16, maxWidth: 460 }}>
            <label className="field-label" style={{ marginTop: 0 }}>
              Starry night background starts at
            </label>
            <select
              className="select-input"
              value={nightFrom}
              onChange={(e) => {
                setNightFrom(e.target.value);
                run(() => onSaveNightFrom(e.target.value));
              }}
            >
              {shown.map((c, i) => (
                <option key={c.id} value={String(i + 1)}>
                  From chapter {i + 1} — {c[tab].title || c.slug}
                </option>
              ))}
              <option value={String(shown.length + 1)}>Never — stay pink throughout</option>
            </select>
            <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--brown-soft)", marginTop: 6 }}>
              Everything before it shows the pink daylight background; from it on, the dark starry night. Counts shown
              chapters only.
            </div>
            <label className="field-label">Language picker</label>
            <button
              className="mini-btn"
              style={showLang ? { background: "var(--gold)", color: "#fffdf8", borderColor: "var(--gold)" } : undefined}
              onClick={() => run(() => onSaveShowLang(showLang ? "false" : "true"))}
              type="button"
            >
              {showLang ? "👁 Shown on the story site" : "🚫 Hidden"}
            </button>
            <label className="field-label">Story / Timeline switch on phones</label>
            <button
              className="mini-btn"
              style={hideNavMobile ? { background: "var(--gold)", color: "#fffdf8", borderColor: "var(--gold)" } : undefined}
              onClick={() => run(() => onSaveHideNavMobile(hideNavMobile ? "false" : "true"))}
              type="button"
            >
              {hideNavMobile ? "🚫 Hidden on mobile" : "👁 Shown on mobile"}
            </button>
            <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--brown-soft)", marginTop: 6 }}>
              Hides the top-right “Our Story · Timeline” switch on small screens only. It stays visible on desktop.
            </div>
          </div>
        );
      })()}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {chapters.map((c, i) => {
          const open = openId === c.id;
          return (
            <div
              key={c.id}
              style={{
                border: "1px solid var(--gold-soft)",
                borderRadius: 10,
                background: c.visible ? "rgba(255,253,248,.7)" : "rgba(0,0,0,.03)",
                opacity: c.visible ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button
                    className="mini-btn"
                    style={{ padding: "1px 7px", lineHeight: 1.3 }}
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || pending}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    className="mini-btn"
                    style={{ padding: "1px 7px", lineHeight: 1.3 }}
                    onClick={() => move(i, 1)}
                    disabled={i === chapters.length - 1 || pending}
                    type="button"
                  >
                    ↓
                  </button>
                </div>
                <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 600, fontSize: 14, color: "var(--brown)" }}>
                  {String(i + 1).padStart(2, "0")} · {c[tab].title || c.slug}
                  {c.photos.length > 0 && (
                    <span style={{ fontWeight: 400, color: "var(--brown-soft)" }}> · {c.photos.length} 📷</span>
                  )}
                </span>
                <button className="mini-btn" onClick={() => patch(c.id, { visible: !c.visible })} type="button">
                  {c.visible ? "👁 Shown" : "🚫 Hidden"}
                </button>
                <button className="mini-btn" onClick={() => setOpenId(open ? null : c.id)} type="button">
                  {open ? "Close" : "Edit"}
                </button>
              </div>

              {open && (
                <div style={{ padding: "0 12px 14px", borderTop: "1px solid rgba(191,155,95,.2)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0 18px" }}>
                    <div>
                      {TEXT_FIELDS.map((f) =>
                        f.multiline ? (
                          <div key={f.key}>
                            <label className="field-label">{f.label}</label>
                            <textarea
                              className="textarea-input"
                              style={{ minHeight: f.key === "body" ? 120 : 78 }}
                              value={c[tab][f.key]}
                              onChange={(e) => patchText(c.id, tab, { [f.key]: e.target.value })}
                            />
                            <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--brown-soft)", margin: "4px 0 2px", lineHeight: 1.5 }}>
                              Line breaks are kept — press Enter for a new line, or leave a blank line between paragraphs.
                            </div>
                          </div>
                        ) : (
                          <div key={f.key}>
                            <label className="field-label">{f.label}</label>
                            <input
                              className="text-input"
                              value={c[tab][f.key]}
                              onChange={(e) => patchText(c.id, tab, { [f.key]: e.target.value })}
                            />
                          </div>
                        )
                      )}
                    </div>
                    <div>
                      <PhotoEditor photos={c.photos} onChange={(photos) => patch(c.id, { photos })} />
                      <label className="field-label">Photo layout (when there are several)</label>
                      <select
                        className="select-input"
                        value={c.photo_layout}
                        onChange={(e) => patch(c.id, { photo_layout: e.target.value as PhotoLayout })}
                      >
                        <option value="carousel">Carousel — framed, tap left/right half or arrows</option>
                        <option value="carousel-bare">Carousel (bare) — native size, no white frame</option>
                        <option value="stack">Fanned stack — tap to bring forward</option>
                        <option value="grid">Grid — all at once</option>
                        <option value="single">Single (original) — whole photo, no white frame</option>
                      </select>
                      <label className="field-label">Photo fit</label>
                      <select
                        className="select-input"
                        value={c.photo_fit}
                        onChange={(e) => patch(c.id, { photo_fit: e.target.value as "cover" | "contain" })}
                      >
                        <option value="cover">Cover — fill the frame (crops)</option>
                        <option value="contain">Contain — show the whole image</option>
                      </select>
                      {["carousel", "carousel-bare", "stack"].includes(c.photo_layout) ? (
                        <>
                          <label className="field-label" style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: "normal" }}>
                            <input
                              type="checkbox"
                              checked={c.autoplay}
                              onChange={(e) => patch(c.id, { autoplay: e.target.checked })}
                              style={{ width: 16, height: 16 }}
                            />
                            Auto-rotate photos
                          </label>
                          {c.autoplay && (
                            <>
                              <label className="field-label">Rotate every (seconds)</label>
                              <input
                                className="text-input"
                                type="number"
                                min={1}
                                step={0.5}
                                value={c.autoplay_ms / 1000}
                                onChange={(e) => {
                                  const secs = Number(e.target.value);
                                  patch(c.id, {
                                    autoplay_ms: Math.max(1000, Math.round((Number.isFinite(secs) ? secs : 4) * 1000)),
                                  });
                                }}
                              />
                            </>
                          )}
                        </>
                      ) : null}
                      <label className="field-label">Frame tilt (deg)</label>
                      <input
                        className="text-input"
                        type="number"
                        step="0.1"
                        value={c.tilt}
                        onChange={(e) => patch(c.id, { tilt: Number(e.target.value) || 0 })}
                      />
                      <label className="field-label">Section id (used for anchors)</label>
                      <input
                        className="text-input"
                        value={c.slug}
                        onChange={(e) => patch(c.id, { slug: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <button className="submit-btn" onClick={() => saveChapter(c)} disabled={pending} type="button">
                      Save chapter
                    </button>
                    <button
                      className="mini-btn danger"
                      onClick={() => {
                        if (window.confirm(`Delete chapter “${c[tab].title || c.slug}”?`)) removeChapter(c);
                      }}
                      disabled={pending}
                      type="button"
                    >
                      Delete chapter
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="mini-btn" style={{ marginTop: 12 }} onClick={addChapter} disabled={pending} type="button">
        + Add chapter
      </button>

      <h3 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 16, color: "var(--brown)", margin: "24px 0 4px" }}>
        Story page wording
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0 18px" }}>
        {SITE_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="field-label">{f.label}</label>
            <input
              className="text-input"
              value={site[tab][f.key] ?? ""}
              onChange={(e) => setSite({ ...site, [tab]: { ...site[tab], [f.key]: e.target.value } })}
            />
          </div>
        ))}
      </div>
      <button
        className="submit-btn"
        style={{ marginTop: 16 }}
        onClick={() =>
          run(async () => {
            await onSaveSite(site.tr, site.en);
            await reloadSettings();
            flash("Story wording saved.");
          })
        }
        disabled={pending}
        type="button"
      >
        Save story wording
      </button>
    </div>
  );
}
