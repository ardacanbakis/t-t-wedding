"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { afterWedding, type Invitation, type SiteSettings, type Wish } from "@/lib/model";
import { BASE_PATH, getSupabase } from "@/lib/supabase";
import { CopyMessageButton, MessageTemplateCard } from "./share";

type ThankFields = Partial<Pick<Invitation, "gift_note" | "thank_you_note" | "thanked_at">>;
type ThankFilter = "todo" | "came" | "all";

const MIGRATION_HINT = "Run supabase/setup.sql in the Supabase SQL editor to enable this (it's safe to re-run).";

function Note({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "0 0 14px", lineHeight: 1.6 }}>
      {children}
    </p>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(168,50,50,.08)",
        border: "1px solid rgba(168,50,50,.25)",
        borderRadius: 12,
        padding: "10px 16px",
        margin: "0 0 14px",
        fontFamily: "var(--sans)",
        fontSize: 13,
        color: "#a83232",
      }}
    >
      {children}
    </div>
  );
}

function toWishesCsv(wishes: Wish[], nameOf: (id: number | null) => string): string {
  const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = wishes.map((w) =>
    [w.name, w.message, nameOf(w.invitation_id), w.approved ? "yes" : "no", w.created_at].map(cell).join(",")
  );
  return "﻿" + ["Name,Note,Invitation,On the wall,Written at", ...rows].join("\r\n");
}

