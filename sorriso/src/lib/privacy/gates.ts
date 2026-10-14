import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, memberships, organizations, type LegalDoc, type MembershipRole, type Organization } from "@/db/schema";
import { audit } from "../audit";
import { absoluteUrl } from "../config";
import { logError } from "../log";
import { hasAcceptedCurrent, latestAcceptance } from "./legal";
import { emailOwners, messageDate } from "./requests";
import type { SubprocessorId } from "./subprocessors";
import { LEGAL_VERSIONS } from "./versions";

/**
 * Compliance gates.
 *
 * Dashboard (enforceDashboardGates, called by the dashboard layout, and gatePage, called by page
 * loaders — Next doesn't re-render a shared layout on client-side navigation, so the layout's
 * check alone can be walked past by clicking a sidebar link):
 *  - owners and admins (legal.accept) are sent to /dashboard/legal until the practice has
 *    accepted the DPA (Art. 28(3): processing only under a binding contract) and the terms in
 *    their current versions; the other staff see a banner (ComplianceBanner) instead;
 *  - every member is sent to /dashboard/legal?doc=staff_instructions until they accept the
 *    current staff instructions (Art. 29 and 32(4); Art. 2-quaterdecies Codice privacy).
 *  The layout passes through /dashboard/legal itself (via the proxy's x-pathname header) and the
 *  pages an owner may need before accepting: their own account security and the account closure
 *  with its export.
 *
 * Bookings (canAcceptOnlineBookings, called by the public booking and waitlist routes): a
 * practice takes online bookings only once an owner accepted the DPA, its email is verified
 * (WP6) and it is not closing.
 *
 * Sub-processor changes: owners see a banner and get one email per new list version, with an
 * "Object" mailto (Art. 28(2): prior notice and the right to object, 30 days).
 */

/**
 * Change log of the sub-processor list, newest first. Every change is a new
 * LEGAL_VERSIONS.subprocessors, announced to practices at least 30 days before `effective`
 * (Art. 28(2) and (4)). Labels: legalPractice.subprocessors.change.<type>.
 */
export type SubprocessorChange = {
  version: string;
  /** YYYY-MM-DD the practices were told. */
  announced: string;
  /** YYYY-MM-DD the change applies (announced + 30 days or later, except the first list). */
  effective: string;
  items: { type: "initial" | "added" | "removed" | "changed"; id?: SubprocessorId }[];
};

export const SUBPROCESSOR_CHANGES: readonly SubprocessorChange[] = [
  { version: "2026-10", announced: "2026-10-01", effective: "2026-10-01", items: [{ type: "initial" }] },
];

/**
 * Paths the gate never redirects from (prefixes). The practice-wide export is reachable too: the
 * closure page offers it, and a practice that won't accept a new version must still get its data
 * out (EU Data Act, switching). Since the integration pass the gate also runs on every page and
 * route handler through requireStaff() (src/lib/auth.ts), not only in the layout.
 */
export const GATE_EXEMPT_PATHS = ["/dashboard/legal", "/dashboard/account", "/dashboard/settings/closure", "/dashboard/settings/export"] as const;

/** Documents the practice accepts as a whole (any owner or admin). */
export const ORG_DOCS = ["dpa", "terms"] as const satisfies readonly LegalDoc[];

/**
 * Practices created before the email-verification rollout keep taking bookings until this date
 * while their owners verify (critique 23: no lockout of existing practices).
 */
export const EMAIL_VERIFICATION_ROLLOUT = new Date("2026-10-15T00:00:00Z");
export const EMAIL_VERIFICATION_GRACE_UNTIL = new Date("2027-01-31T23:00:00Z");

const ACCEPTORS: readonly MembershipRole[] = ["owner", "admin"];

export type PendingLegal = {
  /** DPA and terms not accepted in their current version by the practice. */
  org: LegalDoc[];
  /** This member hasn't accepted the current staff instructions. */
  staffInstructions: boolean;
  /** The sub-processor list changed since the practice last accepted it (or never accepted). */
  subprocessors: boolean;
};

type GateSession = { user: { id: string }; org: { id: string }; role: MembershipRole };

