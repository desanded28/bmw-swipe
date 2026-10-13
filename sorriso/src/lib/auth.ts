import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { memberships, organizations, sessions, users } from "@/db/schema";
import { newToken, sha256 } from "./ids";

const COOKIE = "sorriso_session";
const SESSION_DAYS = 30;

export type Role = (typeof memberships.$inferSelect)["role"];

export async function createSession(userId: string, orgId: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, orgId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** The signed-in staff member and their active practice, or null. */
export const getSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())));
  if (!row) return null;

  const orgs = await db
    .select({ org: organizations, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, row.user.id));
  const active = orgs.find((o) => o.org.id === row.session.orgId) ?? orgs.find((o) => o.role === "owner") ?? orgs[0] ?? null;
  return {
    sessionId: row.session.id,
    user: { id: row.user.id, name: row.user.name, email: row.user.email },
    org: active?.org ?? null,
    role: active?.role ?? null,
    orgs,
  };
});

/** For dashboard pages and actions: require a signed-in member of a practice. */
export async function requireStaff(roles?: Role[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.org || !session.role) redirect("/login?error=no-practice");
  if (roles && !roles.includes(session.role)) redirect("/dashboard?denied=1");
  return { ...session, org: session.org, role: session.role };
}

export const MANAGERS: Role[] = ["owner", "admin"];
