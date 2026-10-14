import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { appointments, organizations, patients, profileStats, recalls, reminders, reviews, waitlist } from "@/db/schema";
import { getT } from "@/i18n/t";
import { createPractice, TZ } from "@/test/fixtures";
import type { StaffSession } from "./auth";
import { newId } from "./ids";
import type { RankInput } from "./ranking";
import { addDays, todayIn, zonedToUtc } from "./time";

/**
 * Analytics on a fixture with known values. Times are relative to the real clock, so the page,
 * the CSV route and loadAnalytics() all see the same window.
 */

const state = vi.hoisted(() => ({ session: null as unknown, rankInput: null as unknown, analytics: null as unknown }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("./auth")>();
  return {
    ...original,
    requireStaff: async () => {
      if (!state.session) throw new Error("no session in test");
      return state.session as StaffSession;
    },
    getSession: async () => state.session,
  };
});
// Ranking inputs come from WP7's buildRankInputs (availability search included); a fixed input
// keeps this test about what analytics does with it: scoring it with scoreResult().
vi.mock("@/lib/ranking", async (importOriginal) => {
  const original = await importOriginal<typeof import("./ranking")>();
  return { ...original, buildRankInputs: async () => (state.rankInput ? [state.rankInput as RankInput] : []) };
});

// The page test below swaps in figures the fixture can't reach (thousands, a fractional median).
vi.mock("@/lib/analytics", async (importOriginal) => {
  const original = await importOriginal<typeof import("./analytics")>();
  return {
    ...original,
    loadAnalytics: (...args: Parameters<typeof original.loadAnalytics>) =>
      state.analytics ? Promise.resolve(state.analytics as Awaited<ReturnType<typeof original.loadAnalytics>>) : original.loadAnalytics(...args),
  };
});

const { analyticsCsv, loadAnalytics } = await import("./analytics");
const { scoreResult } = await import("./ranking");

let p: Awaited<ReturnType<typeof createPractice>>;
let other: Awaited<ReturnType<typeof createPractice>>;
let org: typeof organizations.$inferSelect;
const today = todayIn(TZ);
const HOUR = 3_600_000;

async function signIn(role: MembershipRole, locale: "en" | "de" = "en") {
  state.session = {
    sessionId: "s1",
    user: { id: `user-${role}`, name: "Test", email: "t@example.org", isPlatformAdmin: false, locale },
    org,
    role,
    orgs: [{ org, role }],
    auth: { mfaVerifiedAt: null },
  };
}

let patientId: string;
async function appt(over: Partial<typeof appointments.$inferInsert> & { startsAt: Date }, practice = p, pid = patientId) {
  const id = newId();
  await db.insert(appointments).values({
    id,
    orgId: practice.orgId,
    locationId: practice.milano,
    practitionerId: practice.drA,
    serviceId: practice.visit,
    patientId: pid,
    endsAt: new Date(over.startsAt.getTime() + 30 * 60_000),
    blockedUntil: new Date(over.startsAt.getTime() + 30 * 60_000),
    source: "online",
    manageToken: `h:${id}`,
    createdAt: new Date(over.startsAt.getTime() - 3 * 24 * HOUR),
    ...over,
  });
  return id;
}

async function reminder(appointmentId: string, channel: "sms" | "email", sentAt: Date) {
  await db.insert(reminders).values({
    id: newId(),
    appointmentId,
    kind: "reminder",
    channel,
    askConfirmation: true,
    sendAt: sentAt,
    sentAt,
    status: "sent",
  });
}

