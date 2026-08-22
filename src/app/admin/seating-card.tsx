"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Invitation } from "@/lib/model";
import { getSupabase } from "@/lib/supabase";

/**
 * The TABLE PLANNER tab: a seating simulator over the guest list.
 *
 * Only guests who might actually turn up are shown — accepted and
 * still-to-answer. Declines are excluded outright.
 *
 * Seats are allocated **per invitation per table**, so a family of four can sit
 * two-and-two across two tables. The plan lives in the admin-only
 * `seating_plans` table (NOT `settings`, which anon can read).
 */

export type SeatTable = {
  id: string;
  name: string;
  seats: number;
  /** Reserved for a future drag-around floor plan; unused by the grid. */
  x?: number;
  y?: number;
};

export type SeatingPlan = {
  id: number;
  name: string;
  tables: SeatTable[];
  /** tableId -> invitationId -> seats taken at that table */
  assignments: Record<string, Record<string, number>>;
  /** invitationId -> headcount override */
  heads: Record<string, number>;
};

const EMPTY_PLAN: Omit<SeatingPlan, "id"> = {
  name: "Main plan",
  tables: [],
  assignments: {},
  heads: {},
};

/**
 * Force a row from Supabase into the shape the UI assumes. jsonb columns come
 * back as whatever was stored, so a hand-edited or half-written row must never
 * be able to crash the whole admin page.
 */
function normalizePlan(row: unknown): SeatingPlan | null {
  const r = (Array.isArray(row) ? row[0] : row) as Partial<SeatingPlan> | undefined;
  if (!r || typeof r !== "object" || typeof r.id !== "number") return null;
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, never>) : {});
  return {
    id: r.id,
    name: typeof r.name === "string" ? r.name : "Main plan",
    tables: Array.isArray(r.tables)
      ? r.tables.filter((t): t is SeatTable => !!t && typeof t.id === "string").map((t) => ({
          ...t,
          name: typeof t.name === "string" ? t.name : "Table",
          seats: Number.isFinite(t.seats) ? Math.max(1, Math.floor(t.seats)) : 1,
        }))
      : [],
    assignments: obj(r.assignments) as SeatingPlan["assignments"],
    heads: obj(r.heads) as SeatingPlan["heads"],
  };
}

/** Guests who might attend. Declines never take a seat. */
export function seatableGuests(invitations: Invitation[]): Invitation[] {
  return invitations.filter((i) => i.status !== "declined");
}

/**
 * How many people this invitation brings, before any manual override:
 * accepted guests bring their confirmed party, everyone still to answer is
 * counted at their max capacity so tables aren't under-booked.
 */
export function defaultHeads(inv: Invitation): number {
  if (inv.status === "accepted") return inv.party_size ?? 1;
  return inv.max_guests ?? 1;
}

export function headsFor(inv: Invitation, heads: Record<string, number>): number {
  const override = heads[String(inv.id)];
  return Number.isFinite(override) && override > 0 ? override : defaultHeads(inv);
}

/** Seats this invitation occupies across every table. */
export function seatedFor(invId: number, assignments: SeatingPlan["assignments"]): number {
  let total = 0;
  for (const perTable of Object.values(assignments)) total += perTable[String(invId)] ?? 0;
  return total;
}

/** Seats currently used at one table. */
export function tableUsed(tableId: string, assignments: SeatingPlan["assignments"]): number {
  const perTable = assignments[tableId];
  if (!perTable) return 0;
  return Object.values(perTable).reduce((sum, n) => sum + n, 0);
}

