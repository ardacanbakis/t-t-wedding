import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// SQLite file on disk by default (self-hosting friendly, zero config).
// Set DATABASE_URL (+ DATABASE_AUTH_TOKEN) to point at a Turso/libSQL server
// instead if you ever want a hosted database.
const DDL = `
CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  max_guests INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  party_size INTEGER,
  note TEXT,
  responded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

type Db = LibSQLDatabase<typeof schema>;

const g = globalThis as unknown as { __ttdb?: { db: Db; ready: Promise<void> } };

function connect(): { db: Db; ready: Promise<void> } {
  let url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    url = "file:" + path.join(dir, "wedding.db");
  }
  const client: Client = createClient(authToken ? { url, authToken } : { url });
  const db = drizzle(client, { schema });
  const ready = client.executeMultiple(DDL);
  return { db, ready };
}

export async function getDb(): Promise<Db> {
  if (!g.__ttdb) g.__ttdb = connect();
  await g.__ttdb.ready;
  return g.__ttdb.db;
}
