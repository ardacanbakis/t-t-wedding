"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { blockStyle, parseLayout, type BlockId } from "@/lib/blocks";
import { fmt, formatDeadline, formatEventDate, type GuestTexts, type Lang } from "@/lib/i18n";
import { mergeGeneral, mergeTexts, parseSchedule, parseVars, type GeneralTexts, type SiteSettings } from "@/lib/model";
import { getSupabase, withBase } from "@/lib/supabase";

type Props = {
  token: string;
  guestName: string;
  maxGuests: number | null;
  status: "pending" | "accepted" | "declined";
  partySize: number | null;
  note: string | null;
  personalNote: string | null;
  locked: boolean;
  settings: SiteSettings;
  /** Per-invite language: "auto" (bilingual) or "tr"/"en" locked to one. */
  inviteLang?: "auto" | "tr" | "en";
  /** "general" = the universal no-RSVP link; hides RSVP, shows a light-touch
   *  positive-response button + reply note, and tracks opens/clicks. */
  mode?: "personal" | "general";
};

/** Red thread + gold pin, same motif the timeline hangs its polaroids on */
function Thread() {
  return (
    <>
      <svg
        viewBox="0 0 200 40"
        preserveAspectRatio="none"
        style={{ position: "absolute", top: -14, left: "2%", width: "96%", height: 44, zIndex: 0 }}
      >
        <path d="M4 42 L100 4 L196 42" fill="none" stroke="#a83232" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", zIndex: 3, overflow: "visible" }}
      >
        <circle cx="9" cy="9" r="5.6" fill="#c9a24e" />
        <circle cx="7.4" cy="7.4" r="1.9" fill="#f3e3b5" />
      </svg>
    </>
  );
}

/** "Tansu & Arda" with the ampersand in script-gold, whatever the names are. */
function CoupleNames({ value }: { value: string }) {
  const idx = value.indexOf("&");
  if (idx < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, idx).trim()}{" "}
      <span style={{ fontFamily: "var(--script)", color: "var(--gold)", fontWeight: 500 }}>&amp;</span>{" "}
      {value.slice(idx + 1).trim()}
    </>
  );
}

function Divider({ beating }: { beating?: boolean }) {
  return (
    <div className="divider">
      <div className="line-l" />
      <span
        className="heart"
        style={beating ? { animation: "heartBeat 1.6s ease-in-out infinite", display: "inline-block" } : undefined}
      >
        ♥
      </span>
      <div className="line-r" />
    </div>
  );
}

