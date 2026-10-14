import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  appointments,
  locations,
  memberships,
  orgFunds,
  patients,
  practitioners,
  profileStats,
  reviewReports,
  reviews,
  services,
  type FundMode,
  type LegalSpecialization,
  type LocationAccessibility,
  type PractitionerCareOptions,
  type SpokenLanguage,
} from "../../src/db/schema";
import { reviewFlags } from "../../src/lib/health-terms";
import { newId } from "../../src/lib/ids";
import { recordConsent } from "../../src/lib/privacy/consent";
import { heldCommentValue, PSEUDONYM_AUTHOR_NAME, reportDetailsValue } from "../../src/lib/reviews";
import { addDays, todayIn } from "../../src/lib/time";
import type { SeedContext } from "../seed";

/**
 * Marketplace demo data (WP7), run by scripts/seed.ts after the core seed:
 * - each practice's org_funds (the funds themselves, FISDE, Casagit and Allianz included, come
 *   from the migrations: 0001 and 0003_integration);
 * - public profiles: spoken languages, care options, Albo registrations (some verified, some
 *   waiting in /dashboard/platform/practitioners), legal specialisations; one practitioner who
 *   removed themselves from the marketplace and one whose approval is pending;
 * - price types (starting price with a range, quote after a visit) and office accessibility;
 * - reviews held by the health-term check, a review reported by the practice and a notice from
 *   the public, for /dashboard/platform/reviews; their publication consents in the ledger;
 * - two weeks of profile statistics.
 * Deterministic: everything is picked by position, never at random.
 */

const TZ = "Europe/Rome";

/** Per practice (in seed order): the funds it works with. */
const ORG_FUNDS: { fundId: string; mode: FundMode; firstServices?: number }[][] = [
  [
    { fundId: "fund_fasi", mode: "direct" },
    { fundId: "fund_unisalute", mode: "indirect", firstServices: 3 },
    { fundId: "fund_metasalute", mode: "indirect" },
  ],
  [{ fundId: "fund_unisalute", mode: "direct" }, { fundId: "fund_allianz", mode: "indirect" }],
  [{ fundId: "fund_fasdac", mode: "indirect" }, { fundId: "fund_previmedical", mode: "direct" }],
  [{ fundId: "fund_fondoest", mode: "indirect" }],
  [{ fundId: "fund_rbm", mode: "direct" }, { fundId: "fund_casagit", mode: "indirect" }],
  [],
];

type ProfileSeed = {
  spokenLanguages: SpokenLanguage[];
  careOptions: PractitionerCareOptions;
  albo?: { province: string; number: string; verified: boolean; specializations?: LegalSpecialization[] };
  optedOut?: boolean;
  pendingApproval?: boolean;
};

/** Per practice, per practitioner (seed order). Hygienists are not on the Albo degli Odontoiatri. */
const PROFILES: ProfileSeed[][] = [
  [
    { spokenLanguages: ["it", "en", "de"], careOptions: { anxiousPatients: true, sedation: true }, albo: { province: "Milano", number: "MI-5821", verified: true } },
    {
      spokenLanguages: ["it", "en", "fr"],
      careOptions: { children: true },
      albo: { province: "Milano", number: "MI-7710", verified: true, specializations: ["orthodontics"] },
    },
    { spokenLanguages: ["it", "en", "ro"], careOptions: { anxiousPatients: true, specialNeeds: true } },
    { spokenLanguages: ["it", "es"], careOptions: {}, albo: { province: "Milano", number: "MI-6402", verified: false } },
  ],
  [
    { spokenLanguages: ["it", "en", "pl"], careOptions: { anxiousPatients: true }, albo: { province: "Roma", number: "RM-11873", verified: true } },
    {
      spokenLanguages: ["it", "en", "pt"],
      careOptions: { children: true, anxiousPatients: true, specialNeeds: true },
      albo: { province: "Roma", number: "RM-14090", verified: false, specializations: ["pediatric_dentistry"] },
    },
    { spokenLanguages: ["it"], careOptions: {}, pendingApproval: true },
  ],
  [
    {
      spokenLanguages: ["it", "de"],
      careOptions: { sedation: true, anxiousPatients: true },
      albo: { province: "Torino", number: "TO-3388", verified: true, specializations: ["oral_surgery"] },
    },
    { spokenLanguages: ["it", "en", "fr"], careOptions: {}, albo: { province: "Torino", number: "TO-4105", verified: true, specializations: ["orthodontics"] } },
  ],
  [{ spokenLanguages: ["it", "en"], careOptions: { children: true }, albo: { province: "Bologna", number: "BO-2290", verified: true } }],
  [
    { spokenLanguages: ["it", "en", "ro"], careOptions: {}, albo: { province: "Firenze", number: "FI-1764", verified: true } },
    { spokenLanguages: ["it", "en", "de"], careOptions: { sedation: true }, albo: { province: "Firenze", number: "FI-2851", verified: false } },
  ],
  [
    { spokenLanguages: ["it", "en", "es"], careOptions: { children: true }, albo: { province: "Napoli", number: "NA-9031", verified: true } },
    { spokenLanguages: ["it"], careOptions: { children: true }, optedOut: true },
  ],
];

