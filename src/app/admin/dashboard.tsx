"use client";

import { useMemo, useState, useTransition } from "react";
import type { Invitation } from "@/lib/schema";
import type { SiteSettings } from "@/lib/settings";
import {
  addInvitationAction,
  deleteInvitationAction,
  importAction,
  logoutAction,
  saveSettingsAction,
  updateInvitationAction,
} from "./actions";

type Props = { invitations: Invitation[]; settings: SiteSettings };

type Filter = "all" | "accepted" | "declined" | "pending";

function StatusBadge({ status }: { status: Invitation["status"] }) {
  const label = status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "No response";
  return <span className={`status-badge status-${status}`}>{label}</span>;
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}/i/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy the link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className="mini-btn" onClick={copy} type="button">
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
}

function EditRow({
  inv,
  onDone,
}: {
  inv: Invitation;
  onDone: () => void;
}) {
  const [name, setName] = useState(inv.name);
  const [max, setMax] = useState(inv.maxGuests == null ? "unlimited" : String(inv.maxGuests));
  const [pending, start] = useTransition();
  return (
    <tr style={{ background: "rgba(191,155,95,.08)" }}>
      <td colSpan={7}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "4px 0" }}>
          <input className="text-input" style={{ flex: "2 1 220px" }} value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="text-input"
            style={{ flex: "1 1 120px" }}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="max guests or 'unlimited'"
          />
          <button
            className="mini-btn"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await updateInvitationAction(inv.id, name, max);
                onDone();
              })
            }
            type="button"
          >
            {pending ? "…" : "Save"}
          </button>
          <button className="mini-btn" onClick={onDone} type="button">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

