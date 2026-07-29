"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { blockStyle, parseLayout, type BlockId } from "@/lib/blocks";
import { fmt, formatDeadline, formatEventDate, type GuestTexts, type Lang } from "@/lib/i18n";
import { mergeTexts, parseSchedule, parseVars, type SiteSettings } from "@/lib/model";
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
          <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: 26, color: "var(--brown)", lineHeight: 1.1 }}>
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
  const [lang, setLang] = useState<Lang>("tr");
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

  // Share the language choice with the timeline site (same localStorage key).
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ta-love-lang");
      if (stored === "tr" || stored === "en") setLang(stored);
    } catch {}
  }, []);

  const pickLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("ta-love-lang", l);
    } catch {}
  };

  const rawTexts = useMemo(() => mergeTexts(lang, s), [lang, s]);
  // Custom {placeholders} defined in the dashboard are substituted everywhere.
  const t = useMemo(() => {
    const vars = parseVars(lang === "tr" ? s.varsTr : s.varsEn);
    if (!Object.keys(vars).length) return rawTexts;
    const out = { ...rawTexts };
    for (const k of Object.keys(out) as (keyof GuestTexts)[]) out[k] = fmt(out[k], vars);
    return out;
  }, [rawTexts, lang, s.varsTr, s.varsEn]);

  const submit = async () => {
    if (!answer || pending) return;
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
    } catch {
      setError(t.error);
    } finally {
      setPending(false);
    }
  };

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
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <h2
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 600,
          fontSize: 24,
          color: "var(--brown)",
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
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className={`choice-btn${answer === "accepted" ? " selected-yes" : ""}`}
          onClick={() => setAnswer("accepted")}
          type="button"
        >
          {t.accept}
        </button>
        <button
          className={`choice-btn${answer === "declined" ? " selected-no" : ""}`}
          onClick={() => setAnswer("declined")}
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
                className="select-input"
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
              className="text-input"
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

      <div style={{ textAlign: "center", marginTop: 22 }}>
        <button className="submit-btn" onClick={submit} disabled={!answer || pending} type="button">
          {pending ? "…" : saved ? t.update : t.send}
        </button>
        <div style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 12, color: "var(--brown-soft)", marginTop: 12 }}>
          {fmt(t.editUntil, { date: formatDeadline(s.rsvpDeadline, lang) })}
        </div>
      </div>
    </div>
  );

  const content: Record<BlockId, ReactNode> = {
    kicker: (
      <div className="kicker" style={{ fontSize: "clamp(20px, 3vw, 26px)" }}>
        {t.kicker}
      </div>
    ),
    names: (
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 600,
          fontSize: "clamp(38px, 7vw, 64px)",
          color: "var(--brown)",
          margin: 0,
          lineHeight: 1.08,
        }}
      >
        <CoupleNames value={s.coupleNames} />
      </h1>
    ),
    dividerTop: <Divider />,
    greeting: (
      <p style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 16, lineHeight: 1.8, color: "var(--brown-mid)", margin: 0 }}>
        <span style={{ fontFamily: "var(--script)", fontSize: 22, color: "var(--gold)" }}>{t.dear} </span>
        <strong style={{ fontWeight: 600, color: "var(--brown)" }}>{props.guestName}</strong>
        <br />
        {t.inviteLine}
      </p>
    ),
    personalNote: props.personalNote ? (
      <p
        style={{
          fontFamily: "var(--script)",
          fontSize: "clamp(19px, 3vw, 23px)",
          lineHeight: 1.55,
          color: "var(--brown-soft)",
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
        <div className="field-label" style={{ margin: "0 0 4px" }}>
          {t.dateLabel}
        </div>
        <div style={{ fontFamily: "var(--script)", fontSize: "clamp(24px, 4vw, 32px)", color: "var(--gold)" }}>
          {formatEventDate(s.eventDate, lang)}
        </div>
      </>
    ),
    venue: (
      <>
        <div className="field-label" style={{ margin: "0 0 4px" }}>
          {t.venueLabel}
        </div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, color: "var(--brown)" }}>{s.venueName}</div>
        <div style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 14, color: "var(--brown-mid)", marginTop: 4 }}>
          {s.venueAddress}
        </div>
      </>
    ),
    mapButton: (
      <a className="pill-btn" href={s.mapsUrl} target="_blank" rel="noopener noreferrer">
        📍 {t.mapButton}
      </a>
    ),
    schedule: schedule.length ? (
      <>
        <div className="field-label" style={{ margin: "0 0 10px" }}>
          {t.scheduleLabel}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          {schedule.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: 15, color: "var(--gold)" }}>
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
    rsvp: rsvpBlock,
    closing: (
      <div style={{ fontFamily: "var(--script)", fontSize: 20, color: "var(--gold)" }}>{t.closing}</div>
    ),
  };

  return (
    <div className="fade-in" style={{ minHeight: "100vh", padding: "84px 16px 60px", position: "relative" }}>
      {/* Language toggle — same corner as the timeline site */}
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 90, display: "flex", gap: 6 }}>
        <button className={`pill-btn${lang === "tr" ? " active" : ""}`} onClick={() => pickLang("tr")}>
          TR
        </button>
        <button className={`pill-btn${lang === "en" ? " active" : ""}`} onClick={() => pickLang("en")}>
          EN
        </button>
      </div>
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 90 }}>
        <a className="pill-btn" href={withBase(s.storyUrl)}>
          {t.storyButton} ♥
        </a>
      </div>

      {/* Invitation card hung on the red thread */}
      <div style={{ maxWidth: 640, margin: "40px auto 0", position: "relative" }}>
        <Thread />
        <div
          style={{
            position: "relative",
            background: "var(--paper)",
            borderRadius: 8,
            padding: "clamp(28px, 6vw, 52px) clamp(20px, 5vw, 48px) 40px",
            boxShadow: "0 8px 22px -12px rgba(120,72,40,.3), 0 30px 70px -24px rgba(120,72,40,.4)",
            transform: "rotate(-0.6deg)",
            textAlign: "center",
          }}
        >
          {layout.order.map((id) => {
            const style = layout.blocks[id];
            if (!style.visible) return null;
            const node = content[id];
            if (!node) return null;
            return (
              <div key={id} data-block={id} style={blockStyle(style)}>
                {node}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
