"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { MEMBERSHIP_ROLES, type MembershipRole } from "@/db/enums";
import { authTokens, memberships, users } from "@/db/schema";
import { getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { requireStepUp, revokeUserSessions, type StaffSession } from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { emailWhen, sendAuthEmail, staffEmailLocale } from "@/lib/security/emails";
import { clearMfa } from "@/lib/security/mfa";
import { withdrawIssuedAccess, type WithdrawnAccess } from "@/lib/security/offboarding";
import { issueAuthToken } from "@/lib/security/tokens";
import { securityTexts } from "@/lib/security/staff-locale";
import { fail, guard, ok, type ActionResult } from "./_shared";

/**
 * Team members: invitations (7-day single-use links carrying the role), role changes, removal and
 * two-step resets. All need team.manage and a recent re-authentication (they hand out or take away
 * access to patient data), and each is audited as member.* in the practice's chain.
 *
 * Rules: nobody changes their own role or removes themselves; only an owner gives or takes away
 * the owner role; a practice always keeps at least one owner.
 *
 * An account can belong to several practices, and its password, two-step verification and
 * sessions are shared between them. So a practice acts only on what is its own: removal ends the
 * sessions open in this practice (all of them only when this was the person's only practice), and
 * a two-step reset, which would weaken the account everywhere, is refused for someone who also
 * works for another practice or is a platform admin (Sorriso support handles those).
 *
 * Removal and role changes also withdraw the calendar-feed URLs and API keys the person was shown
 * and may no longer issue (src/lib/security/offboarding.ts).
 */


async function membership(orgId: string, userId: string) {
  const [m] = await db
    .select({ role: memberships.role, name: users.name, email: users.email, locale: users.locale, isPlatformAdmin: users.isPlatformAdmin })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  return m ?? null;
}

/** Does the user belong to any practice other than `orgId`? */
async function memberElsewhere(userId: string, orgId: string): Promise<boolean> {
  const [row] = await db
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), ne(memberships.orgId, orgId)))
    .limit(1);
  return Boolean(row);
}

/** Audit each withdrawn feed and key, and the sentences telling the manager about them. */
async function reportWithdrawn(
  s: StaffSession,
  withdrawn: WithdrawnAccess,
  cause: "member_removed" | "role_changed",
  t: Awaited<ReturnType<typeof securityTexts>>,
): Promise<string[]> {
  for (const id of withdrawn.feeds) {
    await auditStaff(s, "ics.feed.rotate", { type: "practitioner", id }, { metadata: { enabled: false, cause } });
  }
  for (const id of withdrawn.keys) await auditStaff(s, "apikey.revoke", { type: "api_key", id }, { metadata: { cause } });
  const out: string[] = [];
  if (withdrawn.feeds.length) out.push(t("team.withdrawn.feeds", { count: withdrawn.feeds.length }));
  if (withdrawn.keys.length) out.push(t("team.withdrawn.keys", { count: withdrawn.keys.length }));
  return out;
}

async function ownerCount(orgId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  return row?.n ?? 0;
}

const roleSchema = z.enum(MEMBERSHIP_ROLES);

/** Who may give `to` to a member whose role is `from` (null: a new member). */
function roleChangeProblem(s: StaffSession, from: MembershipRole | null, to: MembershipRole): "ownerOnly" | null {
  if ((to === "owner" || from === "owner") && s.role !== "owner") return "ownerOnly";
  return null;
}

export async function inviteMember(input: { email: string; role: MembershipRole }): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await securityTexts(s);
      await requireStepUp(10, s);
      const email = String(input.email ?? "").trim().toLowerCase();
      if (!z.email().max(254).safeParse(email).success) return fail(t("team.invite.invalidEmail"), "invalid_email");
      const role = roleSchema.safeParse(input.role);
      if (!role.success) return fail(t("errors.generic"), "invalid_role");
      if (roleChangeProblem(s, null, role.data)) return fail(t("team.ownerOnly"), "owner_only");
      const limit = await rateLimit(`invite:${s.org.id}`, 20, 60 * 60_000);
      if (!limit.ok) return fail(t("errors.rateLimited"), "rate_limited");

      const [already] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.orgId, s.org.id)))
        .where(eq(users.email, email));
      if (already) return fail(t("team.invite.alreadyMember"), "already_member");

      // A new invitation to the same address replaces the open one.
      await db
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(authTokens.kind, "invite"), eq(authTokens.orgId, s.org.id), eq(authTokens.email, email), isNull(authTokens.usedAt)));
      const { token, id } = await issueAuthToken({ kind: "invite", email, orgId: s.org.id, role: role.data, createdByUserId: s.user.id });
      const [invitee] = await db.select({ id: users.id, locale: users.locale }).from(users).where(eq(users.email, email));
      const locale = invitee ? staffEmailLocale(invitee, s.org) : staffEmailLocale({ locale: null }, s.org);
      await sendAuthEmail({
        to: email,
        locale,
        kind: "invite",
        vars: { inviter: s.user.name, practice: s.org.name, role: getT(locale, "common")(`roles.${role.data}`) },
        url: absoluteUrl(`/${locale}/invite/${token}`),
      });
      await auditStaff(s, "member.invite", invitee ? { type: "user", id: invitee.id } : undefined, {
        metadata: { role: role.data, inviteId: id.slice(0, 16), existingAccount: Boolean(invitee) },
      });
      return ok(t("team.invite.sent"));
    },
    { permission: "team.manage" },
  );
}

