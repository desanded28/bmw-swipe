import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "../src/db";
import { backfill0001 } from "./backfill-0001";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  const summary = await backfill0001(db);
  console.log("✓ database migrated", summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