/** Per practice, per office (seed order). */
const ACCESSIBILITY: LocationAccessibility[][] = [
  [
    { stepFree: true, lift: true, accessibleWc: true, hearingLoop: true, wheelchairTransferChair: true, transit: "Metro M1/M3 Duomo, 5 minuti a piedi" },
    { stepFree: false, lift: false, disabledParking: true, transit: "Stazione di Monza, 10 minuti a piedi" },
  ],
  [{ stepFree: true, lift: true, accessibleWc: true, disabledParking: false, transit: "Metro A Ottaviano, 4 minuti a piedi" }],
  [{ stepFree: true, lift: true, disabledParking: true, transit: "Tram 9 e 16, fermata Re Umberto" }],
  [{ stepFree: false, lift: true, transit: "Bus 13 e 96, fermata Piazza Maggiore" }],
  [{ stepFree: true, accessibleWc: true, transit: "Tramvia T1, fermata Unità" }, { stepFree: true, disabledParking: true }],
  [{ stepFree: true, lift: true, transit: "Metro 1 Toledo, poi bus C24" }],
];

const HELD_COMMENTS = [
  "Mi è saltato l'impianto dopo due mesi, ma mi hanno seguito con attenzione.",
  "Per qualsiasi domanda chiamatemi al 333 123 4567, vi racconto la mia esperienza.",
];

export async function seedMarketplace(ctx: SeedContext): Promise<void> {
  const { db, now } = ctx;
  for (const [orgIndex, orgId] of ctx.orgIds.entries()) {
    const svcIds = ctx.serviceIds[orgId] ?? [];
    // Health funds as the practice declares them.
    const declared = ORG_FUNDS[orgIndex] ?? [];
    if (declared.length) {
      await db
        .insert(orgFunds)
        .values(declared.map((f) => ({ orgId, fundId: f.fundId, mode: f.mode, serviceIds: f.firstServices ? svcIds.slice(0, f.firstServices) : null })))
        .onConflictDoNothing();
    }

    // Public profiles.
    for (const [i, practitionerId] of (ctx.practitionerIds[orgId] ?? []).entries()) {
      const prof = PROFILES[orgIndex]?.[i];
      if (!prof) continue;
      await db
        .update(practitioners)
        .set({
          spokenLanguages: prof.spokenLanguages,
          languages: prof.spokenLanguages.join(", "),
          careOptions: prof.careOptions,
          alboProvince: prof.albo?.province ?? null,
          alboNumber: prof.albo?.number ?? null,
          alboVerifiedAt: prof.albo?.verified ? addDaysTo(now, -30) : null,
          specializations: prof.albo?.specializations ?? [],
          ...(prof.pendingApproval ? { profileApprovedAt: null, profileApprovedByUserId: null } : {}),
          ...(prof.optedOut ? { marketplaceOptOutAt: addDaysTo(now, -3), profileApprovedAt: null } : {}),
        })
        .where(eq(practitioners.id, practitionerId));
    }

    // Offices: accessibility and directions.
    for (const [i, locationId] of (ctx.locationIds[orgId] ?? []).entries()) {
      const a = ACCESSIBILITY[orgIndex]?.[i];
      if (a) await db.update(locations).set({ accessibility: a }).where(eq(locations.id, locationId));
    }

    // Price types: consultations priced after an assessment; whitening as a range.
    const svcs = svcIds.length ? await db.select().from(services).where(inArray(services.id, svcIds)) : [];
    for (const s of svcs) {
      if (s.category === "implants" && s.priceCents == null) await db.update(services).set({ priceType: "quote" }).where(eq(services.id, s.id));
      if (s.category === "aesthetic" && s.priceCents != null) {
        await db
          .update(services)
          .set({ priceType: "from", priceMaxCents: s.priceCents * 2, priceIncludes: "Visita di controllo dopo 14 giorni" })
          .where(eq(services.id, s.id));
      }
    }

    // Profile statistics: two weeks of daily counters.
    const today = todayIn(TZ, now);
    const statRows = (ctx.practitionerIds[orgId] ?? []).flatMap((practitionerId, i) =>
      Array.from({ length: 14 }, (_, d) => ({
        practitionerId,
        day: addDays(today, -d),
        views: 3 + ((i * 7 + d * 3 + orgIndex) % 11),
        searchImpressions: 20 + ((i * 13 + d * 5 + orgIndex * 3) % 37),
      })),
    );
    if (statRows.length) await db.insert(profileStats).values(statRows).onConflictDoNothing();
  }

  await seedModeration(ctx);
}