/** Withdraw an open invitation of this practice (its id is the token's hash, never the token). */
export async function withdrawInvite(inviteId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await securityTexts(s);
      const res = await db
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(authTokens.id, String(inviteId)), eq(authTokens.kind, "invite"), eq(authTokens.orgId, s.org.id), isNull(authTokens.usedAt)));
      if (!res.rowsAffected) return fail(t("errors.notFound"), "not_found");
      await auditStaff(s, "member.invite", undefined, { metadata: { inviteId: String(inviteId).slice(0, 16), withdrawn: true } });
      return ok(t("team.invite.withdrawn"));
    },
    { permission: "team.manage" },
  );
}

export async function changeMemberRole(userId: string, role: MembershipRole): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await securityTexts(s);
      const next = roleSchema.safeParse(role);
      if (!next.success) return fail(t("errors.generic"), "invalid_role");
      if (userId === s.user.id) return fail(t("team.notSelf"), "not_self");
      const m = await membership(s.org.id, userId);
      if (!m) return fail(t("team.notMember"), "not_found");
      if (roleChangeProblem(s, m.role, next.data)) return fail(t("team.ownerOnly"), "owner_only");
      await requireStepUp(10, s);
      if (m.role === next.data) return ok(t("team.roleChanged"));
      if (m.role === "owner" && (await ownerCount(s.org.id)) <= 1) return fail(t("team.lastOwner"), "last_owner");
      await db
        .update(memberships)
        .set({ role: next.data })
        .where(and(eq(memberships.orgId, s.org.id), eq(memberships.userId, userId)));
      // A demoted manager keeps nothing they were shown and could no longer issue.
      const withdrawn = await withdrawIssuedAccess(s.org.id, userId, next.data);
      await auditStaff(s, "member.role_change", { type: "membership", id: userId }, {
        metadata: { from: m.role, to: next.data, feedsDisabled: withdrawn.feeds.length, keysRevoked: withdrawn.keys.length },
      });
      return ok([t("team.roleChanged"), ...(await reportWithdrawn(s, withdrawn, "role_changed", t))].join(" "));
    },
    { permission: "team.manage" },
  );
}

/**
 * Remove a member: the membership goes and their sessions in this practice end at once (every
 * session, when this was their only practice). The calendar feeds they generated or that deliver
 * to them, and the API keys they created, stop working.
 */
export async function removeMember(userId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await securityTexts(s);
      if (userId === s.user.id) return fail(t("team.notSelf"), "not_self");
      const m = await membership(s.org.id, userId);
      if (!m) return fail(t("team.notMember"), "not_found");
      if (m.role === "owner" && s.role !== "owner") return fail(t("team.ownerOnly"), "owner_only");
      await requireStepUp(10, s);
      if (m.role === "owner" && (await ownerCount(s.org.id)) <= 1) return fail(t("team.lastOwner"), "last_owner");
      await db.delete(memberships).where(and(eq(memberships.orgId, s.org.id), eq(memberships.userId, userId)));
      // Their other practices are none of this one's business: only the sessions open here end.
      const elsewhere = await memberElsewhere(userId, s.org.id);
      const ended = await revokeUserSessions(userId, elsewhere ? { orgId: s.org.id } : {});
      const withdrawn = await withdrawIssuedAccess(s.org.id, userId, null);
      await auditStaff(s, "member.remove", { type: "membership", id: userId }, {
        metadata: { role: m.role, sessionsEnded: ended, otherPractices: elsewhere, feedsDisabled: withdrawn.feeds.length, keysRevoked: withdrawn.keys.length },
      });
      return ok([t("team.removed"), ...(await reportWithdrawn(s, withdrawn, "member_removed", t))].join(" "));
    },
    { permission: "team.manage" },
  );
}

/**
 * Reset a member's two-step verification (lost phone and recovery codes), after checking who they
 * are in person or by phone. Their sessions end; they set up a new authenticator at next login.
 * Only for people who work for this practice alone: the authenticator protects the account in
 * every practice, so for anyone else (or a platform admin) it is Sorriso support's call.
 */
export async function resetMemberMfa(userId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await securityTexts(s);
      if (userId === s.user.id) return fail(t("team.notSelf"), "not_self");
      const m = await membership(s.org.id, userId);
      if (!m) return fail(t("team.notMember"), "not_found");
      if (m.role === "owner" && s.role !== "owner") return fail(t("team.ownerOnly"), "owner_only");
      if (m.isPlatformAdmin || (await memberElsewhere(userId, s.org.id))) return fail(t("team.mfaResetElsewhere"), "shared_account");
      await requireStepUp(10, s);
      const now = new Date();
      await clearMfa(userId);
      const ended = await revokeUserSessions(userId);
      await auditStaff(s, "session.revoke", { type: "user", id: userId }, { metadata: { cause: "mfa_reset", sessionsEnded: ended } });
      const locale = staffEmailLocale(m, s.org);
      await sendAuthEmail({
        to: m.email,
        name: m.name,
        locale,
        kind: "mfaReset",
        vars: { actor: s.user.name, practice: s.org.name, when: emailWhen(now, locale, s.org.timezone) },
        url: absoluteUrl(`/${locale}/login`),
      });
      return ok(t("team.mfaResetDone"));
    },
    { permission: "team.manage" },
  );
}
