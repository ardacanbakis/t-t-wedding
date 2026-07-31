"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { GuestTexts } from "@/lib/i18n";
import {
  DEFAULT_SETTINGS,
  fillInviteMessage,
  newToken,
  parseImportLines,
  parseMaxGuests,
  settingsFromRows,
  type Invitation,
  type SiteSettings,
} from "@/lib/model";
import type { GeneralTexts } from "@/lib/model";
import { parseLayout, type Layout } from "@/lib/blocks";
import { BASE_PATH, getSupabase } from "@/lib/supabase";
import { GeneralCard } from "./general-card";
import { LayoutCard } from "./layout-card";
import { SocialCard } from "./social-card";
import { StoryCard } from "./story-card";
import { TextsCard } from "./texts-card";
import { VarsCard } from "./vars-card";

type Tab = "invitations" | "styling" | "story" | "general";

const TABS: { id: Tab; label: string }[] = [
  { id: "invitations", label: "INVITATIONS" },
  { id: "styling", label: "INVITATION STYLING" },
  { id: "story", label: "STORY & TIMELINE" },
  { id: "general", label: "GENERAL INVITATION" },
];

type Filter = "all" | "accepted" | "declined" | "pending";

type SortKey = "name" | "group" | "max" | "status" | "party" | "note" | "sent" | "opened" | "responded";

// A comparable value per column. Numbers sort numerically, strings alphabetically;
// unlimited max sorts high, missing text/dates sort low.
function sortValue(inv: Invitation, key: SortKey): string | number {
  switch (key) {
    case "name":
      return inv.name.toLowerCase();
    case "group":
      return (inv.invite_group ?? "").toLowerCase();
    case "max":
      return inv.max_guests == null ? Number.POSITIVE_INFINITY : inv.max_guests;
    case "status":
      // waiting → declined → accepted, so the "live" answers cluster together
      return inv.status === "pending" ? 0 : inv.status === "declined" ? 1 : 2;
    case "party":
      return inv.status === "accepted" ? inv.party_size ?? 1 : inv.status === "declined" ? 0 : -1;
    case "note":
      return (inv.note ?? "").toLowerCase();
    case "sent":
      return inv.sent ? 1 : 0;
    case "opened":
      return inv.opened_at ? Date.parse(inv.opened_at) || 1 : 0;
    case "responded":
      return inv.responded_at ? Date.parse(inv.responded_at) || 1 : 0;
  }
}

// Optional table columns the couple can show/hide (Name is always shown).
type ColKey = "group" | "max" | "status" | "party" | "note" | "sent" | "opened" | "responded" | "share" | "actions";
const COLUMNS: { key: ColKey; label: string; sort?: SortKey }[] = [
  { key: "group", label: "Group", sort: "group" },
  { key: "max", label: "Max", sort: "max" },
  { key: "status", label: "Status", sort: "status" },
  { key: "party", label: "Party", sort: "party" },
  { key: "note", label: "Note", sort: "note" },
  { key: "sent", label: "Sent", sort: "sent" },
  { key: "opened", label: "Opened", sort: "opened" },
  { key: "responded", label: "Responded", sort: "responded" },
  { key: "share", label: "Share links" },
  { key: "actions", label: "Edit / Delete" },
];
const DEFAULT_COLS: Record<ColKey, boolean> = {
  group: true, max: true, status: true, party: true, note: true,
  sent: true, opened: true, responded: false, share: true, actions: true,
};

function StatusBadge({ status }: { status: Invitation["status"] }) {
  const label = status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "No response";
  return <span className={`status-badge status-${status}`}>{label}</span>;
}

function inviteUrl(token: string): string {
  return `${window.location.origin}${BASE_PATH}/i/?t=${token}`;
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = inviteUrl(token);
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

function CopyMessageButton({
  name,
  token,
  template,
  label = "Copy message",
}: {
  name: string;
  token: string;
  template: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const msg = fillInviteMessage(template, name, inviteUrl(token));
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      window.prompt("Copy the message:", msg);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button className="mini-btn" onClick={copy} type="button" title={`${label} — with this guest's name + link`}>
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function MessageTemplateCard({
  value,
  onSave,
  title,
  buttonLabel,
  description,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  title: string;
  buttonLabel: string;
  description: ReactNode;
}) {
  const [text, setText] = useState(value);
  const [seed, setSeed] = useState(value);
  if (seed !== value) {
    setSeed(value);
    setText(value);
  }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const preview = fillInviteMessage(text, "Ayşe & Mehmet", "https://ardacanbakis.github.io/t-t-wedding/i/?t=…");
  return (
    <div className="admin-card" style={{ marginBottom: 22 }}>
      <h2 className="admin-h2">{title}</h2>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "0 0 12px", lineHeight: 1.6 }}>
        {description}
      </p>
      <textarea
        className="textarea-input"
        style={{ minHeight: 200, fontSize: 14, lineHeight: 1.6 }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <label className="field-label">Preview</label>
      <div
        style={{
          background: "rgba(191,155,95,.06)",
          border: "1px solid var(--gold-soft)",
          borderRadius: 10,
          padding: "12px 14px",
          fontFamily: "var(--sans)",
          fontSize: 13,
          color: "var(--brown-mid)",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {preview}
      </div>
      <button
        className="submit-btn"
        style={{ marginTop: 14 }}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(text);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          } finally {
            setSaving(false);
          }
        }}
        disabled={saving}
        type="button"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : buttonLabel}
      </button>
    </div>
  );
}

