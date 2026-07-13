#!/usr/bin/env node
// Minimal in-memory Supabase stand-in (PostgREST + GoTrue subset) for local
// development and testing WITHOUT a real Supabase project. Mirrors the
// behaviour defined in supabase/setup.sql (RPCs, deadline lock, party-size
// clamping, admin-only table access).
//
//   node tools/mock-supabase.mjs          # listens on :54321
//
// Then run the app with:
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon
//
// Mock admin login: admin@example.com / test-pass-123

import http from "node:http";

const PORT = Number(process.env.MOCK_SUPABASE_PORT || 54321);
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "test-pass-123";
const ACCESS_TOKEN = "mock-access-token";

let nextId = 1;
const db = {
  invitations: [],
  settings: new Map([
    ["eventDate", "2026-06-28T14:30:00+03:00"],
    ["rsvpDeadline", "2027-06-14T23:59:00+03:00"],
    ["venueName", "Germencik Belediyesi"],
    ["venueAddress", "Germencik, Aydın"],
    ["mapsUrl", "https://maps.google.com/?q=Germencik+Belediyesi,+Ayd%C4%B1n"],
    ["schedule", "14:30 | Nikah Töreni | Ceremony"],
    ["storyUrl", "/story/"],
  ]),
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, prefer, x-client-info, accept-profile, content-profile, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function send(res, status, body, extra = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...CORS, ...extra });
  res.end(payload);
}

function pgError(res, message, status = 400) {
  send(res, status, { code: "P0001", message, details: null, hint: null });
}

function isAdmin(req) {
  return (req.headers.authorization || "") === `Bearer ${ACCESS_TOKEN}`;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

function sessionPayload() {
  return {
    access_token: ACCESS_TOKEN,
    token_type: "bearer",
    expires_in: 3600 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    refresh_token: "mock-refresh-token",
    user: userPayload(),
  };
}

function userPayload() {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: ADMIN_EMAIL,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Mirrors submit_rsvp() in supabase/setup.sql.
function submitRsvp({ p_token, p_answer, p_party_size, p_note }) {
  if (p_answer !== "accepted" && p_answer !== "declined") throw new Error("invalid");
  const deadlineRaw = db.settings.get("rsvpDeadline");
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  if (deadline && !Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime()) {
    throw new Error("locked");
  }
  const inv = db.invitations.find((i) => i.token === p_token);
  if (!inv) throw new Error("invalid");
  let size = Math.max(1, Number.isFinite(Number(p_party_size)) ? Math.floor(Number(p_party_size)) : 1);
  if (inv.max_guests != null) size = Math.min(size, inv.max_guests);
  size = Math.min(size, 99);
  if (p_answer === "declined") size = 0;
  inv.status = p_answer;
  inv.party_size = size;
  inv.note = String(p_note ?? "").slice(0, 2000).trim() || null;
  inv.responded_at = new Date().toISOString();
  inv.updated_at = new Date().toISOString();
  return [{ status: inv.status, party_size: inv.party_size }];
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  // ── GoTrue (auth) ──
  if (pathname === "/auth/v1/token" && req.method === "POST") {
    const body = await readBody(req);
    if (url.searchParams.get("grant_type") === "password" && body?.email === ADMIN_EMAIL && body?.password === ADMIN_PASSWORD) {
      return send(res, 200, sessionPayload());
    }
    if (url.searchParams.get("grant_type") === "refresh_token" && body?.refresh_token === "mock-refresh-token") {
      return send(res, 200, sessionPayload());
    }
    return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
  }
  if (pathname === "/auth/v1/user" && req.method === "GET") {
    if (!isAdmin(req)) return send(res, 401, { message: "invalid token" });
    return send(res, 200, userPayload());
  }
  if (pathname === "/auth/v1/logout" && req.method === "POST") {
    return send(res, 204);
  }

  // ── PostgREST: RPCs (anon allowed) ──
  if (pathname === "/rest/v1/rpc/get_invitation" && req.method === "POST") {
    const body = await readBody(req);
    const inv = db.invitations.find((i) => i.token === body?.p_token);
    return send(
      res,
      200,
      inv
        ? [
            {
              name: inv.name,
              max_guests: inv.max_guests,
              status: inv.status,
              party_size: inv.party_size,
              note: inv.note,
              personal_note: inv.personal_note,
            },
          ]
        : []
    );
  }
  if (pathname === "/rest/v1/rpc/submit_rsvp" && req.method === "POST") {
    const body = await readBody(req);
    try {
      return send(res, 200, submitRsvp(body ?? {}));
    } catch (e) {
      return pgError(res, e.message);
    }
  }

  // ── PostgREST: settings (read = anyone, write = admin) ──
  if (pathname === "/rest/v1/settings") {
    if (req.method === "GET") {
      return send(res, 200, [...db.settings].map(([key, value]) => ({ key, value })));
    }
    if (req.method === "POST") {
      if (!isAdmin(req)) return pgError(res, "permission denied", 401);
      const body = await readBody(req);
      for (const row of Array.isArray(body) ? body : [body]) {
        if (row?.key != null) db.settings.set(row.key, String(row.value ?? ""));
      }
      return send(res, 201, []);
    }
  }

  // ── PostgREST: invitations (admin only — RLS equivalent) ──
  if (pathname === "/rest/v1/invitations") {
    if (!isAdmin(req)) {
      // Matches real behaviour: RLS silently filters everything out on
      // select, and rejects writes.
      if (req.method === "GET") return send(res, 200, []);
      return pgError(res, "new row violates row-level security policy", 401);
    }
    if (req.method === "GET") {
      const rows = [...db.invitations].sort((a, b) => a.name.localeCompare(b.name));
      return send(res, 200, rows);
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const inserted = [];
      for (const row of Array.isArray(body) ? body : [body]) {
        const inv = {
          id: nextId++,
          token: row.token,
          name: row.name,
          max_guests: row.max_guests ?? null,
          status: "pending",
          party_size: null,
          note: null,
          personal_note: row.personal_note ?? null,
          responded_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        db.invitations.push(inv);
        inserted.push(inv);
      }
      return send(res, 201, inserted);
    }
    const idFilter = url.searchParams.get("id");
    const id = idFilter?.startsWith("eq.") ? Number(idFilter.slice(3)) : NaN;
    if (req.method === "PATCH") {
      const body = await readBody(req);
      const inv = db.invitations.find((i) => i.id === id);
      if (inv) Object.assign(inv, body);
      return send(res, 204);
    }
    if (req.method === "DELETE") {
      db.invitations = db.invitations.filter((i) => i.id !== id);
      return send(res, 204);
    }
  }

  send(res, 404, { message: `mock-supabase: no route for ${req.method} ${pathname}` });
});

server.listen(PORT, () => {
  console.log(`mock-supabase listening on http://localhost:${PORT}`);
  console.log(`admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
});
