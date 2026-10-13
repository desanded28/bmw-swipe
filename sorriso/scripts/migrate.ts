import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "../src/db";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ database migrated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