const addDaysTo = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

/**
 * For the moderation queue (flagship practice): two reviews held by the health-term check, one
 * reported by the practice and one notice from the public.
 */
async function seedModeration(ctx: SeedContext) {
  const { db, now } = ctx;
  const orgId = ctx.orgIds[0];
  if (!orgId) return;
  const unreviewed = await db
    .select({ a: appointments, p: patients })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(reviews, eq(reviews.appointmentId, appointments.id))
    .where(and(eq(appointments.orgId, orgId), eq(appointments.status, "completed"), isNull(reviews.id)))
    .orderBy(asc(appointments.startsAt))
    .limit(HELD_COMMENTS.length);

  for (const [i, { a, p }] of unreviewed.entries()) {
    const comment = HELD_COMMENTS[i];
    const id = newId();
    const createdAt = new Date(a.endsAt.getTime() + 6 * 3_600_000);
    await db.transaction(async (tx) => {
      await tx.insert(reviews).values({
        id,
        orgId,
        practitionerId: a.practitionerId,
        appointmentId: a.id,
        rating: i === 0 ? 3 : 5,
        comment: heldCommentValue(comment),
        authorName: PSEUDONYM_AUTHOR_NAME,
        authorDisplay: "pseudonym",
        locale: p.locale,
        flags: reviewFlags(comment),
        status: "under_review",
        published: false,
        createdAt,
      });
      const consentId = await recordConsent(tx, {
        orgId,
        patientId: p.id,
        purpose: "review_publication",
        granted: true,
        locale: p.locale,
        method: "web_checkbox",
        source: "review",
        appointmentId: a.id,
        now: createdAt,
      });
      await tx.update(reviews).set({ consentId }).where(eq(reviews.id, id));
    });
  }

  // Reports: the two oldest published reviews of the flagship practice.
  const published = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.orgId, orgId), eq(reviews.status, "published")))
    .orderBy(asc(reviews.createdAt))
    .limit(2);
  const [owner] = await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  if (published[0] && owner) {
    await db.insert(reviewReports).values({
      id: newId(),
      reviewId: published[0].id,
      orgId,
      reporterUserId: owner.userId,
      ground: "not_about_visit",
      details: reportDetailsValue("Non risulta una visita con questo professionista nella data indicata."),
      status: "open",
      createdAt: addDaysTo(now, -2),
    });
    await db.update(reviews).set({ status: "under_review", published: false }).where(eq(reviews.id, published[0].id));
  }
  if (published[1]) {
    await db.insert(reviewReports).values({
      id: newId(),
      reviewId: published[1].id,
      orgId,
      reporterUserId: null,
      reporterContactHash: "demo-notice",
      ground: "offensive",
      details: reportDetailsValue("Linguaggio offensivo verso il personale."),
      status: "open",
      createdAt: addDaysTo(now, -1),
    });
  }
}