export function SeatingCard({ invitations, pending }: { invitations: Invitation[]; pending: boolean }) {
  const [plan, setPlan] = useState<SeatingPlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [seatN, setSeatN] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "accepted" | "pending">("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [newSeats, setNewSeats] = useState("8");

  // ── Load (or create) the single plan row ──────────────────────────
  const load = useCallback(async () => {
    try {
      const { data, error } = await getSupabase().from("seating_plans").select("*").order("id").limit(1);
      if (error) throw new Error(error.message);
      const existing = normalizePlan(data);
      if (existing) {
        setPlan(existing);
        setLoadError(null);
        return;
      }
      // First visit: create the row so later saves are a simple update.
      const created = await getSupabase().from("seating_plans").insert(EMPTY_PLAN).select();
      if (created.error) throw new Error(created.error.message);
      const fresh = normalizePlan(created.data);
      if (!fresh) throw new Error("could not create a seating plan row");
      setPlan(fresh);
      setLoadError(null);
    } catch (e) {
      setLoadError(
        (e instanceof Error ? e.message : String(e)) +
          " — re-run supabase/setup.sql so the seating_plans table exists."
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = (fn: (p: SeatingPlan) => SeatingPlan) => {
    setPlan((prev) => (prev ? fn(prev) : prev));
    setDirty(true);
    setSaved(false);
  };

  const doSave = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const { error } = await getSupabase()
        .from("seating_plans")
        .update({
          tables: plan.tables,
          assignments: plan.assignments,
          heads: plan.heads,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plan.id);
      if (error) throw new Error(error.message);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────
  const guests = useMemo(() => seatableGuests(invitations), [invitations]);
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const g of guests) {
      const name = (g.invite_group ?? "").trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [guests]);

  const stats = useMemo(() => {
    if (!plan) return { people: 0, seated: 0, unseated: 0, capacity: 0, over: 0 };
    let people = 0;
    let seated = 0;
    for (const g of guests) {
      people += headsFor(g, plan.heads);
      seated += Math.min(seatedFor(g.id, plan.assignments), headsFor(g, plan.heads));
    }
    const capacity = plan.tables.reduce((sum, t) => sum + t.seats, 0);
    const over = plan.tables.filter((t) => tableUsed(t.id, plan.assignments) > t.seats).length;
    return { people, seated, unseated: people - seated, capacity, over };
  }, [guests, plan]);

  // Guests with seats still to place, after the list filters.
  const unseatedList = useMemo(() => {
    if (!plan) return [];
    const q = search.trim().toLowerCase();
    return guests
      .map((g) => ({ g, remaining: headsFor(g, plan.heads) - seatedFor(g.id, plan.assignments) }))
      .filter(({ g, remaining }) => {
        if (remaining <= 0) return false;
        if (statusFilter !== "all" && g.status !== statusFilter) return false;
        if (groupFilter !== "all" && (g.invite_group ?? "").trim() !== groupFilter) return false;
        if (q && !g.name.toLowerCase().includes(q) && !(g.invite_group ?? "").toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort((a, b) => a.g.name.localeCompare(b.g.name));
  }, [guests, plan, search, statusFilter, groupFilter]);

  const selected = selectedId == null ? null : byId.get(selectedId) ?? null;
  const selectedRemaining =
    selected && plan ? headsFor(selected, plan.heads) - seatedFor(selected.id, plan.assignments) : 0;

  // Keep the stepper inside 1..remaining as the selection changes.
  useEffect(() => {
    setSeatN((n) => Math.max(1, Math.min(n, Math.max(1, selectedRemaining))));
  }, [selectedRemaining]);

  const pickGuest = (inv: Invitation, remaining: number) => {
    if (selectedId === inv.id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(inv.id);
    setSeatN(remaining); // default to seating the whole remaining party
  };

  // ── Table + assignment actions ────────────────────────────────────
  const addTable = () =>
    mutate((p) => {
      const seats = Math.max(1, Number.parseInt(newSeats, 10) || 8);
      const id = `t${Date.now().toString(36)}${p.tables.length}`;
      return { ...p, tables: [...p.tables, { id, name: `Table ${p.tables.length + 1}`, seats }] };
    });

  const renameTable = (id: string, name: string) =>
    mutate((p) => ({ ...p, tables: p.tables.map((t) => (t.id === id ? { ...t, name } : t)) }));

  const resizeTable = (id: string, seats: number) =>
    mutate((p) => ({
      ...p,
      tables: p.tables.map((t) => (t.id === id ? { ...t, seats: Math.max(1, seats) } : t)),
    }));

  const removeTable = (id: string) =>
    mutate((p) => {
      // Its occupants simply return to the unseated list.
      const assignments = { ...p.assignments };
      delete assignments[id];
      return { ...p, tables: p.tables.filter((t) => t.id !== id), assignments };
    });

  /** Move `n` seats of an invitation onto a table (negative removes). */
  const seatAt = (tableId: string, invId: number, n: number) =>
    mutate((p) => {
      const perTable = { ...(p.assignments[tableId] ?? {}) };
      const next = (perTable[String(invId)] ?? 0) + n;
      if (next > 0) perTable[String(invId)] = next;
      else delete perTable[String(invId)];
      const assignments = { ...p.assignments, [tableId]: perTable };
      if (Object.keys(perTable).length === 0) delete assignments[tableId];
      return { ...p, assignments };
    });

  const seatSelected = (tableId: string) => {
    if (!selected) return;
    const n = Math.max(1, Math.min(seatN, selectedRemaining));
    if (n <= 0) return;
    seatAt(tableId, selected.id, n);
    if (n >= selectedRemaining) setSelectedId(null); // party fully placed
  };

  const setHeads = (invId: number, value: number) =>
    mutate((p) => ({ ...p, heads: { ...p.heads, [String(invId)]: Math.max(1, value) } }));

  /** Fill tables in order, keeping a party together whenever it fits. */
  const autoSeat = () =>
    mutate((p) => {
      const assignments: SeatingPlan["assignments"] = JSON.parse(JSON.stringify(p.assignments));
      const free = new Map(p.tables.map((t) => [t.id, t.seats - tableUsed(t.id, assignments)]));
      for (const g of guests) {
        let remaining = headsFor(g, p.heads) - seatedFor(g.id, assignments);
        if (remaining <= 0) continue;
        // Prefer a table that takes the whole party; otherwise split across tables.
        const whole = p.tables.find((t) => (free.get(t.id) ?? 0) >= remaining);
        const order = whole ? [whole, ...p.tables.filter((t) => t.id !== whole.id)] : p.tables;
        for (const t of order) {
          if (remaining <= 0) break;
          const room = free.get(t.id) ?? 0;
          if (room <= 0) continue;
          const take = Math.min(room, remaining);
          const perTable = { ...(assignments[t.id] ?? {}) };
          perTable[String(g.id)] = (perTable[String(g.id)] ?? 0) + take;
          assignments[t.id] = perTable;
          free.set(t.id, room - take);
          remaining -= take;
        }
      }
      return { ...p, assignments };
    });

  const clearAll = () => {
    if (!window.confirm("Clear every seat assignment? The tables themselves stay.")) return;
    mutate((p) => ({ ...p, assignments: {} }));
    setSelectedId(null);
  };

  // ── Render ────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="admin-card">
        <h2 className="admin-h2">Table planner</h2>
        <div
          style={{
            background: "rgba(168,50,50,.08)",
            border: "1px solid rgba(168,50,50,.25)",
            borderRadius: 12,
            padding: "10px 16px",
            fontFamily: "var(--sans)",
            fontSize: 13,
            color: "#a83232",
          }}
        >
          {loadError}
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="admin-card">
        <h2 className="admin-h2">Table planner</h2>
        <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)" }}>Loading…</p>
      </div>
    );
  }

  const chipBase = {
    border: "1px solid var(--gold-soft)",
    borderRadius: 999,
    padding: "5px 12px",
    fontFamily: "var(--sans)",
    fontSize: 13,
    cursor: "pointer",
    background: "rgba(255,253,248,.92)",
    color: "var(--brown-mid)",
  } as const;

  return (
    <div className="admin-card" style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h2 className="admin-h2" style={{ margin: 0 }}>
          Table planner{" "}
          <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: "var(--brown-soft)" }}>
            ({stats.seated}/{stats.people} seated)
          </span>
        </h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button className="mini-btn" onClick={autoSeat} disabled={pending || !plan.tables.length} type="button">
            Auto-seat remaining
          </button>
          <button className="mini-btn danger" onClick={clearAll} disabled={pending} type="button">
            Clear all
          </button>
          <button className="submit-btn" style={{ padding: "8px 18px", fontSize: 13 }} onClick={doSave} disabled={saving || pending} type="button">
            {saving ? "Saving…" : saved ? "Saved ✓" : dirty ? "Save plan •" : "Save plan"}
          </button>
        </div>
      </div>

      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "10px 0 0", lineHeight: 1.6 }}>
        Pick a guest, choose how many of their party to seat, then click a table. Guests who
        declined are left out. People who haven&apos;t answered yet are counted at their full
        invite size so you don&apos;t under-book — adjust any of them with the seat stepper.
      </p>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "16px 0" }}>
        <div className="stat-tile tone-green">
          <div className="num">{stats.seated}</div>
          <div className="lbl">Seated</div>
        </div>
        <div className={`stat-tile${stats.unseated > 0 ? " tone-amber" : ""}`}>
          <div className="num">{stats.unseated}</div>
          <div className="lbl">Still to seat</div>
        </div>
        <div className="stat-tile">
          <div className="num">{stats.people}</div>
          <div className="lbl">People</div>
        </div>
        <div className="stat-tile">
          <div className="num">{plan.tables.length}</div>
          <div className="lbl">Tables</div>
        </div>
        <div className={`stat-tile${stats.capacity < stats.people ? " tone-red" : ""}`}>
          <div className="num">{stats.capacity}</div>
          <div className="lbl">Capacity</div>
        </div>
        <div className={`stat-tile${stats.over > 0 ? " tone-red" : ""}`}>
          <div className="num">{Math.max(0, stats.capacity - stats.seated)}</div>
          <div className="lbl">Free seats</div>
        </div>
      </div>

      {stats.over > 0 && (
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
          {stats.over} table{stats.over === 1 ? " is" : "s are"} over capacity — give them more seats or move
          someone.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22 }}>
        {/* ── Left: still to seat ── */}
        <div>
          <h3 className="admin-h2" style={{ fontSize: 15, marginTop: 0 }}>
            To seat ({stats.unseated})
          </h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              className="text-input"
              style={{ width: "auto", padding: "6px 12px", fontSize: 12, minWidth: 140 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or group…"
              aria-label="Search guests to seat"
            />
            <select
              className="select-input"
              style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "accepted" | "pending")}
            >
              <option value="all">Accepted + waiting</option>
              <option value="accepted">Accepted only</option>
              <option value="pending">No response only</option>
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
              </select>
            )}
          </div>

          {/* Seat-count stepper for the selected party */}
          {selected && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                padding: "10px 14px",
                marginBottom: 10,
                background: "rgba(191,155,95,.1)",
                border: "1px solid var(--gold-soft)",
                borderRadius: 10,
                fontFamily: "var(--sans)",
                fontSize: 13,
                color: "var(--brown-mid)",
              }}
            >
              <strong style={{ color: "var(--brown)" }}>{selected.name}</strong>
              <span>seat</span>
              <button className="mini-btn" onClick={() => setSeatN((n) => Math.max(1, n - 1))} type="button">
                −
              </button>
              <strong style={{ color: "var(--brown)", minWidth: 18, textAlign: "center" }}>{seatN}</strong>
              <button
                className="mini-btn"
                onClick={() => setSeatN((n) => Math.min(selectedRemaining, n + 1))}
                type="button"
              >
                +
              </button>
              <span>of {selectedRemaining} — now click a table</span>
              <button className="mini-btn" onClick={() => setSelectedId(null)} type="button">
                Cancel
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {unseatedList.length === 0 && (
              <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-soft)", padding: "8px 0" }}>
                {stats.people === 0 ? "No guests to seat yet." : "Everyone here has a seat 🎉"}
              </div>
            )}
            {unseatedList.map(({ g, remaining }) => {
              const isSel = selectedId === g.id;
              const total = headsFor(g, plan.heads);
              const unlimited = g.status !== "accepted" && g.max_guests == null;
              return (
                <div
                  key={g.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${isSel ? "var(--gold)" : "var(--gold-soft)"}`,
                    background: isSel ? "rgba(191,155,95,.14)" : "rgba(255,253,248,.92)",
                  }}
                >
                  <button
                    onClick={() => pickGuest(g, remaining)}
                    type="button"
                    title="Select, then click a table"
                    style={{
                      flex: "1 1 auto",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: "var(--sans)",
                      fontSize: 13,
                      color: "var(--brown)",
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    <span
                      title={g.status === "accepted" ? "Accepted" : "No response yet"}
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        marginRight: 8,
                        background: g.status === "accepted" ? "#55632f" : "#b08a3e",
                      }}
                    />
                    {g.name}
                    {g.invite_group && (
                      <span style={{ color: "var(--brown-soft)", fontWeight: 400 }}> · {g.invite_group}</span>
                    )}
                  </button>
                  <span style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--brown-soft)" }}>
                    {remaining} of {total}
                    {unlimited ? " (unlimited)" : ""}
                  </span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    value={total}
                    onChange={(e) => setHeads(g.id, Number.parseInt(e.target.value, 10) || 1)}
                    title="How many people this invitation brings"
                    style={{ width: 62, padding: "4px 8px", fontSize: 12 }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: tables ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <h3 className="admin-h2" style={{ fontSize: 15, margin: 0, flex: "1 1 auto" }}>
              Tables ({plan.tables.length})
            </h3>
            <input
              className="text-input"
              type="number"
              min={1}
              value={newSeats}
              onChange={(e) => setNewSeats(e.target.value)}
              title="Seats for a new table"
              style={{ width: 68, padding: "6px 10px", fontSize: 12 }}
            />
            <button className="mini-btn" onClick={addTable} disabled={pending} type="button">
              Add table
            </button>
          </div>

          {plan.tables.length === 0 && (
            <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-soft)" }}>
              No tables yet — add one to start seating.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {plan.tables.map((t) => {
              const used = tableUsed(t.id, plan.assignments);
              const over = used > t.seats;
              const parties = Object.entries(plan.assignments[t.id] ?? {});
              return (
                <div
                  key={t.id}
                  style={{
                    border: `1px solid ${over ? "rgba(168,50,50,.5)" : "var(--gold-soft)"}`,
                    background: over ? "rgba(168,50,50,.06)" : "rgba(255,253,248,.92)",
                    borderRadius: 14,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <input
                      className="text-input"
                      value={t.name}
                      onChange={(e) => renameTable(t.id, e.target.value)}
                      style={{ flex: "1 1 auto", padding: "4px 8px", fontSize: 13, fontWeight: 600 }}
                      aria-label="Table name"
                    />
                    <button
                      className="mini-btn danger"
                      style={{ padding: "2px 8px", fontSize: 11 }}
                      onClick={() => removeTable(t.id)}
                      title="Delete this table (its guests return to the list)"
                      type="button"
                    >
                      ×
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 10,
                      fontFamily: "var(--sans)",
                      fontSize: 12,
                      color: over ? "#a83232" : "var(--brown-soft)",
                      fontWeight: 600,
                    }}
                  >
                    <span>
                      {used}/{t.seats} seats{over ? " — over!" : ""}
                    </span>
                    <input
                      className="text-input"
                      type="number"
                      min={1}
                      value={t.seats}
                      onChange={(e) => resizeTable(t.id, Number.parseInt(e.target.value, 10) || 1)}
                      title="Seats at this table"
                      style={{ width: 58, padding: "3px 6px", fontSize: 12, marginLeft: "auto" }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                    {parties.length === 0 && (
                      <span style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--brown-soft)" }}>Empty</span>
                    )}
                    {parties.map(([invId, n]) => {
                      const g = byId.get(Number(invId));
                      return (
                        <div key={invId} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span
                            style={{
                              flex: "1 1 auto",
                              fontFamily: "var(--sans)",
                              fontSize: 12,
                              color: "var(--brown-mid)",
                            }}
                          >
                            {g ? g.name : `#${invId}`} {n > 1 && <strong>×{n}</strong>}
                          </span>
                          <button
                            className="mini-btn"
                            style={{ padding: "1px 7px", fontSize: 11 }}
                            onClick={() => seatAt(t.id, Number(invId), -1)}
                            title="Move one person back to the list"
                            type="button"
                          >
                            −
                          </button>
                          <button
                            className="mini-btn"
                            style={{ padding: "1px 7px", fontSize: 11 }}
                            onClick={() => seatAt(t.id, Number(invId), -n)}
                            title="Remove this party from the table"
                            type="button"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    className="mini-btn"
                    style={
                      selected
                        ? { background: "var(--gold)", color: "#fffdf8", borderColor: "var(--gold)", width: "100%" }
                        : { width: "100%" }
                    }
                    onClick={() => seatSelected(t.id)}
                    disabled={!selected}
                    title={selected ? `Seat ${seatN} here` : "Pick a guest first"}
                    type="button"
                  >
                    {selected ? `Seat ${Math.min(seatN, selectedRemaining)} here` : "Seat here"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
