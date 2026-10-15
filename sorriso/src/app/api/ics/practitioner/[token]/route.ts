import { and, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, locations, organizations, patients, practitioners, users } from "@/db/schema";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/t";
import { audit } from "@/lib/audit";
import { sha256Hex } from "@/lib/crypto";
import { practitionerName } from "@/lib/format";
import { buildIcs } from "@/lib/ics";
import { getPrivacy } from "@/lib/privacy/settings";
import { ipKey, peekRateLimit, rateLimit } from "@/lib/rate-limit";
import { FEED_AHEAD_DAYS, FEED_PAST_DAYS, patientInitials } from "@/lib/security/ics-feed";

/**
 * Subscribable calendar feed for one practitioner (Google Calendar, Apple Calendar, Outlook:
 * "subscribe from URL"). Read-only, refreshed by the calendar provider, which stores what it gets.
 * So it carries as little as possible:
 *  - only when the practice turned feeds on (privacy.icsFeedsEnabled), the feed is enabled and
 *    its token (looked up by hash) hasn't expired (12 months);
 *  - the past 7 days and the next 30;
 *  - each event is "Appointment", or "Appointment · G. S." with the practice's icsDetail
 *    'initials': never the treatment, the patient's name or any note. A patient who restricted
 *    processing (Art. 18) or was erased is always just "Appointment": the dashboard masks them
 *    too, and a calendar provider is a third party;
 *  - every fetch is audited (ics.feed.fetch, with the HMAC of the caller's IP) and rate-limited.
 * Anything wrong answers the same 404, so the URL reveals nothing.
 */

const HOUR = 60 * 60_000;
/**
 * Unknown feed URLs per network per hour. Only unknown tokens count: calendar providers fetch
 * every subscriber's feeds from shared addresses, and keep polling feeds that were turned off.
 */
const MISSES_PER_HOUR = 30;
/** Fetches per feed per hour: calendar apps poll every 15-60 minutes. */
const FETCHES_PER_HOUR = 30;

const tooMany = (retryAfterSec: number) =>
  new Response("Too many requests", { status: 429, headers: { "Retry-After": String(retryAfterSec), "Cache-Control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const missKey = ipKey(req.headers, "ics-miss");
  const misses = await peekRateLimit(missKey, MISSES_PER_HOUR);
  if (!misses.ok) return tooMany(misses.retryAfterSec);
  const notFound = async (unknown = false) => {
    if (unknown) await rateLimit(missKey, MISSES_PER_HOUR, HOUR);
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  };

  const { token } = await params;
  const cleanToken = token.replace(/\.ics$/, "");
  if (cleanToken.length < 20 || cleanToken.length > 100) return notFound(true);
  const hash = sha256Hex(cleanToken);
  const now = new Date();
  const [p] = await db.select().from(practitioners).where(eq(practitioners.icsTokenHash, hash));
  if (!p) return notFound(true);
  const byFeed = await rateLimit(`ics-feed:${p.id}`, FETCHES_PER_HOUR, HOUR);
  if (!byFeed.ok) return tooMany(byFeed.retryAfterSec);
  // Every feed expires: one without an expiry (issued before expiries existed) is treated as expired.
  if (!p.icsEnabled || !p.icsTokenExpiresAt || p.icsTokenExpiresAt.getTime() <= now.getTime()) return notFound();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
  // Feeds put appointment data into third-party calendars: off unless the practice enables them.
  const privacy = org ? getPrivacy(org) : null;
  if (!org || !privacy?.icsFeedsEnabled) return notFound();

  const rows = await db
    .select({
      a: appointments,
      firstName: patients.firstName,
      lastName: patients.lastName,
      restrictedAt: patients.restrictedAt,
      erasedAt: patients.erasedAt,
      location: locations.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .where(
      and(
        eq(appointments.orgId, p.orgId),
        eq(appointments.practitionerId, p.id),
        gte(appointments.startsAt, new Date(now.getTime() - FEED_PAST_DAYS * 86_400_000)),
        lt(appointments.startsAt, new Date(now.getTime() + FEED_AHEAD_DAYS * 86_400_000)),
        ne(appointments.status, "cancelled"),
      ),
    );

  // Staff surfaces follow the staff member's language: the practitioner's own account, else
  // whoever issued the feed, else the practice default.
  const owners = [p.userId, p.icsIssuedByUserId].filter((id): id is string => Boolean(id));
  const ownerLocales = owners.length ? await db.select({ id: users.id, locale: users.locale }).from(users).where(inArray(users.id, owners)) : [];
  const ownLocale = owners.map((id) => ownerLocales.find((u) => u.id === id)?.locale).find((l) => isLocale(l));
  const locale = ownLocale ?? (isLocale(org.defaultLocale) ? org.defaultLocale : "it");
  const t = getT(locale, "security");
  const ics = buildIcs({
    name: t("ics.calendarName", { practitioner: practitionerName(p), practice: org.name }),
    events: rows.map(({ a, firstName, lastName, restrictedAt, erasedAt, location }) => ({
      uid: `${a.id}@sorriso`,
      start: a.startsAt,
      end: a.endsAt,
      summary:
        privacy.icsDetail === "initials" && !restrictedAt && !erasedAt
          ? t("ics.summaryInitials", { initials: patientInitials(firstName, lastName) })
          : t("ics.summary"),
      // Never the treatment or the patient's note: free text that may hold health data stays out of third-party calendars.
      description: a.status === "requested" ? t("ics.requested") : undefined,
      location,
      status: a.status === "requested" ? "TENTATIVE" : "CONFIRMED",
      sequence: Math.floor(a.updatedAt.getTime() / 1000),
    })),
  });

  await audit({
    orgId: org.id,
    actor: { type: "system", id: null },
    action: "ics.feed.fetch",
    entity: { type: "practitioner", id: p.id },
    metadata: { events: rows.length },
    headers: req.headers,
  });
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