function EditRow({
  inv,
  onSave,
  onCancel,
  colSpan,
}: {
  inv: Invitation;
  onSave: (fields: {
    name: string;
    max: string;
    personal: string;
    group: string;
    lang: "auto" | "tr" | "en";
    status: Invitation["status"];
    partySize: string;
  }) => Promise<void>;
  onCancel: () => void;
  colSpan: number;
}) {
  const [name, setName] = useState(inv.name);
  const [max, setMax] = useState(inv.max_guests == null ? "unlimited" : String(inv.max_guests));
  const [personal, setPersonal] = useState(inv.personal_note ?? "");
  const [group, setGroup] = useState(inv.invite_group ?? "");
  const [ilang, setILang] = useState<"auto" | "tr" | "en">(inv.invite_lang ?? "auto");
  const [status, setStatus] = useState<Invitation["status"]>(inv.status);
  const [partySize, setPartySize] = useState(String(inv.party_size ?? 1));
  const [pending, setPending] = useState(false);
  return (
    <tr style={{ background: "rgba(191,155,95,.08)" }}>
      <td colSpan={colSpan}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "4px 0" }}>
          <input className="text-input" style={{ flex: "2 1 220px" }} value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="text-input"
            style={{ flex: "1 1 120px" }}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="max guests or 'unlimited'"
          />
          <input
            className="text-input"
            style={{ flex: "1 1 150px" }}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Group (optional)"
            list="invite-groups"
          />
          <select
            className="select-input"
            style={{ flex: "1 1 130px", width: "auto" }}
            value={ilang}
            onChange={(e) => setILang(e.target.value as "auto" | "tr" | "en")}
            title="Invite language"
          >
            <option value="auto">Auto (TR/EN)</option>
            <option value="en">English only</option>
            <option value="tr">Turkish only</option>
          </select>
          <button
            className="mini-btn"
            disabled={pending || !name.trim()}
            onClick={async () => {
              setPending(true);
              try {
                await onSave({ name, max, personal, group, lang: ilang, status, partySize });
              } finally {
                setPending(false);
              }
            }}
            type="button"
          >
            {pending ? "…" : "Save"}
          </button>
          <button className="mini-btn" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
        {/* Response override — set/change an RSVP by hand, for stats */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "2px 0 6px" }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--brown-link)" }}>
            Response
          </span>
          <select
            className="select-input"
            style={{ width: "auto", padding: "8px 12px", fontSize: 14 }}
            value={status}
            onChange={(e) => setStatus(e.target.value as Invitation["status"])}
          >
            <option value="pending">No response</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
          {status === "accepted" && (
            <input
              className="text-input"
              style={{ flex: "0 1 130px" }}
              type="number"
              min={1}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              placeholder="party size"
              title="Party size (headcount)"
            />
          )}
        </div>
        <textarea
          className="textarea-input"
          style={{ minHeight: 60, margin: "6px 0 8px" }}
          value={personal}
          onChange={(e) => setPersonal(e.target.value)}
          placeholder="Personal message for this guest (optional) — shown on their invitation card"
        />
      </td>
    </tr>
  );
}

