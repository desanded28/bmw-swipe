/**
 * Give (or take away) Sorriso platform-admin rights: access to /dashboard/platform (review
 * moderation, the platform privacy inbox). Platform admins must use two-step verification, and
 * every access is audited (platform.access).
 *
 *   npx tsx scripts/grant-platform-admin.ts someone@sorriso.example
 *   npx tsx scripts/grant-platform-admin.ts someone@sorriso.example --revoke
 *
 * The change itself is recorded on the platform audit chain. Revoking also ends the user's sessions.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { sessions, users } from "../src/db/schema";
import { audit } from "../src/lib/audit";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const revoke = process.argv.includes("--revoke");
  if (!email || !email.includes("@")) {
    console.error("Usage: npx tsx scripts/grant-platform-admin.ts <email> [--revoke]");
    process.exit(1);
  }
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    console.error("No user with that email. They must sign up or accept an invitation first.");
    process.exit(1);
  }
  await db.update(users).set({ isPlatformAdmin: !revoke }).where(eq(users.id, user.id));
  if (revoke) await db.delete(sessions).where(eq(sessions.userId, user.id));
  await audit({
    orgId: null,
    actor: { type: "system", id: null },
    action: "member.role_change",
    entity: { type: "user", id: user.id },
    metadata: { scope: "platform", platformAdmin: !revoke },
  });
  console.log(revoke ? "Platform-admin rights removed; the user's sessions were ended." : "Platform-admin rights granted. They must enrol in two-step verification at next sign-in.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