function Countdown({ target, t }: { target: string; t: GuestTexts }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const targetMs = useMemo(() => new Date(target).getTime(), [target]);
  if (now === null || Number.isNaN(targetMs)) return null;

  const diff = Math.max(0, targetMs - now);
  if (diff === 0) return null;

  const cells: [number, string][] = [
    [Math.floor(diff / 86400000), t.cdDays],
    [Math.floor((diff % 86400000) / 3600000), t.cdHours],
    [Math.floor((diff % 3600000) / 60000), t.cdMinutes],
    [Math.floor((diff % 60000) / 1000), t.cdSeconds],
  ];

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
      {cells.map(([n, label]) => (
        <div
          key={label}
          style={{
            minWidth: 72,
            padding: "10px 8px",
            borderRadius: 12,
            border: "1px solid rgba(191,155,95,.3)",
            background: "rgba(255,253,248,.7)",
          }}
        >
          <div style={{ fontFamily: "var(--blk-ff, var(--serif))", fontWeight: 700, fontSize: "var(--blk-fs, 26px)", color: "var(--blk-color, var(--brown))", lineHeight: 1.1 }}>
            {n}
          </div>
          <div
            style={{
              fontFamily: "var(--sans)",
              fontWeight: 600,
              fontSize: 9,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: "var(--brown-link)",
              marginTop: 3,
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InviteView(props: Props) {
  const s = props.settings;
  const schedule = useMemo(() => parseSchedule(s.schedule), [s.schedule]);
  const layout = useMemo(() => parseLayout(s.layout), [s.layout]);
  const tilt = Number.parseFloat(s.cardTilt) || 0;
  // A "tr"/"en" invite is locked to that language (no toggle). "auto" (or the
  // general link) is bilingual and defaults to the visitor's language.
  const forcedLang: Lang | null =
    props.inviteLang === "en" ? "en" : props.inviteLang === "tr" ? "tr" : null;
  // Site-wide default for non-locked invites: "en" starts English, "auto"
  // follows the browser, anything else (incl. the default) starts Turkish.
  const defaultLang: Lang = s.defaultLang === "en" ? "en" : "tr";
  const [lang, setLang] = useState<Lang>(forcedLang ?? defaultLang);
  const [answer, setAnswer] = useState<"accepted" | "declined" | null>(
    props.status === "pending" ? null : props.status
  );
  const [partySize, setPartySize] = useState<number>(props.partySize && props.partySize > 0 ? props.partySize : 1);
  const [note, setNote] = useState(props.note ?? "");
  const [saved, setSaved] = useState<null | { status: "accepted" | "declined"; partySize: number }>(
    props.status !== "pending" ? { status: props.status, partySize: props.partySize ?? 1 } : null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showStoryPopup, setShowStoryPopup] = useState(false);
  const rsvpRef = useRef<HTMLDivElement | null>(null);

  // Picking an answer scrolls the RSVP options up to the top so the Send
  // button (which then pulses) is front-and-centre.
  const selectAnswer = (a: "accepted" | "declined") => {
    setAnswer(a);
    requestAnimationFrame(() => {
      rsvpRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Pick the starting language and share it with the timeline site (same
  // localStorage key). Locked invites force their language; auto/general use a
  // stored choice → the browser's language → Turkish.
  useEffect(() => {
    if (forcedLang) {
      try {
        localStorage.setItem("ta-love-lang", forcedLang);
      } catch {}
      return;
    }
    let initial: Lang = defaultLang;
    try {
      const stored = localStorage.getItem("ta-love-lang");
      if (stored === "tr" || stored === "en") initial = stored;
      else if (
        s.defaultLang === "auto" &&
        typeof navigator !== "undefined" &&
        (navigator.language || "").toLowerCase().startsWith("en")
      )
        initial = "en";
    } catch {}
    setLang(initial);
    try {
      localStorage.setItem("ta-love-lang", initial);
    } catch {}
  }, [forcedLang, defaultLang, s.defaultLang]);

  const pickLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("ta-love-lang", l);
    } catch {}
  };

  // Warm the story page in the background once the invite is on screen, so it's
  // already cached when the guest taps "Our Story". Runs at idle and bows out
  // on data-saver / very slow connections.
  useEffect(() => {
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn && (conn.saveData || /(^|-)2g/.test(conn.effectiveType || ""))) return;
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      try {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = withBase(s.storyUrl);
        document.head.appendChild(link);
      } catch {}
      const mobile = window.innerWidth < 820 && s.mobileImages !== "false";
      getSupabase()
        .from("story_chapters")
        .select("photos, visible")
        .then(({ data }) => {
          if (cancelled || !data) return;
          const seen = new Set<string>();
          for (const row of data as { photos: unknown; visible: boolean }[]) {
            if (row.visible === false) continue;
            const photos = Array.isArray(row.photos) ? row.photos : [];
            for (const f of photos) {
              if (typeof f !== "string" || !f.trim() || seen.has(f)) continue;
              seen.add(f);
              const rel = /^(https?:|assets\/|data:)/.test(f) ? f : "assets/" + f;
              let path = /^(https?:|data:)/.test(rel) ? rel : withBase("/story/") + rel;
              if (mobile && !/^(https?:|data:)/.test(rel)) path = path.replace(/(\.[a-z0-9]+)(\?.*)?$/i, "-mobile$1$2");
              const img = new Image();
              img.decoding = "async";
              img.src = path;
            }
          }
        }, () => {});
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = ric ? ric(warm) : window.setTimeout(warm, 1200);
    return () => {
      cancelled = true;
      if (!ric) clearTimeout(id);
    };
  }, [s.storyUrl, s.mobileImages]);

  const rawTexts = useMemo(() => mergeTexts(lang, s), [lang, s]);
  // Texts switched off in the dashboard become empty; then any custom
  // {placeholders} are substituted into what remains.
  const t = useMemo(() => {
    const vars = parseVars(lang === "tr" ? s.varsTr : s.varsEn);
    const hidden = new Set(layout.hiddenTexts);
    const out = { ...rawTexts };
    for (const k of Object.keys(out) as (keyof GuestTexts)[]) {
      out[k] = hidden.has(k) ? "" : fmt(out[k], vars);
    }
    return out;
  }, [rawTexts, lang, s.varsTr, s.varsEn, layout.hiddenTexts]);

  // Clicking Send opens a polite confirm popup first (when enabled); the popup's
  // "yes" calls submit() directly.
  const [showConfirm, setShowConfirm] = useState(false);
  const onSendClick = () => {
    if (!answer || pending) return;
    if (s.inviteConfirm !== "false") setShowConfirm(true);
    else submit();
  };

  const submit = async () => {
    if (!answer || pending) return;
    setShowConfirm(false);
    setError(null);
    setPending(true);
    try {
      const { data, error: rpcError } = await getSupabase().rpc("submit_rsvp", {
        p_token: props.token,
        p_answer: answer,
        p_party_size: partySize,
        p_note: note,
      });
      if (rpcError) {
        setError(rpcError.message.includes("locked") ? t.lockedNoAnswer : t.error);
        return;
      }
      const row = (data as { status: "accepted" | "declined"; party_size: number }[] | null)?.[0];
      setSaved({
        status: row?.status ?? answer,
        partySize: row?.party_size && row.party_size > 0 ? row.party_size : partySize,
      });
      setShowStoryPopup(true);
    } catch {
      setError(t.error);
    } finally {
      setPending(false);
    }
  };

  // ── General (universal) mode ──
  const isGeneral = props.mode === "general";
  const g: GeneralTexts = useMemo(() => mergeGeneral(lang, s), [lang, s]);
  const [gYes, setGYes] = useState(false);

  // Count an "open" once per browser (a refresh doesn't inflate it).
  useEffect(() => {
    if (!isGeneral) return;
    try {
      if (localStorage.getItem("tt-general-opened")) return;
      localStorage.setItem("tt-general-opened", "1");
    } catch {}
    getSupabase()
      .rpc("general_track", { p_kind: "opens" })
      .then(() => {}, () => {});
  }, [isGeneral]);

  const sayYes = async () => {
    if (gYes) return;
    setGYes(true); // optimistic + guards against a second click
    setShowStoryPopup(true);
    try {
      await getSupabase().rpc("general_track", { p_kind: "yes" });
    } catch {}
  };

  const generalBlock: ReactNode = (
    <div style={{ textAlign: "center", maxWidth: 440, margin: "0 auto" }}>
      {gYes ? (
        <div
          style={{
            background: "rgba(108,122,69,.12)",
            border: "1px solid rgba(108,122,69,.3)",
            borderRadius: 12,
            padding: "14px 18px",
            fontFamily: "var(--sans)",
            fontSize: 15,
            color: "#55632f",
          }}
        >
          {g.thanks}
          {t.storyButton && (
            <div style={{ marginTop: 12 }}>
              <a className="pill-btn" href={withBase(s.storyUrl)} onClick={() => setShowStoryPopup(true)}>
                {t.storyButton} ♥
              </a>
            </div>
          )}
        </div>
      ) : (
        <button className="submit-btn" onClick={sayYes} type="button" style={{ fontSize: 15 }}>
          {g.yes}
        </button>
      )}
      {g.replyNote && (
        <div
          style={{
            fontFamily: "var(--sans)",
            fontWeight: 300,
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--brown-soft)",
            marginTop: 16,
            whiteSpace: "pre-wrap",
          }}
        >
          {g.replyNote}
        </div>
      )}
    </div>
  );

  // ── Blocks. Each returns null when it has nothing to show, so an empty
  // schedule or a guest without a personal message doesn't leave a gap.
  const rsvpBlock: ReactNode = props.locked ? (
    <div>
      <div style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 15, color: "var(--brown-mid)" }}>
        {saved ? t.lockedWithAnswer : t.lockedNoAnswer}
      </div>
      {saved && (
        <div style={{ fontFamily: "var(--script)", fontSize: 26, color: "var(--gold)", marginTop: 8 }}>
          {saved.status === "accepted"
            ? saved.partySize > 1
              ? fmt(t.answerAcceptedMany, { n: saved.partySize })
              : t.answerAcceptedOne
            : t.answerDeclined}
        </div>
      )}
    </div>
  ) : (
    <div ref={rsvpRef} style={{ maxWidth: 440, margin: "0 auto", scrollMarginTop: 76 }}>
      <h2
        style={{
          fontFamily: "var(--blk-ff, var(--serif))",
          fontWeight: 600,
          fontSize: "var(--blk-fs, 24px)",
          color: "var(--blk-color, var(--brown))",
          textAlign: "center",
          margin: "0 0 16px",
        }}
      >
        {t.rsvpTitle}
      </h2>

      {saved && (
        <div
          style={{
            background: "rgba(108,122,69,.12)",
            border: "1px solid rgba(108,122,69,.3)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
            fontFamily: "var(--sans)",
            fontSize: 14,
            color: "#55632f",
            textAlign: "center",
          }}
        >
          {saved.status === "accepted"
            ? saved.partySize > 1
              ? fmt(t.savedAcceptedMany, { n: saved.partySize })
              : t.savedAcceptedOne
            : t.savedDeclined}
          {t.storyButton && (
            <div style={{ marginTop: 12 }}>
              <a className="pill-btn" href={withBase(s.storyUrl)} onClick={() => setShowStoryPopup(true)}>
                {t.storyButton} ♥
              </a>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className={`choice-btn${answer ? " chosen" : ""}${answer === "accepted" ? " selected-yes" : ""}${
            !answer && s.invitePulse !== "false" ? " rsvp-pulse" : ""
          }`}
          onClick={() => selectAnswer("accepted")}
          type="button"
        >
          {t.accept}
        </button>
        <button
          className={`choice-btn${answer ? " chosen" : ""}${answer === "declined" ? " selected-no" : ""}${
            !answer && s.invitePulse !== "false" ? " rsvp-pulse" : ""
          }`}
          onClick={() => selectAnswer("declined")}
          type="button"
        >
          {t.decline}
        </button>
      </div>

      {answer === "accepted" && (
        <div>
          <label className="field-label" htmlFor="party-size">
            {t.partySizeLabel}
          </label>
          {props.maxGuests != null ? (
            <>
              <select
                id="party-size"
                className={`select-input${s.invitePulse !== "false" ? " rsvp-pulse" : ""}`}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
              >
                {Array.from({ length: props.maxGuests }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--brown-soft)", marginTop: 6 }}>
                {fmt(t.partySizeHint, { max: props.maxGuests })}
              </div>
            </>
          ) : (
            <input
              id="party-size"
              className={`text-input${s.invitePulse !== "false" ? " rsvp-pulse" : ""}`}
              type="number"
              min={1}
              max={99}
              value={partySize}
              onChange={(e) => setPartySize(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            />
          )}
        </div>
      )}

      {answer && (
        <div>
          <label className="field-label" htmlFor="rsvp-note">
            {t.noteLabel}
          </label>
          <textarea
            id="rsvp-note"
            className="textarea-input"
            placeholder={t.notePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
          />
        </div>
      )}

      {error && <div style={{ color: "#a83232", fontFamily: "var(--sans)", fontSize: 13, marginTop: 12 }}>{error}</div>}

      <div style={{ textAlign: "center", margin: "34px 0 8px", minHeight: 52 }}>
        <button
          className={`submit-btn${answer && !pending && !saved ? " send-grow" : ""}`}
          onClick={onSendClick}
          disabled={!answer || pending}
          type="button"
        >
          {pending ? "…" : saved ? t.update : t.send}
        </button>
        <div style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 12, color: "var(--brown-soft)", marginTop: 22 }}>
          {fmt(t.editUntil, { date: formatDeadline(s.rsvpDeadline, lang) })}
        </div>
      </div>
    </div>
  );

  const content: Record<BlockId, ReactNode> = {
    kicker: t.kicker ? (
      <div className="kicker" style={{ fontSize: "var(--blk-fs, clamp(20px, 3vw, 26px))", fontFamily: "var(--blk-ff, var(--script))", color: "var(--blk-color, var(--gold))" }}>
        {t.kicker}
      </div>
    ) : null,
    names: (
      <h1
        style={{
          fontFamily: "var(--blk-ff, var(--serif))",
          fontWeight: 600,
          fontSize: "var(--blk-fs, clamp(38px, 7vw, 64px))",
          color: "var(--blk-color, var(--brown))",
          margin: 0,
          lineHeight: 1.08,
        }}
      >
        <CoupleNames value={s.coupleNames} />
      </h1>
    ),
    dividerTop: <Divider />,
    greeting: isGeneral ? (
      g.welcome ? (
        <p style={{ fontFamily: "var(--blk-ff, var(--sans))", fontWeight: 300, fontSize: "var(--blk-fs, 16px)", lineHeight: 1.8, color: "var(--blk-color, var(--brown-mid))", margin: 0, whiteSpace: "pre-wrap" }}>
          {g.welcome}
        </p>
      ) : null
    ) : t.dear || props.guestName ? (
      // "Dear <Name>" — the guest name is a size larger and scales with this
      // block's font size, so it can be enlarged independently of the intro.
      <p style={{ fontFamily: "var(--blk-ff, var(--sans))", fontWeight: 300, fontSize: "var(--blk-fs, 16px)", lineHeight: 1.5, color: "var(--blk-color, var(--brown-mid))", margin: 0 }}>
        {t.dear && <span style={{ fontFamily: "var(--script)", fontSize: "1.4em", color: "var(--gold)" }}>{t.dear} </span>}
        <strong style={{ fontWeight: 600, color: "var(--brown)", fontSize: "1.3em" }}>{props.guestName}</strong>
      </p>
    ) : null,
    inviteLine: !isGeneral && t.inviteLine ? (
      <p style={{ fontFamily: "var(--blk-ff, var(--sans))", fontWeight: 300, fontSize: "var(--blk-fs, 16px)", lineHeight: 1.8, color: "var(--blk-color, var(--brown-mid))", margin: 0 }}>
        {t.inviteLine}
      </p>
    ) : null,
    personalNote: props.personalNote ? (
      <p
        style={{
          fontFamily: "var(--blk-ff, var(--script))",
          fontSize: "var(--blk-fs, clamp(28px, 4.5vw, 34px))",
          lineHeight: 1.5,
          color: "var(--blk-color, var(--brown-soft))",
          margin: "0 auto",
          maxWidth: "42ch",
          whiteSpace: "pre-wrap",
        }}
      >
        {props.personalNote}
      </p>
    ) : null,
    countdown: <Countdown target={s.eventDate} t={t} />,
    date: (
      <>
        {t.dateLabel && (
          <div className="field-label" style={{ margin: "0 0 4px" }}>
            {t.dateLabel}
          </div>
        )}
        <div style={{ fontFamily: "var(--blk-ff, var(--script))", fontSize: "var(--blk-fs, clamp(24px, 4vw, 32px))", color: "var(--blk-color, var(--gold))" }}>
          {formatEventDate(s.eventDate, lang, s.dateStyle === "datetime")}
        </div>
      </>
    ),
    venue: (
      <>
        {t.venueLabel && (
          <div className="field-label" style={{ margin: "0 0 4px" }}>
            {t.venueLabel}
          </div>
        )}
        <div style={{ fontFamily: "var(--blk-ff, var(--serif))", fontSize: "var(--blk-fs, 22px)", fontWeight: 600, color: "var(--blk-color, var(--brown))" }}>{s.venueName}</div>
        <div style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 14, color: "var(--brown-mid)", marginTop: 4 }}>
          {s.venueAddress}
        </div>
      </>
    ),
    mapButton: (
      <a className="pill-btn" href={s.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--blk-fs, 12px)", fontFamily: "var(--blk-ff, var(--sans))" }}>
        📍 {t.mapButton}
      </a>
    ),
    schedule: schedule.length ? (
      <>
        {t.scheduleLabel && (
          <div className="field-label" style={{ margin: "0 0 10px" }}>
            {t.scheduleLabel}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          {schedule.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--blk-ff, var(--serif))", fontWeight: 700, fontSize: "var(--blk-fs, 22px)", color: "var(--blk-color, var(--gold))" }}>
                {item.time}
              </span>
              <span style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 15, color: "var(--brown-mid)" }}>
                {lang === "tr" ? item.tr : item.en}
              </span>
            </div>
          ))}
        </div>
      </>
    ) : null,
    dividerBottom: <Divider beating />,
    rsvp: isGeneral ? generalBlock : rsvpBlock,
    closing: t.closing ? (
      <div style={{ fontFamily: "var(--blk-ff, var(--script))", fontSize: "var(--blk-fs, 20px)", color: "var(--blk-color, var(--gold))" }}>{t.closing}</div>
    ) : null,
  };

  // Once an answer is picked, everything except the RSVP block dims away so the
  // guest focuses on sending (toggle in Invitation Styling).
  const faded = !!answer && !saved && s.inviteFade !== "false";

  const topSpace = Math.max(0, Number(s.inviteTopSpace ?? 24) || 0);

  return (
    <div className="fade-in" style={{ minHeight: "100vh", padding: `${topSpace}px 16px 60px`, position: "relative" }}>
      {/* Language toggle — same corner as the timeline site (hidden when the
          invite is locked to one language, or turned off globally) */}
      {!forcedLang && s.showInviteLang !== "false" && (
        <div style={{ position: "fixed", top: 16, left: 16, zIndex: 90, display: "flex", gap: 6 }}>
          <button className={`pill-btn${lang === "tr" ? " active" : ""}`} onClick={() => pickLang("tr")}>
            TR
          </button>
          <button className={`pill-btn${lang === "en" ? " active" : ""}`} onClick={() => pickLang("en")}>
            EN
          </button>
        </div>
      )}
      {/* Thank-you popup — appears after the guest sends their RSVP, inviting
          them to the story. Text is editable under Invitation Styling. */}
      {showStoryPopup && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowStoryPopup(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(40,26,20,.5)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            animation: "viewIn .3s ease both",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 400,
              background: "var(--paper)",
              borderRadius: 18,
              padding: "30px 24px 26px",
              textAlign: "center",
              boxShadow: "0 20px 60px -18px rgba(120,72,40,.55)",
              border: "1px solid var(--gold-soft)",
            }}
          >
            <button
              onClick={() => setShowStoryPopup(false)}
              aria-label="Close"
              type="button"
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                border: "none",
                background: "transparent",
                fontSize: 22,
                lineHeight: 1,
                color: "var(--brown-soft)",
                cursor: "pointer",
              }}
            >
              ×
            </button>
            <div style={{ fontFamily: "var(--script)", fontSize: 30, color: "var(--gold)", marginBottom: 6 }}>
              <CoupleNames value={s.coupleNames} />
            </div>
            {t.storyPrompt && (
              <p
                style={{
                  fontFamily: "var(--sans)",
                  fontWeight: 300,
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: "var(--brown-mid)",
                  margin: "0 0 20px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {t.storyPrompt}
              </p>
            )}
            <a className="pill-btn story-cta pulse-inline" href={withBase(s.storyUrl)}>
              {t.storyButton} ♥
            </a>
          </div>
        </div>
      )}

      {/* Invitation card hung on the red thread */}
      <div style={{ maxWidth: 640, margin: "24px auto 0", position: "relative" }}>
        <Thread />
        <div
          style={{
            position: "relative",
            background: "var(--paper)",
            borderRadius: 8,
            padding: "clamp(28px, 6vw, 52px) clamp(20px, 5vw, 48px) 40px",
            boxShadow: "0 8px 22px -12px rgba(120,72,40,.3), 0 30px 70px -24px rgba(120,72,40,.4)",
            // Straight by default; the dashboard can tilt it for a hung-print look.
            transform: tilt ? `rotate(${tilt}deg)` : undefined,
            textAlign: "center",
          }}
        >
          {layout.order.map((id) => {
            const style = layout.blocks[id];
            if (!style.visible) return null;
            const node = content[id];
            if (!node) return null;
            const dim = faded && id !== "rsvp";
            return (
              <div
                key={id}
                data-block={id}
                style={{
                  ...blockStyle(style),
                  opacity: dim ? 0.12 : 1,
                  transition: "opacity .5s ease",
                }}
              >
                {node}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm-send popup — polite, editable under Invitation Styling. */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 210,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(40,26,20,.5)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            animation: "viewIn .25s ease both",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              background: "var(--paper)",
              borderRadius: 18,
              padding: "26px 22px 22px",
              textAlign: "center",
              boxShadow: "0 20px 60px -18px rgba(120,72,40,.55)",
              border: "1px solid var(--gold-soft)",
            }}
          >
            {t.confirmTitle && (
              <h3 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 20, color: "var(--brown)", margin: "0 0 8px" }}>
                {t.confirmTitle}
              </h3>
            )}
            {t.confirmBody && (
              <p style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 14, lineHeight: 1.6, color: "var(--brown-mid)", margin: "0 0 18px", whiteSpace: "pre-wrap" }}>
                {t.confirmBody}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="submit-btn" onClick={submit} type="button" disabled={pending}>
                {pending ? "…" : t.confirmYes || t.send}
              </button>
              <button className="pill-btn" onClick={() => setShowConfirm(false)} type="button">
                {t.confirmNo}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