function toCsv(invitations: Invitation[]): string {
  const cell = (value: string | number | null | undefined): string => {
    const v = value == null ? "" : String(value);
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const header = ["Name", "Group", "Language", "Status", "Party size", "Max guests", "Sent", "Opened at", "Note", "Personal message", "Responded at", "Link"];
  const rows = invitations.map((inv) => [
    cell(inv.name),
    cell(inv.invite_group),
    cell(inv.invite_lang ?? "auto"),
    cell(inv.status),
    cell(inv.status === "accepted" ? inv.party_size ?? 1 : inv.status === "declined" ? 0 : ""),
    cell(inv.max_guests == null ? "unlimited" : inv.max_guests),
    cell(inv.sent ? "yes" : "no"),
    cell(inv.opened_at),
    cell(inv.note),
    cell(inv.personal_note),
    cell(inv.responded_at),
    cell(inviteUrl(inv.token)),
  ]);
  return "\ufeff" + [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export function Dashboard() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("invitations");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState("1");
  const [newPersonal, setNewPersonal] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newLang, setNewLang] = useState<"auto" | "tr" | "en">("auto");
  const [importGroup, setImportGroup] = useState("");
  const [importLang, setImportLang] = useState<"auto" | "tr" | "en">("auto");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sentFilter, setSentFilter] = useState<"all" | "sent" | "unsent">("all");
  const [openedFilter, setOpenedFilter] = useState<"all" | "opened" | "unopened">("all");
  const [langFilter, setLangFilter] = useState<"all" | "auto" | "tr" | "en">("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLang, setBulkLang] = useState<"auto" | "tr" | "en">("auto");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [cols, setCols] = useState<Record<ColKey, boolean>>(DEFAULT_COLS);
  const [colsOpen, setColsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [s, setS] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reload = useCallback(async () => {
    const supabase = getSupabase();
    const [invRes, setRes] = await Promise.all([
      supabase.from("invitations").select("*").order("name", { ascending: true }),
      supabase.from("settings").select("key, value"),
    ]);
    if (invRes.error) {
      setLoadError(
        invRes.error.message +
          " — make sure supabase/setup.sql has been run and your login email is in admin_emails."
      );
      return;
    }
    setLoadError(null);
    setInvitations((invRes.data as Invitation[]) ?? []);
    if (setRes.data) setS(settingsFromRows(setRes.data));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  const stats = useMemo(() => {
    const accepted = invitations.filter((i) => i.status === "accepted");
    const declined = invitations.filter((i) => i.status === "declined");
    const pendingInv = invitations.filter((i) => i.status === "pending");
    const headcount = accepted.reduce((sum, i) => sum + (i.party_size ?? 1), 0);
    return { accepted, declined, pendingInv, headcount };
  }, [invitations]);

  // Distinct groups in use, for the filter dropdown and the input datalist.
  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const i of invitations) {
      const g = (i.invite_group ?? "").trim();
      if (g) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [invitations]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invitations.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (sentFilter === "sent" && !i.sent) return false;
      if (sentFilter === "unsent" && i.sent) return false;
      if (openedFilter === "opened" && !i.opened_at) return false;
      if (openedFilter === "unopened" && i.opened_at) return false;
      if (langFilter !== "all" && (i.invite_lang ?? "auto") !== langFilter) return false;
      if (q && !i.name.toLowerCase().includes(q) && !(i.invite_group ?? "").toLowerCase().includes(q))
        return false;
      if (groupFilter === "all") return true;
      if (groupFilter === "__none") return !(i.invite_group ?? "").trim();
      return (i.invite_group ?? "").trim() === groupFilter;
    });
  }, [invitations, filter, groupFilter, sentFilter, openedFilter, langFilter, search]);

  // Sort the filtered rows by the clicked column. A stable name tiebreak keeps
  // the order predictable when the sort key ties (e.g. everyone "No response").
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...visible].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      if (cmp === 0) cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      return cmp * dir;
    });
  }, [visible, sortKey, sortDir]);

  // Click a header: same column flips direction, a new column starts ascending.
  const toggleSort = (key: SortKey) =>
    setSortDir((prevDir) => {
      if (sortKey === key) return prevDir === "asc" ? "desc" : "asc";
      setSortKey(key);
      return "asc";
    });
  const caret = (key: SortKey) =>
    sortKey === key ? <span className="sort-caret">{sortDir === "asc" ? "▲" : "▼"}</span> : null;

  const toggleCol = (key: ColKey) => setCols((prev) => ({ ...prev, [key]: !prev[key] }));
  // Columns actually rendered: the always-on select + Name, plus each shown option.
  const colCount = 2 + COLUMNS.filter((c) => cols[c.key]).length;

  const toggleSent = (inv: Invitation) =>
    run(async () => {
      const { error } = await getSupabase()
        .from("invitations")
        .update({ sent: !inv.sent, updated_at: new Date().toISOString() })
        .eq("id", inv.id);
      if (error) throw new Error(error.message);
    });

  // Selection state is scoped to the rows currently visible, so bulk actions
  // never silently touch invitations hidden behind a filter.
  const visibleIds = useMemo(() => visible.map((i) => i.id), [visible]);
  const selectedVisible = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)),
    [visibleIds, selectedIds]
  );
  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSelectAll = () =>
    setSelectedIds((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  // Bulk-set the invite language on every selected row in a single update.
  const applyBulkLang = () =>
    run(async () => {
      const ids = selectedVisible;
      if (!ids.length) return;
      const { error } = await getSupabase()
        .from("invitations")
        .update({ invite_lang: bulkLang, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw new Error(error.message);
      clearSelection();
    });

  const doImport = () =>
    run(async () => {
      const parsed = parseImportLines(importText);
      if (!parsed.length) return;
      const group = importGroup.trim() || null;
      const rows = parsed.map(({ name, maxGuests }) => ({
        name,
        max_guests: maxGuests,
        invite_group: group,
        invite_lang: importLang,
        token: newToken(),
      }));
      const { error } = await getSupabase().from("invitations").insert(rows);
      if (error) throw new Error(error.message);
      setImportMsg(`Imported ${rows.length} invitation${rows.length === 1 ? "" : "s"}${group ? ` into “${group}”` : ""}.`);
      setImportText("");
      setTimeout(() => setImportMsg(null), 4000);
    });

  const doAdd = () =>
    run(async () => {
      if (!newName.trim()) return;
      const { error } = await getSupabase().from("invitations").insert({
        name: newName.trim(),
        max_guests: parseMaxGuests(newMax),
        personal_note: newPersonal.trim() || null,
        invite_group: newGroup.trim() || null,
        invite_lang: newLang,
        token: newToken(),
      });
      if (error) throw new Error(error.message);
      setNewName("");
      setNewMax("1");
      setNewPersonal("");
      // keep newGroup so several guests can be added to the same group in a row
    });

  // Keys owned by their own editor cards — the Settings button must not
  // write them back from this component's (possibly stale) copy.
  const CARD_OWNED = [
    "textsTr",
    "textsEn",
    "layout",
    "varsTr",
    "varsEn",
    "storyTr",
    "storyEn",
    "nightFrom",
    "showLangPicker",
    "hideNavMobile",
    "autoCycle",
    "autoCycleSecs",
    "mobileImages",
    "inviteMessage",
    "reminderMessage",
    "generalTr",
    "generalEn",
    "ogTitle",
    "ogDescription",
  ];

  const saveSettingRows = async (rows: { key: string; value: string }[]) => {
    const { error } = await getSupabase().from("settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
  };

  const doSaveSettings = () =>
    run(async () => {
      const rows = Object.entries(s)
        .filter(([key]) => !CARD_OWNED.includes(key))
        .map(([key, value]) => ({ key, value }));
      const { error } = await getSupabase().from("settings").upsert(rows, { onConflict: "key" });
      if (error) throw new Error(error.message);
      setSettingsMsg("Saved.");
      setTimeout(() => setSettingsMsg(null), 3000);
    });

  const doSaveTexts = (textsTr: GuestTexts, textsEn: GuestTexts, hiddenTexts: string[]) =>
    run(async () => {
      // Visibility rides along in the layout JSON, so merge rather than replace.
      const layout: Layout = { ...parseLayout(s.layout), hiddenTexts };
      await saveSettingRows([
        { key: "textsTr", value: JSON.stringify(textsTr) },
        { key: "textsEn", value: JSON.stringify(textsEn) },
        { key: "layout", value: JSON.stringify(layout) },
      ]);
    });

  const doSaveLayout = (layout: Layout) =>
    run(async () => {
      await saveSettingRows([{ key: "layout", value: JSON.stringify(layout) }]);
    });

  const doSaveVars = (varsTr: Record<string, string>, varsEn: Record<string, string>) =>
    run(async () => {
      await saveSettingRows([
        { key: "varsTr", value: JSON.stringify(varsTr) },
        { key: "varsEn", value: JSON.stringify(varsEn) },
      ]);
    });

  const doSaveStorySite = async (storyTr: Record<string, string>, storyEn: Record<string, string>) => {
    await saveSettingRows([
      { key: "storyTr", value: JSON.stringify(storyTr) },
      { key: "storyEn", value: JSON.stringify(storyEn) },
    ]);
  };

  const doSaveNightFrom = async (nightFrom: string) => {
    await saveSettingRows([{ key: "nightFrom", value: nightFrom }]);
    setS((prev) => ({ ...prev, nightFrom }));
  };

  const doSaveShowLang = async (value: string) => {
    await saveSettingRows([{ key: "showLangPicker", value }]);
    setS((prev) => ({ ...prev, showLangPicker: value }));
  };

  const doSaveHideNavMobile = async (value: string) => {
    await saveSettingRows([{ key: "hideNavMobile", value }]);
    setS((prev) => ({ ...prev, hideNavMobile: value }));
  };

  const doSaveAutoCycle = async (value: string) => {
    await saveSettingRows([{ key: "autoCycle", value }]);
    setS((prev) => ({ ...prev, autoCycle: value }));
  };

  const doSaveAutoCycleSecs = async (value: string) => {
    await saveSettingRows([{ key: "autoCycleSecs", value }]);
    setS((prev) => ({ ...prev, autoCycleSecs: value }));
  };

  const doSaveMobileImages = async (value: string) => {
    await saveSettingRows([{ key: "mobileImages", value }]);
    setS((prev) => ({ ...prev, mobileImages: value }));
  };

  const doSaveInviteMessage = async (value: string) => {
    await saveSettingRows([{ key: "inviteMessage", value }]);
    setS((prev) => ({ ...prev, inviteMessage: value }));
  };

  const doSaveReminderMessage = async (value: string) => {
    await saveSettingRows([{ key: "reminderMessage", value }]);
    setS((prev) => ({ ...prev, reminderMessage: value }));
  };

  const doSaveSocial = (ogTitle: string, ogDescription: string) =>
    run(async () => {
      await saveSettingRows([
        { key: "ogTitle", value: ogTitle },
        { key: "ogDescription", value: ogDescription },
      ]);
    });

  const doSaveGeneral = (generalTr: GeneralTexts, generalEn: GeneralTexts) =>
    run(async () => {
      await saveSettingRows([
        { key: "generalTr", value: JSON.stringify(generalTr) },
        { key: "generalEn", value: JSON.stringify(generalEn) },
      ]);
    });

  const doDownloadCsv = () => {
    const blob = new Blob([toCsv(invitations)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rsvp-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deadlineOver = new Date() > new Date(s.rsvpDeadline);

  return (
    <div className="fade-in" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px 80px" }}>
      {/* Sticky navbar: title + actions + tab switcher */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          margin: "0 -18px",
          padding: "16px 18px 0",
          background: "rgba(253,248,240,.9)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--gold-soft)",
          boxShadow: "0 8px 20px -18px rgba(120,72,40,.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 26, color: "var(--brown)", margin: 0 }}>
            Tansu <span style={{ fontFamily: "var(--script)", color: "var(--gold)" }}>&amp;</span> Arda{" "}
            <span style={{ fontWeight: 400, fontSize: 16, color: "var(--brown-soft)" }}>· RSVP admin</span>
          </h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mini-btn" onClick={doDownloadCsv} type="button">
              Export CSV
            </button>
            <button className="mini-btn" onClick={() => getSupabase().auth.signOut()} type="button">
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0 0", paddingBottom: 10 }}>
          {TABS.map((tb) => (
            <button
              key={tb.id}
              className="pill-btn"
              style={
                tab === tb.id ? { background: "var(--gold)", color: "#fffdf8", borderColor: "var(--gold)" } : undefined
              }
              onClick={() => setTab(tb.id)}
              type="button"
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 18 }} />

      {loadError && (
        <div
          style={{
            background: "rgba(168,50,50,.08)",
            border: "1px solid rgba(168,50,50,.25)",
            borderRadius: 12,
            padding: "10px 16px",
            margin: "18px 0",
            fontFamily: "var(--sans)",
            fontSize: 13,
            color: "#a83232",
          }}
        >
          {loadError}
        </div>
      )}


      {tab === "invitations" && (
  <>
      {/* Stats */}
      {/* Each tile doubles as a filter: click to narrow the table to that
          slice (Confirmed guests + Accepted both show the accepted list). */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
        <button
          type="button"
          className={`stat-tile tone-green${filter === "accepted" ? " active" : ""}`}
          onClick={() => setFilter("accepted")}
          title="Show the accepted invitations"
        >
          <div className="num">{stats.headcount}</div>
          <div className="lbl">Confirmed guests</div>
        </button>
        <button
          type="button"
          className={`stat-tile tone-green${filter === "accepted" ? " active" : ""}`}
          onClick={() => setFilter("accepted")}
          title="Show the accepted invitations"
        >
          <div className="num">{stats.accepted.length}</div>
          <div className="lbl">Accepted</div>
        </button>
        <button
          type="button"
          className={`stat-tile tone-red${filter === "declined" ? " active" : ""}`}
          onClick={() => setFilter("declined")}
          title="Show the declined invitations"
        >
          <div className="num">{stats.declined.length}</div>
          <div className="lbl">Declined</div>
        </button>
        <button
          type="button"
          className={`stat-tile tone-amber${filter === "pending" ? " active" : ""}`}
          onClick={() => setFilter("pending")}
          title="Show invitations with no response yet"
        >
          <div className="num">{stats.pendingInv.length}</div>
          <div className="lbl">No response</div>
        </button>
        <button
          type="button"
          className={`stat-tile${filter === "all" ? " active" : ""}`}
          onClick={() => setFilter("all")}
          title="Show all invitations"
        >
          <div className="num">{invitations.length}</div>
          <div className="lbl">Invitations</div>
        </button>
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

      {/* Shared suggestions for every group input on this tab */}
      <datalist id="invite-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {/* Invitations table */}
      <div className="admin-card" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h2 className="admin-h2" style={{ margin: 0 }}>
            Invitations{" "}
            <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: "var(--brown-soft)" }}>
              ({sorted.length})
            </span>
          </h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="mini-btn"
              onClick={() => setShowFilters((v) => !v)}
              title={showFilters ? "Hide the filter controls" : "Show the filter controls"}
              type="button"
            >
              Filters {showFilters ? "▲" : "▼"}
            </button>
            <div style={{ position: "relative" }}>
              <button className="mini-btn" onClick={() => setColsOpen((v) => !v)} type="button" title="Show/hide table columns">
                Columns ▾
              </button>
              {colsOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    zIndex: 60,
                    background: "var(--paper)",
                    border: "1px solid var(--gold-soft)",
                    borderRadius: 12,
                    boxShadow: "0 16px 40px -18px rgba(120,72,40,.5)",
                    padding: "10px 12px",
                    minWidth: 170,
                  }}
                >
                  {COLUMNS.map((c) => (
                    <label
                      key={c.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 4px",
                        fontFamily: "var(--sans)",
                        fontSize: 13,
                        color: "var(--brown-mid)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={cols[c.key]}
                        onChange={() => toggleCol(c.key)}
                        style={{ width: 15, height: 15, accentColor: "var(--gold)", cursor: "pointer" }}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {showFilters && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
            <input
              className="text-input"
              style={{ width: "auto", padding: "6px 12px", fontSize: 12, minWidth: 160 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or group…"
              aria-label="Search invitations"
            />
            <select
              className="select-input"
              style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value as "all" | "auto" | "tr" | "en")}
              title="Filter by invite language"
            >
              <option value="all">All languages</option>
              <option value="auto">Auto (TR/EN)</option>
              <option value="en">English only</option>
              <option value="tr">Turkish only</option>
            </select>
            <select
              className="select-input"
              style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
              value={sentFilter}
              onChange={(e) => setSentFilter(e.target.value as "all" | "sent" | "unsent")}
              title="Filter by whether the invite has been sent"
            >
              <option value="all">Sent + unsent</option>
              <option value="unsent">Waiting to send</option>
              <option value="sent">Already sent</option>
            </select>
            <select
              className="select-input"
              style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
              value={openedFilter}
              onChange={(e) => setOpenedFilter(e.target.value as "all" | "opened" | "unopened")}
              title="Filter by whether the guest has opened their invite"
            >
              <option value="all">Opened + not</option>
              <option value="opened">Opened</option>
              <option value="unopened">Not opened</option>
            </select>
            {groups.length > 0 && (
              <select
                className="select-input"
                style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="all">All groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="__none">Ungrouped</option>
              </select>
            )}
            {(["all", "accepted", "declined", "pending"] as Filter[]).map((f) => (
              <button
                key={f}
                className="mini-btn"
                style={filter === f ? { background: "var(--gold)", color: "#fffdf8", borderColor: "var(--gold)" } : undefined}
                onClick={() => setFilter(f)}
                type="button"
              >
                {f === "all" ? "All" : f === "pending" ? "No response" : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}
        {selectedVisible.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 12,
              padding: "10px 14px",
              background: "rgba(191,155,95,.1)",
              border: "1px solid var(--gold-soft)",
              borderRadius: 10,
            }}
          >
            <strong style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown)" }}>
              {selectedVisible.length} selected
            </strong>
            <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)" }}>
              Set language to
            </span>
            <select
              className="select-input"
              style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
              value={bulkLang}
              onChange={(e) => setBulkLang(e.target.value as "auto" | "tr" | "en")}
            >
              <option value="auto">Auto (TR/EN)</option>
              <option value="en">English only</option>
              <option value="tr">Turkish only</option>
            </select>
            <button className="mini-btn" onClick={applyBulkLang} disabled={pending} type="button">
              {pending ? "Saving…" : "Apply to selected"}
            </button>
            <button className="mini-btn" onClick={clearSelection} type="button">
              Clear
            </button>
          </div>
        )}
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 34, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))}
                    onChange={toggleSelectAll}
                    title="Select all shown"
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--gold)" }}
                  />
                </th>
                <th className="sortable" onClick={() => toggleSort("name")}>Name {caret("name")}</th>
                {cols.group && <th className="sortable" onClick={() => toggleSort("group")}>Group {caret("group")}</th>}
                {cols.max && <th className="sortable" onClick={() => toggleSort("max")}>Max {caret("max")}</th>}
                {cols.status && <th className="sortable" onClick={() => toggleSort("status")}>Status {caret("status")}</th>}
                {cols.party && <th className="sortable" onClick={() => toggleSort("party")}>Party {caret("party")}</th>}
                {cols.note && <th className="sortable" onClick={() => toggleSort("note")}>Note {caret("note")}</th>}
                {cols.sent && <th className="sortable" onClick={() => toggleSort("sent")}>Sent {caret("sent")}</th>}
                {cols.opened && <th className="sortable" onClick={() => toggleSort("opened")}>Opened {caret("opened")}</th>}
                {cols.responded && <th className="sortable" onClick={() => toggleSort("responded")}>Responded {caret("responded")}</th>}
                {cols.share && <th>Share</th>}
                {cols.actions && <th></th>}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: "center", padding: 24, color: "var(--brown-soft)" }}>
                    No invitations here yet.
                  </td>
                </tr>
              )}
              {sorted.map((inv) =>
                editingId === inv.id ? (
                  <EditRow
                    key={inv.id}
                    inv={inv}
                    colSpan={colCount}
                    onCancel={() => setEditingId(null)}
                    onSave={async ({ name, max, personal, group, lang, status, partySize }) => {
                      const maxG = parseMaxGuests(max);
                      // Admin override is authoritative (for stats): clamp only to a
                      // sane 1–99, not to the invite's own max_guests.
                      let party: number | null = null;
                      if (status === "accepted") {
                        party = Math.max(1, Math.min(99, Number.parseInt(partySize, 10) || 1));
                      } else if (status === "declined") {
                        party = 0;
                      }
                      const { error } = await getSupabase()
                        .from("invitations")
                        .update({
                          name: name.trim(),
                          max_guests: maxG,
                          personal_note: personal.trim() || null,
                          invite_group: group.trim() || null,
                          invite_lang: lang,
                          status,
                          party_size: party,
                          responded_at:
                            status === "pending" ? null : inv.responded_at ?? new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        })
                        .eq("id", inv.id);
                      if (error) throw new Error(error.message);
                      setEditingId(null);
                      await reload();
                    }}
                  />
                ) : (
                  <tr key={inv.id} style={selectedIds.has(inv.id) ? { background: "rgba(191,155,95,.06)" } : undefined}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        title="Select for bulk edit"
                        style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--gold)" }}
                      />
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--brown)" }}>{inv.name}</td>
                    {cols.group && (
                      <td>
                        {inv.invite_group ? (
                          <button
                            className="mini-btn"
                            style={{ padding: "3px 10px", fontSize: 11 }}
                            onClick={() => setGroupFilter(inv.invite_group!)}
                            title={`Filter by ${inv.invite_group}`}
                            type="button"
                          >
                            {inv.invite_group}
                          </button>
                        ) : (
                          <span style={{ color: "var(--brown-soft)" }}>—</span>
                        )}
                      </td>
                    )}
                    {cols.max && <td>{inv.max_guests == null ? "∞" : inv.max_guests}</td>}
                    {cols.status && (
                      <td>
                        <StatusBadge status={inv.status} />
                      </td>
                    )}
                    {cols.party && (
                      <td>{inv.status === "accepted" ? inv.party_size ?? 1 : inv.status === "declined" ? 0 : "—"}</td>
                    )}
                    {cols.note && (
                      <td style={{ maxWidth: 260, whiteSpace: "pre-wrap", fontSize: 13 }}>{inv.note || "—"}</td>
                    )}
                    {cols.sent && (
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={inv.sent}
                          onChange={() => toggleSent(inv)}
                          title={inv.sent ? "Sent — click to mark as not sent" : "Not sent yet — click when you've sent it"}
                          style={{ width: 17, height: 17, cursor: "pointer", accentColor: "var(--gold)" }}
                        />
                      </td>
                    )}
                    {cols.opened && (
                      <td style={{ textAlign: "center" }} title={inv.opened_at ? `Opened ${new Date(inv.opened_at).toLocaleString()}` : "Not opened yet"}>
                        {inv.opened_at ? (
                          <span style={{ color: "#55632f", fontWeight: 700 }}>✓</span>
                        ) : (
                          <span style={{ color: "var(--brown-soft)" }}>—</span>
                        )}
                      </td>
                    )}
                    {cols.responded && (
                      <td style={{ fontSize: 12, color: "var(--brown-mid)", whiteSpace: "nowrap" }}>
                        {inv.responded_at ? new Date(inv.responded_at).toLocaleString() : "—"}
                      </td>
                    )}
                    {cols.share && (
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <CopyLinkButton token={inv.token} />
                          <CopyMessageButton name={inv.name} token={inv.token} template={s.inviteMessage} label="Copy message" />
                          {inv.sent && (
                            <CopyMessageButton name={inv.name} token={inv.token} template={s.reminderMessage} label="Copy reminder" />
                          )}
                        </div>
                      </td>
                    )}
                    {cols.actions && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="mini-btn" onClick={() => setEditingId(inv.id)} type="button">
                            Edit
                          </button>
                          <button
                            className="mini-btn danger"
                            onClick={() => {
                              if (window.confirm(`Delete invitation for "${inv.name}"?`))
                                run(async () => {
                                  const { error } = await getSupabase().from("invitations").delete().eq("id", inv.id);
                                  if (error) throw new Error(error.message);
                                });
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
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
          <label className="field-label">Group (optional — e.g. “Tansu&apos;s Invites”)</label>
          <input
            className="text-input"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="Tansu's Invites"
            list="invite-groups"
          />
          <label className="field-label">Language</label>
          <select className="select-input" value={newLang} onChange={(e) => setNewLang(e.target.value as "auto" | "tr" | "en")}>
            <option value="auto">Auto — bilingual (guest&apos;s browser)</option>
            <option value="en">English only</option>
            <option value="tr">Turkish only</option>
          </select>
          <label className="field-label">Personal message (optional — shown only on this guest&apos;s card)</label>
          <textarea
            className="textarea-input"
            style={{ minHeight: 60 }}
            value={newPersonal}
            onChange={(e) => setNewPersonal(e.target.value)}
            placeholder="Canım anneannem, sensiz olmazdı…"
          />
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
          <label className="field-label">Add all of these to group (optional)</label>
          <input
            className="text-input"
            value={importGroup}
            onChange={(e) => setImportGroup(e.target.value)}
            placeholder="Semra's Invites"
            list="invite-groups"
          />
          <label className="field-label">Language for all of these</label>
          <select className="select-input" value={importLang} onChange={(e) => setImportLang(e.target.value as "auto" | "tr" | "en")}>
            <option value="auto">Auto — bilingual</option>
            <option value="en">English only</option>
            <option value="tr">Turkish only</option>
          </select>
          {importMsg && <div style={{ color: "#55632f", fontFamily: "var(--sans)", fontSize: 13, marginTop: 8 }}>{importMsg}</div>}
          <button className="submit-btn" style={{ marginTop: 12 }} onClick={doImport} disabled={pending || !importText.trim()} type="button">
            Import
          </button>
        </div>
      </div>

      <MessageTemplateCard
        value={s.inviteMessage}
        onSave={doSaveInviteMessage}
        title="WhatsApp invite message"
        buttonLabel="Save invite message"
        description={
          <>
            The message the <strong>Copy message</strong> button copies for each guest — paste it straight into WhatsApp.
            Use <code>{"{name}"}</code> for the guest&apos;s name and <code>{"{link}"}</code> for their personal invitation
            link.
          </>
        }
      />
      <MessageTemplateCard
        value={s.reminderMessage}
        onSave={doSaveReminderMessage}
        title="WhatsApp reminder message"
        buttonLabel="Save reminder message"
        description={
          <>
            A gentle nudge for guests who haven&apos;t responded — the <strong>Copy reminder</strong> button copies this
            one. It appears on a row only once you&apos;ve ticked <em>Sent</em> (there&apos;s nothing to remind about
            before the first invite goes out). Same <code>{"{name}"}</code> / <code>{"{link}"}</code> placeholders. Tip:
            check who hasn&apos;t <em>Opened</em> to find who to nudge.
          </>
        }
      />

  </>
      )}
      {tab === "styling" && (
  <>
      <LayoutCard settings={s} onSave={doSaveLayout} pending={pending} />
      <TextsCard settings={s} onSave={doSaveTexts} pending={pending} />
      {/* Settings */}
      <div className="admin-card">
        <h2 className="admin-h2">Settings</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0 22px" }}>
          <div>
            <label className="field-label">RSVP deadline (guests can edit until this moment)</label>
            <input className="text-input" value={s.rsvpDeadline} onChange={(e) => setS({ ...s, rsvpDeadline: e.target.value })} placeholder="2026-06-14T23:59:00+03:00" />
            <label className="field-label">Wedding date &amp; time (drives the countdown)</label>
            <input className="text-input" value={s.eventDate} onChange={(e) => setS({ ...s, eventDate: e.target.value })} placeholder="2026-06-28T14:30:00+03:00" />
            <label className="field-label">Shown under the “Date” label</label>
            <select className="select-input" value={s.dateStyle} onChange={(e) => setS({ ...s, dateStyle: e.target.value })}>
              <option value="date">Date only — 28 Haziran 2026 Pazar</option>
              <option value="datetime">Date and time — 28 Haziran 2026 Pazar 14:30</option>
            </select>
            <label className="field-label">Venue name</label>
            <input className="text-input" value={s.venueName} onChange={(e) => setS({ ...s, venueName: e.target.value })} />
            <label className="field-label">Venue address</label>
            <input className="text-input" value={s.venueAddress} onChange={(e) => setS({ ...s, venueAddress: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Couple names (card heading — the “&amp;” gets the script styling)</label>
            <input className="text-input" value={s.coupleNames} onChange={(e) => setS({ ...s, coupleNames: e.target.value })} />
            <label className="field-label">Card tilt in degrees (0 = perfectly straight)</label>
            <input
              className="text-input"
              type="number"
              step="0.1"
              value={s.cardTilt}
              onChange={(e) => setS({ ...s, cardTilt: e.target.value })}
            />
            <label className="field-label">Google Maps link</label>
            <input className="text-input" value={s.mapsUrl} onChange={(e) => setS({ ...s, mapsUrl: e.target.value })} />
            <label className="field-label">Story site URL</label>
            <input className="text-input" value={s.storyUrl} onChange={(e) => setS({ ...s, storyUrl: e.target.value })} />
            <label className="field-label">Language picker on invitations (personal &amp; general)</label>
            <select
              className="select-input"
              value={s.showInviteLang}
              onChange={(e) => setS({ ...s, showInviteLang: e.target.value })}
            >
              <option value="true">Shown (TR/EN toggle)</option>
              <option value="false">Hidden</option>
            </select>
            <label className="field-label">Default language (invitations, welcome &amp; story)</label>
            <select
              className="select-input"
              value={s.defaultLang}
              onChange={(e) => setS({ ...s, defaultLang: e.target.value })}
              title="Starting language before the visitor picks one (locked TR/EN invites ignore this)"
            >
              <option value="tr">Turkish first</option>
              <option value="en">English first</option>
              <option value="auto">Match the visitor’s browser</option>
            </select>
            <label className="field-label">Pulse the RSVP choices &amp; guest-count selector</label>
            <select className="select-input" value={s.invitePulse} onChange={(e) => setS({ ...s, invitePulse: e.target.value })}>
              <option value="true">On — draw the eye to the RSVP</option>
              <option value="false">Off</option>
            </select>
            <label className="field-label">Fade the rest of the card once an answer is picked</label>
            <select className="select-input" value={s.inviteFade} onChange={(e) => setS({ ...s, inviteFade: e.target.value })}>
              <option value="true">On — spotlight the Send button</option>
              <option value="false">Off</option>
            </select>
            <label className="field-label">Confirm popup before sending the RSVP</label>
            <select className="select-input" value={s.inviteConfirm} onChange={(e) => setS({ ...s, inviteConfirm: e.target.value })}>
              <option value="true">On — ask “send your response?”</option>
              <option value="false">Off — send immediately</option>
            </select>
            <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--brown-soft)", marginTop: 6 }}>
              The confirm popup wording is editable under <strong>Texts</strong> above (Confirm popup — title / message /
              buttons).
            </div>
            <label className="field-label">Empty space above the card — {Number(s.inviteTopSpace) || 0}px</label>
            <input
              type="range"
              min={0}
              max={160}
              step={4}
              value={Number(s.inviteTopSpace) || 0}
              onChange={(e) => setS({ ...s, inviteTopSpace: e.target.value })}
              style={{ width: "100%", accentColor: "var(--gold)" }}
            />
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

      <VarsCard settings={s} onSave={doSaveVars} pending={pending} />
      <SocialCard settings={s} onSave={doSaveSocial} pending={pending} />
  </>
      )}
      {tab === "story" && (
      <StoryCard
        settings={s}
        onSaveSite={doSaveStorySite}
        onSaveNightFrom={doSaveNightFrom}
        onSaveShowLang={doSaveShowLang}
        onSaveHideNavMobile={doSaveHideNavMobile}
        onSaveAutoCycle={doSaveAutoCycle}
        onSaveAutoCycleSecs={doSaveAutoCycleSecs}
        onSaveMobileImages={doSaveMobileImages}
        reloadSettings={reload}
      />
      )}
      {tab === "general" && <GeneralCard settings={s} onSave={doSaveGeneral} pending={pending} />}
    </div>
  );
}