/** One guest's thank-you row, with an inline editor for the gift + note. */
function ThankRow({
  inv,
  template,
  onUpdate,
}: {
  inv: Invitation;
  template: string;
  onUpdate: (id: number, fields: ThankFields) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [gift, setGift] = useState(inv.gift_note ?? "");
  const [note, setNote] = useState(inv.thank_you_note ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (fields: ThankFields) => {
    setBusy(true);
    try {
      await onUpdate(inv.id, fields);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const toggleEditor = () => {
    if (!editing) {
      setGift(inv.gift_note ?? "");
      setNote(inv.thank_you_note ?? "");
    }
    setEditing(!editing);
  };
  const party = inv.status === "accepted" ? inv.party_size ?? 1 : inv.status === "declined" ? "—" : "?";

  return (
    <>
      <tr>
        <td style={{ fontWeight: 600, color: "var(--brown)" }}>{inv.name}</td>
        <td style={{ textAlign: "center" }} title={inv.status === "accepted" ? "Party size" : inv.status}>
          {party}
        </td>
        <td style={{ fontSize: 13, maxWidth: 200 }}>{inv.gift_note || <span style={{ color: "var(--brown-soft)" }}>—</span>}</td>
        <td style={{ fontSize: 13, maxWidth: 240, whiteSpace: "pre-wrap" }}>
          {inv.thank_you_note || <span style={{ color: "var(--brown-soft)" }}>—</span>}
        </td>
        <td style={{ textAlign: "center" }}>
          <input
            type="checkbox"
            checked={!!inv.thanked_at}
            disabled={busy}
            onChange={() => save({ thanked_at: inv.thanked_at ? null : new Date().toISOString() })}
            title={inv.thanked_at ? `Thanked ${new Date(inv.thanked_at).toLocaleDateString()} — click to undo` : "Tick once you've thanked them"}
            style={{ width: 17, height: 17, cursor: "pointer", accentColor: "var(--gold)" }}
          />
        </td>
        <td>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <CopyMessageButton name={inv.name} token={inv.token} template={template} label="Copy thank-you" />
            <button className="mini-btn" onClick={toggleEditor} type="button">
              {editing ? "Close" : "Edit"}
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr style={{ background: "rgba(191,155,95,.08)" }}>
          <td colSpan={6}>
            <label className="field-label" style={{ marginTop: 4 }}>
              Gift (only you see this)
            </label>
            <input className="text-input" value={gift} onChange={(e) => setGift(e.target.value)} placeholder="e.g. çeyrek altın, a vase…" />
            <label className="field-label">Personal thank-you — shown on their link after the wedding</label>
            <textarea
              className="textarea-input"
              style={{ minHeight: 70 }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sizi aramızda görmek harikaydı…"
            />
            <div style={{ display: "flex", gap: 8, margin: "10px 0 6px" }}>
              <button
                className="mini-btn"
                disabled={busy}
                onClick={() => save({ gift_note: gift.trim() || null, thank_you_note: note.trim() || null })}
                type="button"
              >
                {busy ? "…" : "Save"}
              </button>
              <button className="mini-btn" onClick={() => setEditing(false)} type="button">
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * The AFTER THE WEDDING tab: when guest pages switch to thank-you mode, the
 * photo links, the thank-you round (gifts, notes, who's been thanked) and the
 * guestbook.
 */
export function AfterCard({
  settings,
  invitations,
  onSaveSettings,
  onUpdateInvitation,
}: {
  settings: SiteSettings;
  invitations: Invitation[];
  onSaveSettings: (rows: { key: string; value: string }[]) => Promise<void>;
  onUpdateInvitation: (id: number, fields: ThankFields) => Promise<void>;
}) {
  // ── Mode + links ──
  const [phase, setPhase] = useState(settings.sitePhase);
  const [photosUrl, setPhotosUrl] = useState(settings.photosUrl);
  const [uploadUrl, setUploadUrl] = useState(settings.photosUploadUrl);
  const [wishesOpen, setWishesOpen] = useState(settings.wishesOpen);
  const seedKey = [settings.sitePhase, settings.photosUrl, settings.photosUploadUrl, settings.wishesOpen].join("\n");
  const [seed, setSeed] = useState(seedKey);
  if (seed !== seedKey) {
    setSeed(seedKey);
    setPhase(settings.sitePhase);
    setPhotosUrl(settings.photosUrl);
    setUploadUrl(settings.photosUploadUrl);
    setWishesOpen(settings.wishesOpen);
  }
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const showingAfter = afterWedding({ ...settings, sitePhase: phase });

  const saveMode = async () => {
    setSaving(true);
    try {
      await onSaveSettings([
        { key: "sitePhase", value: phase },
        { key: "photosUrl", value: photosUrl.trim() },
        { key: "photosUploadUrl", value: uploadUrl.trim() },
        { key: "wishesOpen", value: wishesOpen },
      ]);
      setSavedMsg("Saved.");
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Thank-yous ──
  // Before setup.sql has been re-run the new columns simply aren't in the rows.
  const thanksReady = invitations.length === 0 || "thanked_at" in invitations[0];
  const [filter, setFilter] = useState<ThankFilter>("todo");
  const came = useMemo(() => invitations.filter((i) => i.status === "accepted"), [invitations]);
  const stats = useMemo(
    () => ({
      parties: came.length,
      guests: came.reduce((n, i) => n + (i.party_size ?? 1), 0),
      thanked: invitations.filter((i) => i.thanked_at).length,
      todo: came.filter((i) => !i.thanked_at).length,
      gifts: invitations.filter((i) => (i.gift_note ?? "").trim()).length,
    }),
    [came, invitations]
  );
  const rows = useMemo(() => {
    const list = filter === "todo" ? came.filter((i) => !i.thanked_at) : filter === "came" ? came : invitations;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [filter, came, invitations]);

  // ── Guestbook ──
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [wishError, setWishError] = useState<string | null>(null);
  const loadWishes = useCallback(async () => {
    const { data, error } = await getSupabase().from("wishes").select("*").order("created_at", { ascending: false });
    if (error) {
      setWishError(error.message);
      return;
    }
    setWishError(null);
    setWishes((data as Wish[]) ?? []);
  }, []);
  useEffect(() => {
    loadWishes();
  }, [loadWishes]);

  const invName = useMemo(() => {
    const map = new Map(invitations.map((i) => [i.id, i.name]));
    return (id: number | null) => (id == null ? "" : map.get(id) ?? "");
  }, [invitations]);

  const moderate = async (w: Wish, action: "approve" | "hide" | "delete") => {
    const table = getSupabase().from("wishes");
    const { error } =
      action === "delete" ? await table.delete().eq("id", w.id) : await table.update({ approved: action === "approve" }).eq("id", w.id);
    if (error) alert(error.message);
    await loadWishes();
  };

  const downloadWishes = () => {
    if (!wishes) return;
    const blob = new Blob([toWishesCsv(wishes, invName)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guestbook-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const wallUrl = `${origin}${BASE_PATH}/wishes/`;
  const waiting = wishes?.filter((w) => !w.approved).length ?? 0;

  return (
    <>
      {/* Mode + links */}
      <div className="admin-card" style={{ marginBottom: 22 }}>
        <h2 className="admin-h2">After the wedding</h2>
        <Note>
          In <strong>thank-you mode</strong> every personal link and the general link stop asking for an RSVP and show a
          thank-you instead: who came gets a warm “thank you for being there”, who couldn&apos;t gets a “we missed you”,
          plus your personal thank-you note (below), the photo links, the story and the guestbook. The wording is editable
          under <strong>INVITATION STYLING → Texts</strong> (the “After the wedding” and “Guestbook” lines).
        </Note>
        <div
          style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 999,
            fontFamily: "var(--sans)",
            fontSize: 12,
            fontWeight: 600,
            background: showingAfter ? "rgba(108,122,69,.12)" : "rgba(191,155,95,.12)",
            color: showingAfter ? "#55632f" : "var(--brown-link)",
          }}
        >
          Guest pages {phase === settings.sitePhase ? "now show" : "will show"}: {showingAfter ? "thank-you mode" : "the invitation + RSVP"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0 22px" }}>
          <div>
            <label className="field-label">Guest pages show</label>
            <select className="select-input" value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="auto">Automatic — thank-you mode from the morning after the wedding</option>
              <option value="invite">The invitation + RSVP</option>
              <option value="after">Thank-you mode</option>
            </select>
            <label className="field-label">Guestbook</label>
            <select className="select-input" value={wishesOpen} onChange={(e) => setWishesOpen(e.target.value)}>
              <option value="true">Open — guests can leave notes</option>
              <option value="false">Closed — no new notes</option>
            </select>
          </div>
          <div>
            <label className="field-label">Photo gallery link (e.g. the photographer&apos;s album)</label>
            <input className="text-input" value={photosUrl} onChange={(e) => setPhotosUrl(e.target.value)} placeholder="https://photos.app.goo.gl/…" />
            <label className="field-label">Shared album guests can add their photos to</label>
            <input className="text-input" value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} placeholder="https://photos.app.goo.gl/…" />
            <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--brown-soft)", marginTop: 6, lineHeight: 1.5 }}>
              Leave a link empty to hide its button. A Google Photos shared album with “collaborate” on works for both.
            </div>
          </div>
        </div>
        {savedMsg && <div style={{ color: "#55632f", fontFamily: "var(--sans)", fontSize: 13, marginTop: 8 }}>{savedMsg}</div>}
        <button className="submit-btn" style={{ marginTop: 16 }} onClick={saveMode} disabled={saving} type="button">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Thank-yous */}
      <div className="admin-card" style={{ marginBottom: 22 }}>
        <h2 className="admin-h2">Thank-yous</h2>
        {!thanksReady && <Warning>Thank-you tracking needs the new database columns. {MIGRATION_HINT}</Warning>}
        <Note>
          Note what each guest gave (only you see it), write an optional personal thank-you that appears on their link,
          copy a ready-made WhatsApp thank-you, and tick them off once thanked.
        </Note>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "0 0 16px" }}>
          <button type="button" className={`stat-tile tone-green${filter === "came" ? " active" : ""}`} onClick={() => setFilter("came")}>
            <div className="num">{stats.guests}</div>
            <div className="lbl">Guests came ({stats.parties} invites)</div>
          </button>
          <button type="button" className={`stat-tile tone-amber${filter === "todo" ? " active" : ""}`} onClick={() => setFilter("todo")}>
            <div className="num">{stats.todo}</div>
            <div className="lbl">Still to thank</div>
          </button>
          <button type="button" className={`stat-tile${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
            <div className="num">{stats.thanked}</div>
            <div className="lbl">Thanked</div>
          </button>
          <div className="stat-tile" style={{ cursor: "default" }}>
            <div className="num">{stats.gifts}</div>
            <div className="lbl">Gifts noted</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {(
            [
              ["todo", "Still to thank"],
              ["came", "Everyone who came"],
              ["all", "All invitations"],
            ] as [ThankFilter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              className="mini-btn"
              style={filter === f ? { background: "var(--gold)", color: "#fffdf8", borderColor: "var(--gold)" } : undefined}
              onClick={() => setFilter(f)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ textAlign: "center" }}>Party</th>
                <th>Gift</th>
                <th>Thank-you note</th>
                <th style={{ textAlign: "center" }}>Thanked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--brown-soft)" }}>
                    {filter === "todo" && came.length > 0 ? "Everyone who came has been thanked 💛" : "Nobody here."}
                  </td>
                </tr>
              )}
              {rows.map((inv) => (
                <ThankRow key={inv.id} inv={inv} template={settings.thankYouMessage} onUpdate={onUpdateInvitation} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <MessageTemplateCard
        value={settings.thankYouMessage}
        onSave={(value) => onSaveSettings([{ key: "thankYouMessage", value }])}
        title="WhatsApp thank-you message"
        buttonLabel="Save thank-you message"
        description={
          <>
            What the <strong>Copy thank-you</strong> button copies for each guest. <code>{"{name}"}</code> is their name
            and <code>{"{link}"}</code> their personal link — which, in thank-you mode, opens their thank-you card with
            the photos and the guestbook.
          </>
        }
      />

      {/* Guestbook */}
      <div className="admin-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h2 className="admin-h2" style={{ margin: 0 }}>
            Guestbook{" "}
            {wishes && (
              <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: "var(--brown-soft)" }}>
                ({wishes.length} {wishes.length === 1 ? "note" : "notes"}
                {waiting ? ` · ${waiting} waiting for you` : ""})
              </span>
            )}
          </h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="mini-btn" onClick={loadWishes} type="button">
              Refresh
            </button>
            <button className="mini-btn" onClick={downloadWishes} disabled={!wishes?.length} type="button">
              Download CSV
            </button>
            <a className="mini-btn" href={wallUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              Open the wall
            </a>
          </div>
        </div>
        <Note>
          Notes guests leave from their link or the guestbook page land here first. Only the ones you put{" "}
          <strong>on the wall</strong> are shown publicly at <code>{wallUrl || "/wishes/"}</code>.
        </Note>
        {wishError && (
          <Warning>
            Couldn&apos;t load the guestbook ({wishError}). {MIGRATION_HINT}
          </Warning>
        )}
        {wishes && wishes.length === 0 && (
          <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-soft)", padding: "8px 0" }}>No notes yet.</div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {wishes?.map((w) => (
            <div
              key={w.id}
              style={{
                border: "1px solid var(--gold-soft)",
                borderRadius: 12,
                padding: "12px 14px",
                background: w.approved ? "rgba(108,122,69,.06)" : "var(--paper)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <strong style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--brown)" }}>{w.name}</strong>
                <span className={`status-badge ${w.approved ? "status-accepted" : "status-pending"}`}>
                  {w.approved ? "On the wall" : "Waiting"}
                </span>
              </div>
              {invName(w.invitation_id) && invName(w.invitation_id) !== w.name && (
                <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--brown-soft)" }}>
                  via {invName(w.invitation_id)}&apos;s link
                </div>
              )}
              <div style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--brown-mid)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {w.message}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: "auto" }}>
                <span style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--brown-soft)", marginRight: "auto" }}>
                  {new Date(w.created_at).toLocaleString()}
                </span>
                <button className="mini-btn" onClick={() => moderate(w, w.approved ? "hide" : "approve")} type="button">
                  {w.approved ? "Take off the wall" : "Put on the wall"}
                </button>
                <button
                  className="mini-btn danger"
                  onClick={() => window.confirm(`Delete ${w.name}'s note?`) && moderate(w, "delete")}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