export async function pendingLegal(s: GateSession): Promise<PendingLegal> {
  const [orgDocs, [membership], subs] = await Promise.all([
    Promise.all(ORG_DOCS.map(async (d) => ((await hasAcceptedCurrent(s.org.id, d)) ? null : d))),
    db
      .select({ v: memberships.instructionsVersion })
      .from(memberships)
      .where(and(eq(memberships.orgId, s.org.id), eq(memberships.userId, s.user.id))),
    hasAcceptedCurrent(s.org.id, "subprocessors"),
  ]);
  return {
    org: orgDocs.filter((d): d is (typeof ORG_DOCS)[number] => d !== null),
    staffInstructions: membership?.v !== LEGAL_VERSIONS.staff_instructions,
    subprocessors: !subs,
  };
}

/** Where the gate sends this member, or null to let them through. Pure, for tests and the layout. */
export function gateRedirect(path: string, role: MembershipRole, pending: PendingLegal): string | null {
  if (GATE_EXEMPT_PATHS.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))) return null;
  if (ACCEPTORS.includes(role) && pending.org.length) return "/dashboard/legal";
  if (pending.staffInstructions) return "/dashboard/legal?doc=staff_instructions";
  return null;
}

export async function enforceDashboardGates(s: GateSession, pending?: PendingLegal): Promise<void> {
  // Imported here so the retention script (which imports this module) never loads Next internals.
  const { headers } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const path = (await headers()).get("x-pathname");
  // Without the proxy's header we can't tell the legal page from the others: redirecting could
  // loop, so the dashboard stays reachable (online bookings are still gated by canAcceptOnlineBookings).
  if (!path) return;
  const target = gateRedirect(path, s.role, pending ?? (await pendingLegal(s)));
  if (target) redirect(target);
}

/**
 * For page loaders, right after requirePermission(): the same gate as the layout (the proxy sets
 * x-pathname on every request, client-side navigations included), and the compliance banner
 * the page shows (<ComplianceBanner state={…} />).
 */
export async function gatePage(s: GateSession & { org: { id: string; name: string } }): Promise<ComplianceBannerState> {
  const pending = await pendingLegal(s);
  await enforceDashboardGates(s, pending);
  return complianceBannerState(s, pending);
}

/** Why online bookings are paused, empty when they are open. */
export type BookingBlock = "dpa" | "email" | "closing" | "unknown";

export async function bookingBlocks(orgId: string, now: Date = new Date()): Promise<BookingBlock[]> {
  const [org] = await db
    .select({ createdAt: organizations.createdAt, emailVerifiedAt: organizations.emailVerifiedAt, closureRequestedAt: organizations.closureRequestedAt })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  if (!org) return ["unknown"];
  const out: BookingBlock[] = [];
  if (org.closureRequestedAt) out.push("closing");
  const legacy = org.createdAt.getTime() < EMAIL_VERIFICATION_ROLLOUT.getTime() && now.getTime() < EMAIL_VERIFICATION_GRACE_UNTIL.getTime();
  if (!org.emailVerifiedAt && !legacy) out.push("email");
  // Any accepted DPA version keeps bookings open: a new version is a dashboard gate, not an outage.
  if (!(await latestAcceptance(orgId, "dpa"))) out.push("dpa");
  return out;
}

export async function canAcceptOnlineBookings(org: Pick<Organization, "id">): Promise<boolean> {
  return (await bookingBlocks(org.id)).length === 0;
}

// ---------------------------------------------------------------- banner

export type ComplianceBannerState =
  | { kind: "awaiting_owner" }
  | { kind: "subprocessors"; version: string; date: string; objectMailto: string }
  | { kind: "bookings_paused"; reasons: BookingBlock[] }
  | null;

/** Where practices send an objection to a new sub-processor. */
export function objectionMailto(orgName: string, version: string): string {
  const to = process.env.PLATFORM_PRIVACY_EMAIL || process.env.PLATFORM_DPO_EMAIL || "privacy@sorriso.example";
  const subject = encodeURIComponent(`Sub-processor objection — ${orgName} — ${version}`);
  return `mailto:${to}?subject=${subject}`;
}

/**
 * What the dashboard-wide banner should say to this member (one message, the most important):
 * - other staff while the DPA or terms await an owner: the dashboard is usable, online booking is paused;
 * - owners and admins when the sub-processor list changed: review, accept or object;
 * - owners and admins when online booking is paused for another reason (email, closing).
 */
