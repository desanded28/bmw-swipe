"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { LEGAL_SPECIALIZATIONS, SPOKEN_LANGUAGES, type LegalSpecialization, type SpokenLanguage } from "@/db/enums";
import { practitionerServices, practitioners, services, type Practitioner, type PractitionerCareOptions } from "@/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { auditStaff } from "@/lib/audit";
import type { StaffSession } from "@/lib/auth";
import { blockedWords, checkAdvertisingFields } from "@/lib/compliance/advertising";
import { isReservedSlug } from "@/lib/directory";
import { newId, slugify } from "@/lib/ids";
import { fail, guard, ok, optional, str, type ActionResult } from "./_shared";

/**
 * Practitioner records, their treatments and their public marketplace profile (WP7).
 *
 * - Managers (team.manage) edit the record and the profile fields.
 * - The public profile is listed only once approved by the practitioner (their own account) or
 *   the practice owner; a change to what patients see, made by anyone else, needs approval again.
 * - Changing the Albo registration or the legal specialisations needs Sorriso's check again.
 * - Only the practitioner can remove themselves from the marketplace, and only they can undo it.
 */

/** The staff member's language. Outside a request (tests, scripts) the default: never fails the action. */
async function staffLocale(): Promise<Locale> {
  try {
    return await getStaffLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

const CARE_KEYS = ["children", "anxiousPatients", "sedation", "specialNeeds"] as const satisfies readonly (keyof PractitionerCareOptions)[];
/** Albo provinces are names or two-letter codes ("Milano", "MI"); numbers are short alphanumerics. */
const PROVINCE = /^[\p{L}' .-]{2,40}$/u;
const ALBO_NUMBER = /^[A-Za-z0-9/-]{1,20}$/;

/** May this staff member approve this practitioner's public profile? The owner, or the practitioner themselves. */
function canApprove(s: StaffSession, p: Pick<Practitioner, "userId">): boolean {
  return s.role === "owner" || (p.userId !== null && p.userId === s.user.id);
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Create (id null, then redirects to the new profile) or update a practitioner, their treatments and public profile. */
export async function savePractitioner(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = getT(await staffLocale(), "marketplace");
      const name = str(fd, "name");
      if (!name) return fail(t("profile.nameRequired"));
      const spokenLanguages = [...new Set(fd.getAll("spokenLanguages").map(String))].filter((l): l is SpokenLanguage =>
        (SPOKEN_LANGUAGES as readonly string[]).includes(l),
      );
      const specializations = [...new Set(fd.getAll("specializations").map(String))].filter((l): l is LegalSpecialization =>
        (LEGAL_SPECIALIZATIONS as readonly string[]).includes(l),
      );
      const careOptions = Object.fromEntries(CARE_KEYS.map((k) => [k, fd.get(`care.${k}`) === "on"])) as PractitionerCareOptions;
      const alboProvince = optional(fd, "alboProvince");
      const alboNumber = optional(fd, "alboNumber");
      const values = {
        title: str(fd, "title").slice(0, 20),
        name: name.slice(0, 120),
        // Practice-written "areas of interest"; empty is fine: pages show a translated default.
        specialty: str(fd, "specialty").slice(0, 120),
        bio: optional(fd, "bio")?.slice(0, 2000) ?? null,
        // Deprecated free text, kept in step for old readers; spokenLanguages is what counts.
        languages: spokenLanguages.join(", ") || "it",
        spokenLanguages,
        specializations,
        careOptions,
        alboProvince: alboProvince && PROVINCE.test(alboProvince) ? alboProvince : null,
        alboNumber: alboNumber && ALBO_NUMBER.test(alboNumber) ? alboNumber : null,
        color: /^#[0-9a-f]{6}$/i.test(str(fd, "color")) ? str(fd, "color") : "#0d9488",
        licenseNumber: optional(fd, "licenseNumber")?.slice(0, 40) ?? null,
        acceptsNewPatients: fd.get("acceptsNewPatients") === "on",
        active: fd.get("active") === "on",
        publicProfile: fd.get("publicProfile") === "on",
      };

      // Health advertising rules (L. 145/2018 c. 525): promotional wording blocks the save.
      const ads = checkAdvertisingFields({ title: values.title, specialty: values.specialty, bio: values.bio });
      if (ads.verdict === "block") return fail(t("profile.advertisingBlocked", { words: blockedWords(ads.byField) }), "advertising");

      const serviceIds = fd.getAll("serviceIds").map(String);
      const orgServices = await db.select({ id: services.id }).from(services).where(eq(services.orgId, s.org.id));
      const valid = serviceIds.filter((sid) => orgServices.some((o) => o.id === sid));

      let practitionerId = id;
      let needsApproval = false;
      if (id) {
        const [current] = await db.select().from(practitioners).where(and(eq(practitioners.id, id), eq(practitioners.orgId, s.org.id)));
        if (!current) return fail(t("profile.notFound"), "not_found");
        const publicChanged =
          current.title !== values.title ||
          current.name !== values.name ||
          current.specialty !== values.specialty ||
          (current.bio ?? null) !== values.bio ||
          !sameList(current.spokenLanguages ?? [], values.spokenLanguages) ||
          !sameList(current.specializations ?? [], values.specializations) ||
          CARE_KEYS.some((k) => Boolean(current.careOptions?.[k]) !== Boolean(values.careOptions[k]));
        const alboChanged =
          (current.alboProvince ?? null) !== values.alboProvince ||
          (current.alboNumber ?? null) !== values.alboNumber ||
          !sameList(current.specializations ?? [], values.specializations);
        const approval =
          publicChanged && current.profileApprovedAt
            ? canApprove(s, current)
              ? { profileApprovedAt: new Date(), profileApprovedByUserId: s.user.id }
              : { profileApprovedAt: null, profileApprovedByUserId: null }
            : {};
        needsApproval = publicChanged && Boolean(current.profileApprovedAt) && !canApprove(s, current);
        await db
          .update(practitioners)
          .set({ ...values, ...approval, ...(alboChanged ? { alboVerifiedAt: null, alboVerifiedByUserId: null } : {}) })
          .where(and(eq(practitioners.id, id), eq(practitioners.orgId, s.org.id)));
        if (approval.profileApprovedAt !== undefined) {
          await auditStaff(s, "practitioner.profile.approve", { type: "practitioner", id }, { metadata: { approved: approval.profileApprovedAt !== null, via: "edit" } });
        }
        // The badge disappears until Sorriso checks the new registration: say why on the chain.
        if (alboChanged && current.alboVerifiedAt) {
          await auditStaff(s, "practitioner.albo.verify", { type: "practitioner", id }, { metadata: { verified: false, via: "edit" } });
        }
      } else {
        practitionerId = newId();
        let slug = slugify(name) || practitionerId.toLowerCase();
        const [taken] = await db
          .select({ id: practitioners.id })
          .from(practitioners)
          .where(and(eq(practitioners.orgId, s.org.id), eq(practitioners.slug, slug)));
        // Reserved slugs would be shadowed by static routes under /c/<org>/ (e.g. /privacy).
        if (taken || isReservedSlug(slug)) slug = `${slug}-${newId(4).toLowerCase()}`;
        // No feed secret at creation: the column keeps a non-secret placeholder (a plaintext token here
        // would be turned into a live feed by the next db:migrate backfill). Feeds are issued by rotateIcsToken.
        await db.insert(practitioners).values({ id: practitionerId, orgId: s.org.id, slug, icsToken: `h:${practitionerId}`, ...values });
      }
      await db.transaction(async (tx) => {
        await tx.delete(practitionerServices).where(eq(practitionerServices.practitionerId, practitionerId!));
        if (valid.length)
          await tx.insert(practitionerServices).values(valid.map((serviceId) => ({ practitionerId: practitionerId!, serviceId })));
      });
      if (!id) redirect(`/dashboard/team/${practitionerId}?created=1`);
      if (needsApproval) return ok(t("profile.savedNeedsApproval"));
      return ok(ads.verdict === "warn" ? t("profile.savedWithWarnings") : t("profile.saved"));
    },
    { permission: "team.manage" },
  );
}

async function ownPractitioner(s: StaffSession, id: string) {
  const [p] = await db.select().from(practitioners).where(and(eq(practitioners.id, id), eq(practitioners.orgId, s.org.id)));
  return p ?? null;
}

/**
 * Approve the public profile as shown in the preview: lists it on the marketplace (unless the
 * practitioner opted out). Only the practitioner (their own linked account) or the practice owner.
 */
export async function approvePublicProfile(id: string): Promise<ActionResult> {
  return guard(async (s) => {
    const t = getT(await staffLocale(), "marketplace");
    const p = await ownPractitioner(s, id);
    if (!p) return fail(t("profile.notFound"), "not_found");
    if (!canApprove(s, p)) return fail(t("profile.approval.notAllowed"), "forbidden");
    await db
      .update(practitioners)
      .set({ publicProfile: true, profileApprovedAt: new Date(), profileApprovedByUserId: s.user.id })
      .where(and(eq(practitioners.id, id), eq(practitioners.orgId, s.org.id)));
    await auditStaff(s, "practitioner.profile.approve", { type: "practitioner", id }, { metadata: { approved: true, self: p.userId === s.user.id } });
    return ok(t("profile.approval.approved"));
  });
}

/** Withdraw the approval: the profile leaves the marketplace until approved again. */
export async function revokeProfileApproval(id: string): Promise<ActionResult> {
  return guard(async (s) => {
    const t = getT(await staffLocale(), "marketplace");
    const p = await ownPractitioner(s, id);
    if (!p) return fail(t("profile.notFound"), "not_found");
    if (!canApprove(s, p)) return fail(t("profile.approval.notAllowed"), "forbidden");
    await db
      .update(practitioners)
      .set({ profileApprovedAt: null, profileApprovedByUserId: null })
      .where(and(eq(practitioners.id, id), eq(practitioners.orgId, s.org.id)));
    await auditStaff(s, "practitioner.profile.approve", { type: "practitioner", id }, { metadata: { approved: false } });
    return ok(t("profile.approval.revoked"));
  });
}

/**
 * "Remove me from the marketplace": only the practitioner, from their own account. The owner
 * can't override it. Listing again needs a fresh approval.
 */
export async function setMarketplaceOptOut(id: string, optOut: boolean): Promise<ActionResult> {
  return guard(async (s) => {
    const t = getT(await staffLocale(), "marketplace");
    const p = await ownPractitioner(s, id);
    if (!p) return fail(t("profile.notFound"), "not_found");
    if (p.userId === null || p.userId !== s.user.id) return fail(t("profile.optOut.notAllowed"), "forbidden");
    await db
      .update(practitioners)
      .set(optOut ? { marketplaceOptOutAt: new Date(), profileApprovedAt: null, profileApprovedByUserId: null } : { marketplaceOptOutAt: null })
      .where(and(eq(practitioners.id, id), eq(practitioners.orgId, s.org.id)));
    // Opting out also withdraws the approval (cleared above); rejoining needs a fresh one.
    await auditStaff(s, "practitioner.marketplace.opt_out", { type: "practitioner", id }, { metadata: { optedOut: optOut } });
    return ok(optOut ? t("profile.optOut.done") : t("profile.optOut.undone"));
  });
}
