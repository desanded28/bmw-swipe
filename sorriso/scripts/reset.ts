/** Delete the local SQLite database, re-run migrations and seed demo data. */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const url = process.env.DATABASE_URL ?? "file:./data/sorriso.db";
if (!url.startsWith("file:")) {
  console.error("db:reset only works with a local file database. Refusing to wipe", url);
  process.exit(1);
}
const file = url.slice("file:".length);
for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) rmSync(f);
console.log(`✓ removed ${file}`);
execSync("npx tsx scripts/migrate.ts", { stdio: "inherit" });
execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });
