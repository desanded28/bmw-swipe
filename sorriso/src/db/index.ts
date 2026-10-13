import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { serializeWrites } from "./serialize";

const url = process.env.DATABASE_URL ?? "file:./data/sorriso.db";
const isLocalFile = url.startsWith("file:") && !url.includes(":memory:");

// libsql creates the database file but not its folder.
if (isLocalFile) mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });

function connect(): Client {
  const raw = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  if (!isLocalFile) return raw; // Turso / sqld handle concurrency server-side.
  const client = serializeWrites(raw);
  // WAL: readers never block the writer and vice versa. Persistent per file.
  client.execute("PRAGMA journal_mode = WAL").catch(() => {});
  return client;
}

const globalForDb = globalThis as unknown as { __sorrisoClient?: Client };

// Reuse the client across hot reloads in dev.
const client = globalForDb.__sorrisoClient ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.__sorrisoClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
/** A transaction handle or the root db — both expose the same query API. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;
export { client, schema };
