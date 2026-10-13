import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { locations, organizations, patients, practitioners, services, waitlist } from "@/db/schema";
import { evaluateSlot, loadAvailabilityContext } from "./availability";
import { canReachByEmail, canReachByPhone } from "./appointments";
import { absoluteUrl } from "./config";
import { practitionerName } from "./format";
import { deliver } from "./messaging";
import { templates, type AppointmentTemplateData } from "./messaging/templates";
import { resolveSettings } from "./settings";
import { zonedParts } from "./time";

/** How many waitlisted patients to notify per freed slot. First to book wins. */
const OFFERS_PER_SLOT = 3;
/** Don't offer slots that start sooner than this. */
const MIN_LEAD_MS = 2 * 3_600_000;

export type FreedSlot = {
  orgId: string;
  serviceId: string;
  practitionerId: string;
  locationId: string;
  startsAt: Date;
};

export function bookSlotUrl(orgSlug: string, slot: FreedSlot, entryId?: string) {
  const params = new URLSearchParams({
    service: slot.serviceId,
    practitioner: slot.practitionerId,
    location: slot.locationId,
    start: slot.startsAt.toISOString(),
  });
  if (entryId) params.set("wl", entryId);
  return absoluteUrl(`/book/${orgSlug}?${params.toString()}`);
}

/**
 * A slot was freed (cancellation or reschedule): offer it to matching waitlist
 * entries. Returns how many patients were notified.
 */
export async function offerFreedSlot(slot: FreedSlot, now = new Date()): Promise<number> {
  if (slot.startsAt.getTime() - now.getTime() < MIN_LEAD_MS) return 0;

  const [org] = await db.select().from(organizations).where(eq(organizations.id, slot.orgId));
  if (!org || !resolveSettings(org.settings).reminders.autoOfferToWaitlist) return 0;
  const [location] = await db.select().from(locations).where(eq(locations.id, slot.locationId));
  const [service] = await db.select().from(services).where(eq(services.id, slot.serviceId));
  const [practitioner] = await db.select().from(practitioners).where(eq(practitioners.id, slot.practitionerId));
  if (!location || !service || !practitioner) return 0;
  // The offer links to online booking, so only offer what patients can book online.
  if (!service.active || !service.onlineBookable || !practitioner.active) return 0;

  const local = zonedParts(slot.startsAt, location.timezone);
  const partOfDay = local.minutes < 13 * 60 ? "morning" : "afternoon";

  const candidates = await db
    .select({ entry: waitlist, patient: patients })
    .from(waitlist)
    .innerJoin(patients, eq(patients.id, waitlist.patientId))
    .where(
      and(
        eq(waitlist.orgId, slot.orgId),
        eq(waitlist.status, "active"),
        eq(waitlist.serviceId, slot.serviceId),
        lte(waitlist.earliestDate, local.date),
        gte(waitlist.latestDate, local.date),
      ),
    )
    .orderBy(asc(waitlist.createdAt))
    .limit(50);

  const matches = candidates
    .filter(({ entry }) => !entry.practitionerId || entry.practitionerId === slot.practitionerId)
    .filter(({ entry }) => !entry.locationId || entry.locationId === slot.locationId)
    .filter(({ entry }) => entry.partOfDay === "any" || entry.partOfDay === partOfDay)
    .filter(({ patient }) => canReachByPhone(patient) || canReachByEmail(patient))
    .slice(0, OFFERS_PER_SLOT);
  if (!matches.length) return 0;

  // Make sure the slot really is bookable online (staff may have refilled it already).
  const ctx = await loadAvailabilityContext({
    orgId: slot.orgId,
    serviceId: slot.serviceId,
    practitionerIds: [slot.practitionerId],
    locationId: slot.locationId,
    rangeStart: new Date(slot.startsAt.getTime() - 86_400_000),
    rangeEnd: new Date(slot.startsAt.getTime() + 86_400_000),
  });
  if (!ctx) return 0;
  const evaluation = evaluateSlot(ctx, {
    practitionerId: slot.practitionerId,
    locationId: slot.locationId,
    start: slot.startsAt,
    requireWorkingHours: true,
    enforcePolicy: true,
    now,
  });
  if (!evaluation.ok) return 0;

  let sent = 0;
  for (const { entry, patient } of matches) {
    const url = bookSlotUrl(org.slug, slot, entry.id);
    const data: AppointmentTemplateData = {
      locale: patient.locale,
      patientFirstName: patient.firstName,
      clinicName: org.name,
      clinicPhone: location.phone ?? org.phone,
      brandColor: org.brandColor,
      practitionerName: practitionerName(practitioner),
      serviceName: service.name,
      start: slot.startsAt,
      timezone: location.timezone,
      locationName: location.name,
      address: `${location.address}, ${location.city}`,
      manageUrl: url,
      icsUrl: url,
    };
    const useText = canReachByPhone(patient) && patient.preferredChannel !== "email";
    const channel = useText ? (patient.preferredChannel === "whatsapp" ? "whatsapp" : "sms") : "email";
    const email = templates.waitlistOfferEmail(data, url);
    const msg = await deliver({
      orgId: org.id,
      patientId: patient.id,
      channel,
      to: channel === "email" ? patient.email! : patient.phone!,
      subject: channel === "email" ? email.subject : undefined,
      text: channel === "email" ? email.text : templates.waitlistOfferSms(data, url),
      html: channel === "email" ? email.html : undefined,
      fromName: org.name,
      replyTo: org.email,
    });
    if (msg.status !== "failed") {
      sent++;
      await db
        .update(waitlist)
        .set({ offersSent: sql`${waitlist.offersSent} + 1`, lastOfferedAt: now })
        .where(eq(waitlist.id, entry.id));
    }
  }
  return sent;
}
