"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { MEMBERSHIP_ROLES, type MembershipRole } from "@/db/enums";
import { authTokens, memberships, practitioners, users } from "@/db/schema";
import { getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import { requireStepUp, revokeUserSessions, type StaffSession } from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { emailWhen, sendAuthEmail, staffEmailLocale } from "@/lib/security/emails";
import { clearMfa } from "@/lib/security/mfa";
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
 */


async function membership(orgId: string, userId: string) {
  const [m] = await db
    .select({ role: memberships.role, name: users.name, email: users.email, locale: users.locale })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  return m ?? null;
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
      await auditStaff(s, "member.role_change", { type: "membership", id: userId }, { metadata: { from: m.role, to: next.data } });
      return ok(t("team.roleChanged"));
    },
    { permission: "team.manage" },
  );
}

/**
 * Remove a member: the membership goes, every session of theirs ends at once, and the calendar
 * feed of a practitioner profile linked to them is turned off.
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
      const ended = await revokeUserSessions(userId);
      // Calendar feeds of their practitioner profile would keep sending this practice's agenda to
      // the person's own calendar: turn them off.
      const feeds = await db
        .update(practitioners)
        .set({ icsEnabled: false, icsTokenHash: null, icsTokenExpiresAt: null })
        .where(and(eq(practitioners.orgId, s.org.id), eq(practitioners.userId, userId), eq(practitioners.icsEnabled, true)));
      await auditStaff(s, "member.remove", { type: "membership", id: userId }, {
        metadata: { role: m.role, sessionsEnded: ended, feedsDisabled: feeds.rowsAffected },
      });
      return ok(t("team.removed"));
    },
    { permission: "team.manage" },
  );
}

/**
 * Reset a member's two-step verification (lost phone and recovery codes), after checking who they
 * are in person or by phone. Their sessions end; they set up a new authenticator at next login.
 */
export async function resetMemberMfa(userId: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await securityTexts(s);
      if (userId === s.user.id) return fail(t("team.notSelf"), "not_self");
      const m = await membership(s.org.id, userId);
      if (!m) return fail(t("team.notMember"), "not_found");
      if (m.role === "owner" && s.role !== "owner") return fail(t("team.ownerOnly"), "owner_only");
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