beforeAll(async () => {
  p = await createPractice();
  other = await createPractice();
  [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
  patientId = newId();
  const otherPatient = newId();
  await db.insert(patients).values([
    { id: patientId, orgId: p.orgId, firstName: "Ada", lastName: "Fixture", phone: "+393330001111" },
    { id: otherPatient, orgId: other.orgId, firstName: "Bea", lastName: "Other", phone: "+393330002222" },
  ]);

  // ---- outcomes: visit 6 completed + 2 no-shows (Monday-ish mornings), cleaning 1 + 1 (evenings)
  const morning = (daysAgo: number) => zonedToUtc(addDays(today, -daysAgo), 10 * 60, TZ);
  const evening = (daysAgo: number) => zonedToUtc(addDays(today, -daysAgo), 18 * 60 + 30, TZ);
  for (let i = 0; i < 6; i++) await appt({ startsAt: morning(10 + i), status: "completed" });
  for (let i = 0; i < 2; i++) await appt({ startsAt: morning(20 + i), status: "no_show" });
  await appt({ startsAt: evening(30), status: "completed", serviceId: p.cleaning });
  await appt({ startsAt: evening(31), status: "no_show", serviceId: p.cleaning });
  // One late cancellation by the patient (2 hours before; the default deadline is 24 hours)...
  const late = morning(40);
  await appt({ startsAt: late, status: "cancelled", cancelledBy: "patient", cancelledAt: new Date(late.getTime() - 2 * HOUR) });
  // ...and what doesn't count: an early cancellation, one by the practice, one outside the window,
  // another practice's no-shows.
  const early = morning(41);
  await appt({ startsAt: early, status: "cancelled", cancelledBy: "patient", cancelledAt: new Date(early.getTime() - 72 * HOUR) });
  await appt({ startsAt: morning(42), status: "cancelled", cancelledBy: "staff", cancelledAt: new Date() });
  await appt({ startsAt: morning(800), status: "no_show" });
  await appt({ startsAt: morning(12), status: "no_show" }, other, otherPatient);

  // ---- confirmations: upcoming visits, reminders already sent
  const start = new Date(Date.now() + 20 * HOUR);
  const sms = new Date(start.getTime() - 24 * HOUR);
  const email = new Date(start.getTime() - 48 * HOUR);
  const visit = (confirmedAt: Date | null, via: string | null) =>
    appt({ startsAt: start, status: "scheduled", confirmation: confirmedAt ? "confirmed" : "pending", confirmedAt, confirmedVia: via });
  const c1 = await visit(new Date(sms.getTime() + HOUR), "sms");
  await reminder(c1, "sms", sms);
  const c2 = await visit(new Date(sms.getTime() + 4 * HOUR), "sms"); // ignored the email, answered the SMS
  await reminder(c2, "email", email);
  await reminder(c2, "sms", sms);
  const c3 = await visit(null, null);
  await reminder(c3, "sms", sms);
  const c4 = await visit(new Date(email.getTime() + 8 * HOUR), "web");
  await reminder(c4, "email", email);
  const c5 = await visit(new Date(sms.getTime() + HOUR), "staff"); // the front desk's doing
  await reminder(c5, "sms", sms);
  const c6 = await visit(null, null);
  await reminder(c6, "email", email);

  // ---- waitlist: 2 booked, 1 removed, 1 expired, 1 still waiting
  const entry = (status: "active" | "booked" | "removed", latestDate: string) => ({
    id: newId(),
    orgId: p.orgId,
    patientId,
    serviceId: p.visit,
    earliestDate: addDays(today, -20),
    latestDate,
    status,
  });
  await db.insert(waitlist).values([
    entry("booked", addDays(today, -10)),
    entry("booked", addDays(today, -5)),
    entry("removed", addDays(today, -5)),
    entry("active", addDays(today, -1)),
    entry("active", addDays(today, 10)),
  ]);

  // ---- recalls due in the window: 4 contacted (1 booked), 1 booked without a reminder, 1 not contacted
  const recall = (attempts: number, status: "due" | "sent" | "booked") => ({
    id: newId(),
    orgId: p.orgId,
    patientId,
    serviceId: p.visit,
    dueDate: addDays(today, -30),
    intervalMonths: 6,
    attempts,
    status,
  });
  await db.insert(recalls).values([recall(1, "booked"), recall(1, "sent"), recall(2, "sent"), recall(1, "sent"), recall(0, "booked"), recall(0, "due")]);

  // ---- reviews: two published (5 and 4), one under review
  const reviewed = async (rating: number, status: "published" | "under_review") =>
    db.insert(reviews).values({
      id: newId(),
      orgId: p.orgId,
      practitionerId: p.drA,
      appointmentId: await appt({ startsAt: morning(60 + rating), status: "cancelled", cancelledBy: "staff" }),
      rating,
      authorName: "A.",
      status,
      publishedAt: status === "published" ? morning(50) : null,
    });
  await reviewed(5, "published");
  await reviewed(4, "published");
  await reviewed(1, "under_review");

  // ---- marketplace funnel: 200 appearances, 40 views, 1 booking started on Sorriso
  await db.insert(profileStats).values({ practitionerId: p.drA, day: addDays(today, -5), views: 40, searchImpressions: 200 });
  await appt({ startsAt: morning(3), status: "cancelled", cancelledBy: "staff", processingContext: "marketplace", isNewPatient: true, createdAt: morning(6) });

  state.rankInput = {
    practitionerId: p.drA,
    orgId: p.orgId,
    soonestSlotAt: null,
    ratingSum: 9,
    ratingCount: 2,
    staffCancelRate180d: 0.1,
    profileCompleteness: 0.5,
    cityMatch: false,
    distanceKm: null,
    reliabilitySample: 20,
  } satisfies RankInput;
});

describe("loadAnalytics", () => {
  it("computes no-show and late-cancel rates overall and by treatment, scoped to the practice and the window", async () => {
    const a = await loadAnalytics(org, { months: 24 });
    expect(a.outcomes.total).toMatchObject({ completed: 7, noShows: 3, lateCancels: 1 });
    expect(a.outcomes.total.noShowRate).toEqual({ num: 3, den: 10, pct: 30 });
    expect(a.outcomes.total.lateCancelRate).toEqual({ num: 1, den: 11, pct: 9.1 });
    const visit = a.outcomes.byService.find((r) => r.key === p.visit)!;
    const cleaning = a.outcomes.byService.find((r) => r.key === p.cleaning)!;
    expect(visit.noShowRate).toEqual({ num: 2, den: 8, pct: 25 });
    expect(cleaning.noShowRate).toEqual({ num: 1, den: 2, pct: 50 });
    expect(a.outcomes.byPractitioner).toHaveLength(1);
    expect(a.outcomes.byPartOfDay.find((r) => r.key === "evening")).toMatchObject({ completed: 1, noShows: 1, lateCancels: 0 });
    expect(a.outcomes.byPartOfDay.find((r) => r.key === "morning")).toMatchObject({ completed: 6, noShows: 2, lateCancels: 1 });
    const weekdays = a.outcomes.byWeekday.reduce((n, r) => n + r.completed + r.noShows + r.lateCancels, 0);
    expect(weekdays).toBe(11);
  });

  it("credits each confirmation to the last reminder before it, by channel and by timing", async () => {
    const a = await loadAnalytics(org, { months: 24 });
    const sms = a.confirmation.byChannel.find((r) => r.key === "sms")!;
    const email = a.confirmation.byChannel.find((r) => r.key === "email")!;
    expect(sms).toMatchObject({ sent: 4, confirmed: 2, rate: { pct: 50 } });
    expect(email).toMatchObject({ sent: 3, confirmed: 1, rate: { pct: 33.3 } });
    expect(a.confirmation.total).toMatchObject({ sent: 7, confirmed: 3, rate: { pct: 42.9 } });
    expect(a.confirmation.byOffset.find((r) => r.key === "d1")).toMatchObject({ sent: 4, confirmed: 2 });
    expect(a.confirmation.byOffset.find((r) => r.key === "d2")).toMatchObject({ sent: 3, confirmed: 1 });
  });

  it("computes the waitlist fill rate over entries with an outcome", async () => {
    const a = await loadAnalytics(org, { months: 24 });
    expect(a.waitlist).toMatchObject({ entries: 5, booked: 2, removed: 1, expired: 1, waiting: 1 });
    expect(a.waitlist.fillRate).toEqual({ num: 2, den: 4, pct: 50 });
  });

  it("computes recall conversion from the recalls table (booked among those contacted)", async () => {
    const a = await loadAnalytics(org, { months: 24 });
    expect(a.recalls).toMatchObject({ due: 6, contacted: 4, booked: 1 });
    expect(a.recalls.conversion).toEqual({ num: 1, den: 4, pct: 25 });
  });

  it("counts published reviews only, the marketplace funnel, and scores the ranking inputs with scoreResult()", async () => {
    const a = await loadAnalytics(org, { months: 24 });
    expect(a.reviews).toMatchObject({ total: 2, average: 4.5 });
    expect(a.funnel).toMatchObject({ impressions: 200, views: 40, bookings: 1, bookingRate: { pct: 2.5 }, viewRate: { pct: 20 } });
    expect(a.newPatients.byContext).toEqual([{ key: "marketplace", count: 1 }]);
    const [row] = a.ranking.practitioners;
    const expected = scoreResult(state.rankInput as RankInput, { globalMeanRating: a.ranking.globalMeanRating, now: new Date(), seed: "x" });
    expect(row.score).toBe(Math.round(expected.score * 1000) / 10);
    expect(row).toMatchObject({ practitionerId: p.drA, ratingCount: 2, ratingAverage: 4.5, completeness: 50, staffCancelRate: { num: 2, den: 20, pct: 10 } });
    expect(row.reasons).toEqual(expected.reasons);
  });

  it("returns no patient data", async () => {
    const json = JSON.stringify(await loadAnalytics(org, { months: 24 }));
    expect(json).not.toMatch(/Ada|Fixture|\+39333/);
  });
});

/** Rows of the CSV, unquoted (RFC 4180: quoted cells may hold commas and doubled quotes). */
function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .trim()
    .split("\r\n")
    .map((line) => {
      const cells: string[] = [];
      let i = 0;
      while (i <= line.length) {
        if (line[i] === '"') {
          let value = "";
          i++;
          while (i < line.length) {
            if (line[i] === '"' && line[i + 1] === '"') {
              value += '"';
              i += 2;
            } else if (line[i] === '"') {
              i++;
              break;
            } else value += line[i++];
          }
          cells.push(value);
          i++; // the comma
        } else {
          const end = line.indexOf(",", i);
          cells.push(line.slice(i, end === -1 ? line.length : end));
          i = end === -1 ? line.length + 1 : end + 1;
        }
      }
      return cells;
    });
}