export async function complianceBannerState(s: GateSession & { org: { id: string; name: string } }, known?: PendingLegal): Promise<ComplianceBannerState> {
  const pending = known ?? (await pendingLegal(s));
  const acceptor = ACCEPTORS.includes(s.role);
  if (pending.org.length && !acceptor) return { kind: "awaiting_owner" };
  if (acceptor && pending.subprocessors && !pending.org.length) {
    const change = SUBPROCESSOR_CHANGES[0];
    return {
      kind: "subprocessors",
      version: LEGAL_VERSIONS.subprocessors,
      date: change?.effective ?? LEGAL_VERSIONS.subprocessors,
      objectMailto: objectionMailto(s.org.name, LEGAL_VERSIONS.subprocessors),
    };
  }
  if (acceptor) {
    const blocks = (await bookingBlocks(s.org.id)).filter((b) => b !== "dpa");
    if (blocks.length) return { kind: "bookings_paused", reasons: blocks };
  }
  return null;
}

// ---------------------------------------------------------------- sub-processor change notices

/** Has this practice already been emailed about this sub-processor list version? */
async function notifiedOf(orgId: string, version: string): Promise<boolean> {
  const [row] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, orgId),
        eq(auditLog.action, "settings.update"),
        sql`json_extract(${auditLog.metadata}, '$.event') = 'subprocessors.notified'`,
        sql`json_extract(${auditLog.metadata}, '$.version') = ${version}`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Email the owners of every practice that accepted an older sub-processor list, once per version
 * (run daily by the retention job). Practices that never accepted any list see it at first
 * acceptance instead. The notice is recorded in the practice's audit chain (until a dedicated
 * audit action exists: settings.update with event subprocessors.notified).
 */
export async function notifySubprocessorChanges(now: Date = new Date()): Promise<number> {
  const version = LEGAL_VERSIONS.subprocessors;
  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(isNull(organizations.closureRequestedAt));
  let notified = 0;
  for (const org of orgs) {
    try {
      const last = await latestAcceptance(org.id, "subprocessors");
      if (!last || last.version === version || (await notifiedOf(org.id, version))) continue;
      const change = SUBPROCESSOR_CHANGES.find((c) => c.version === version);
      await emailOwners(
        org.id,
        "subprocessorsChanged",
        (locale) => ({
          version,
          effective: messageDate(change ? new Date(`${change.effective}T12:00:00Z`) : now, locale),
          email: process.env.PLATFORM_PRIVACY_EMAIL || process.env.PLATFORM_DPO_EMAIL || "privacy@sorriso.example",
        }),
        { url: absoluteUrl("/dashboard/legal?doc=subprocessors") },
      );
      await audit({
        orgId: org.id,
        actor: { type: "system", id: null },
        action: "settings.update",
        entity: { type: "org", id: org.id },
        metadata: { event: "subprocessors.notified", version },
        at: now,
      });
      notified++;
    } catch (err) {
      logError("gates", err, { step: "subprocessor-notice", orgId: org.id });
    }
  }
  return notified;
}

// ---------------------------------------------------------------- step-up

/**
 * Was this error requireStepUp() asking for a fresh second factor? WP6's requireStepUp throws an
 * error with code "step_up_required" (or redirects, which callers let propagate).
 */
export function isStepUpRequired(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: unknown }).code === "step_up_required");
}

/**
 * The re-authentication page a requireStepUp() redirect points to, or null for any other error.
 * In GET route handlers WP6's requireStepUp() redirects (Next's NEXT_REDIRECT error, whose digest
 * carries the target) instead of throwing step_up_required; downloads fetched by script turn that
 * into a 403 JSON answer they can act on.
 */
export function stepUpRedirect(err: unknown): string | null {
  const digest = err && typeof err === "object" ? (err as { digest?: unknown }).digest : null;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) return null;
  const target = digest.split(";").find((part) => part.startsWith("/"));
  return target && /^\/dashboard\/account\/security\/verify(\?|$)/.test(target) ? target : null;
}

/** A browser navigation (shows HTML) rather than a script asking for a file or JSON. */
export function wantsHtml(req: Request): boolean {
  return (req.headers.get("accept") ?? "").includes("text/html");
}