export function Dashboard({ invitations, settings }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState("1");
  const [s, setS] = useState<SiteSettings>(settings);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const stats = useMemo(() => {
    const accepted = invitations.filter((i) => i.status === "accepted");
    const declined = invitations.filter((i) => i.status === "declined");
    const pendingInv = invitations.filter((i) => i.status === "pending");
    const headcount = accepted.reduce((sum, i) => sum + (i.partySize ?? 1), 0);
    return { accepted, declined, pendingInv, headcount };
  }, [invitations]);

  const visible = useMemo(() => {
    if (filter === "all") return invitations;
    return invitations.filter((i) => i.status === filter);
  }, [invitations, filter]);

  const doImport = () =>
    start(async () => {
      if (!importText.trim()) return;
      const res = await importAction(importText);
      setImportMsg(`Imported ${res.count} invitation${res.count === 1 ? "" : "s"}.`);
      setImportText("");
      setTimeout(() => setImportMsg(null), 4000);
    });

  const doAdd = () =>
    start(async () => {
      if (!newName.trim()) return;
      await addInvitationAction(newName, newMax);
      setNewName("");
      setNewMax("1");
    });

  const doSaveSettings = () =>
    start(async () => {
      await saveSettingsAction(s);
      setSettingsMsg("Saved.");
      setTimeout(() => setSettingsMsg(null), 3000);
    });

  const deadlineOver = new Date() > new Date(s.rsvpDeadline);

  return (
    <div className="fade-in" style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 18px 80px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 30, color: "var(--brown)", margin: 0 }}>
          Tansu <span style={{ fontFamily: "var(--script)", color: "var(--gold)" }}>&amp;</span> Arda{" "}
          <span style={{ fontWeight: 400, fontSize: 18, color: "var(--brown-soft)" }}>· RSVP admin</span>
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="mini-btn" href="/admin/export" style={{ textDecoration: "none" }}>
            Export CSV
          </a>
          <button className="mini-btn" onClick={() => start(() => logoutAction())} type="button">
            Sign out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
        <div className="stat-tile">
          <div className="num">{stats.headcount}</div>
          <div className="lbl">Confirmed guests</div>
        </div>
        <div className="stat-tile">
          <div className="num">{stats.accepted.length}</div>
          <div className="lbl">Accepted</div>
        </div>
        <div className="stat-tile">
          <div className="num">{stats.declined.length}</div>
          <div className="lbl">Declined</div>
        </div>
        <div className="stat-tile">
          <div className="num">{stats.pendingInv.length}</div>
          <div className="lbl">No response</div>
        </div>
        <div className="stat-tile">
          <div className="num">{invitations.length}</div>
          <div className="lbl">Invitations</div>
        </div>
      </div>

      {deadlineOver && (
        <div
          style={{
            background: "rgba(168,50,50,.08)",
            border: "1px solid rgba(168,50,50,.25)",
            borderRadius: 12,
            padding: "10px 16px",
            marginBottom: 18,
            fontFamily: "var(--sans)",
            fontSize: 13,
            color: "#a83232",
          }}
        >
          The RSVP deadline has passed — guests can see their answer but can no longer change it.
        </div>
      )}

      {/* Invitations table */}
      <div className="admin-card" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h2 className="admin-h2" style={{ margin: 0 }}>
            Invitations
          </h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", "accepted", "declined", "pending"] as Filter[]).map((f) => (
              <button
                key={f}
                className={`mini-btn${filter === f ? " active" : ""}`}
                style={filter === f ? { background: "var(--gold)", color: "#fffdf8", borderColor: "var(--gold)" } : undefined}
                onClick={() => setFilter(f)}
                type="button"
              >
                {f === "all" ? "All" : f === "pending" ? "No response" : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Max</th>
                <th>Status</th>
                <th>Party</th>
                <th>Note</th>
                <th>Link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--brown-soft)" }}>
                    No invitations here yet.
                  </td>
                </tr>
              )}
              {visible.map((inv) =>
                editingId === inv.id ? (
                  <EditRow key={inv.id} inv={inv} onDone={() => setEditingId(null)} />
                ) : (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, color: "var(--brown)" }}>{inv.name}</td>
                    <td>{inv.maxGuests == null ? "∞" : inv.maxGuests}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td>{inv.status === "accepted" ? inv.partySize ?? 1 : inv.status === "declined" ? 0 : "—"}</td>
                    <td style={{ maxWidth: 260, whiteSpace: "pre-wrap", fontSize: 13 }}>{inv.note || "—"}</td>
                    <td>
                      <CopyLinkButton token={inv.token} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="mini-btn" onClick={() => setEditingId(inv.id)} type="button">
                          Edit
                        </button>
                        <button
                          className="mini-btn danger"
                          onClick={() => {
                            if (window.confirm(`Delete invitation for "${inv.name}"?`))
                              start(() => deleteInvitationAction(inv.id));
                          }}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add + bulk import */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 22, marginBottom: 22 }}>
        <div className="admin-card">
          <h2 className="admin-h2">Add invitation</h2>
          <label className="field-label" style={{ marginTop: 0 }}>
            Name (person, couple, or household)
          </label>
          <input className="text-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ayşe & Mehmet Yılmaz" />
          <label className="field-label">Max guests — a number, or “unlimited”</label>
          <input className="text-input" value={newMax} onChange={(e) => setNewMax(e.target.value)} placeholder="4" />
          <button className="submit-btn" style={{ marginTop: 16 }} onClick={doAdd} disabled={pending || !newName.trim()} type="button">
            Add
          </button>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Bulk import</h2>
          <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "0 0 10px", lineHeight: 1.6 }}>
            One invitee per line: <code>Name, maxGuests</code>. Use <code>unlimited</code> for no cap; omit the number for a
            default of 1.
          </p>
          <textarea
            className="textarea-input"
            style={{ minHeight: 130, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"Ayşe & Mehmet Yılmaz, 4\nJohn Smith, unlimited\nJane Doe"}
          />
          {importMsg && <div style={{ color: "#55632f", fontFamily: "var(--sans)", fontSize: 13, marginTop: 8 }}>{importMsg}</div>}
          <button className="submit-btn" style={{ marginTop: 12 }} onClick={doImport} disabled={pending || !importText.trim()} type="button">
            Import
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="admin-card">
        <h2 className="admin-h2">Settings</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0 22px" }}>
          <div>
            <label className="field-label">RSVP deadline (guests can edit until this moment)</label>
            <input className="text-input" value={s.rsvpDeadline} onChange={(e) => setS({ ...s, rsvpDeadline: e.target.value })} placeholder="2026-06-14T23:59:00+03:00" />
            <label className="field-label">Wedding date &amp; time</label>
            <input className="text-input" value={s.eventDate} onChange={(e) => setS({ ...s, eventDate: e.target.value })} placeholder="2026-06-28T14:30:00+03:00" />
            <label className="field-label">Venue name</label>
            <input className="text-input" value={s.venueName} onChange={(e) => setS({ ...s, venueName: e.target.value })} />
            <label className="field-label">Venue address</label>
            <input className="text-input" value={s.venueAddress} onChange={(e) => setS({ ...s, venueAddress: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Google Maps link</label>
            <input className="text-input" value={s.mapsUrl} onChange={(e) => setS({ ...s, mapsUrl: e.target.value })} />
            <label className="field-label">Story site URL</label>
            <input className="text-input" value={s.storyUrl} onChange={(e) => setS({ ...s, storyUrl: e.target.value })} />
            <label className="field-label">Schedule — one per line: HH:MM | Türkçe | English</label>
            <textarea
              className="textarea-input"
              style={{ minHeight: 96, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
              value={s.schedule}
              onChange={(e) => setS({ ...s, schedule: e.target.value })}
              placeholder={"14:30 | Nikah Töreni | Ceremony\n18:00 | Yemek | Dinner"}
            />
          </div>
        </div>
        {settingsMsg && <div style={{ color: "#55632f", fontFamily: "var(--sans)", fontSize: 13, marginTop: 8 }}>{settingsMsg}</div>}
        <button className="submit-btn" style={{ marginTop: 16 }} onClick={doSaveSettings} disabled={pending} type="button">
          Save settings
        </button>
      </div>
    </div>
  );
}