describe("CSV export", () => {
  it("prints the same numbers as the page", async () => {
    const a = await loadAnalytics(org, { months: 24 });
    const t = getT("en", "analytics");
    const rows = parseCsv(analyticsCsv(a, "en"));
    expect(rows[0]).toEqual([t("csv.section"), t("csv.item"), t("csv.measure"), t("csv.value"), t("csv.numerator"), t("csv.denominator")]);
    const find = (section: string, item: string, measure: string) => rows.find((r) => r[0] === section && r[1] === item && r[2] === measure);
    expect(find(t("sections.outcomesTotal"), t("csv.all"), t("measures.noShowRate"))?.slice(3)).toEqual([String(a.outcomes.total.noShowRate.pct), "3", "10"]);
    expect(find(t("sections.confirmationByChannel"), "SMS", t("measures.confirmationRate"))?.[3]).toBe(String(a.confirmation.byChannel.find((r) => r.key === "sms")!.rate.pct));
    expect(find(t("sections.waitlist"), t("csv.all"), t("measures.fillRate"))?.[3]).toBe("50");
    expect(find(t("sections.recalls"), t("csv.all"), t("measures.recallConversion"))?.[3]).toBe("25");
  });

  it("neutralises formula-like names", async () => {
    const a = await loadAnalytics(org, { months: 24 });
    a.outcomes.byService[0].name = "=HYPERLINK(\"http://x\")";
    expect(analyticsCsv(a, "en")).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("the route answers 403 without analytics.read and the same CSV with it", async () => {
    const { GET } = await import("@/app/dashboard/analytics/export/route");
    const req = () => new Request("https://sorriso.test/dashboard/analytics/export?months=24");
    await signIn("reception");
    const denied = await GET(req());
    expect(denied.status).toBe(403);

    await signIn("owner");
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();
    const rows = parseCsv(await res.text());
    const t = getT("en", "analytics");
    const total = rows.find((r) => r[0] === t("sections.outcomesTotal") && r[2] === t("measures.noShowRate"));
    expect(total?.[3]).toBe("30");
  });
});

describe("/dashboard/analytics", () => {
  it("sends a role without analytics.read to the forbidden page", async () => {
    const { default: AnalyticsPage } = await import("@/app/dashboard/analytics/page");
    await signIn("practitioner");
    await expect(AnalyticsPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("/dashboard?denied=1"),
    });
  });

  it("renders for an owner", async () => {
    const { default: AnalyticsPage } = await import("@/app/dashboard/analytics/page");
    await signIn("owner");
    const page = await AnalyticsPage({ searchParams: Promise.resolve({ months: "24", by: "partOfDay" }) });
    expect(page).toBeTruthy();
  });

  it("prints counts and the median lead time with the staff locale's separators", async () => {
    const { default: AnalyticsPage } = await import("@/app/dashboard/analytics/page");
    const real = await loadAnalytics(org, { months: 24 });
    state.analytics = {
      ...real,
      outcomes: { ...real.outcomes, total: { ...real.outcomes.total, noShows: 1250, completed: 10750 } },
      leadTime: { ...real.leadTime, medianDays: 3.5, bookings: 2400 },
      waitlist: { ...real.waitlist, entries: 1234 },
      funnel: { ...real.funnel, impressions: 12500 },
    };
    try {
      await signIn("owner", "de");
      // What the page hands on (HTML or RSC payload): every element's props, without the components.
      const seen = new WeakSet<object>();
      const json = JSON.stringify(await AnalyticsPage({ searchParams: Promise.resolve({ months: "24" }) }), (key, value) => {
        if (key === "type" || key === "_owner" || key === "_store") return undefined;
        if (value && typeof value === "object") {
          if (seen.has(value)) return undefined;
          seen.add(value);
        }
        return value;
      });
      const t = getT("de", "analytics");
      expect(json).toContain(t("kpi.leadTimeValue", { count: 3.5 }));
      expect(t("kpi.leadTimeValue", { count: 3.5 })).toContain("3,5");
      expect(json).toContain(t("kpi.noShowHint", { noShows: "1.250", visits: "12.000" }));
      expect(json).toContain(t("chart.bar", { label: t("funnel.impressions"), value: "12.500" }));
      const w = real.waitlist;
      expect(json).toContain(
        t("sections.waitlistDetail", { entries: "1.234", booked: w.booked, removed: w.removed, expired: w.expired, waiting: w.waiting }),
      );
      expect(json).not.toMatch(/"(12500|1234|1250 )/);
    } finally {
      state.analytics = null;
    }
  });
});
