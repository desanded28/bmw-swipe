import { and, eq, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  appointments,
  locations,
  organizations,
  patients,
  practitioners,
  rooms,
  services,
  type Appointment,
  type Location,
  type Organization,
  type Patient,
  type Practitioner,
  type PrivacySettings,
  type Room,
  type Service,
} from "@/db/schema";
import { lhref } from "@/i18n/href";
import { absoluteUrl } from "./config";
import { isContactVerified, recipientFor, type ContactKind } from "./contact";
import { practitionerName } from "./format";
import { hashToken, isManageLinkValid, manageTokenOf } from "./links";
import { templates, type AppointmentTemplateData, type ContentLevel } from "./messaging/templates";
import { chooseTextChannel } from "./messaging/whatsapp";
import { signPracticeRef } from "./privacy/context";
import { getPrivacy } from "./privacy/settings";
import { resolveSettings } from "./settings";

/**
 * Opt-in, restriction and guardian routing (under 14) live in contact.ts; address the message to
 * recipientFor(patient), not to the patient's own fields.
 */
export { canReachByEmail, canReachByPhone } from "./contact";

/**
 * The text channel for a message to this patient, or null when they can't be texted. Every text
 * sender decides through here (chooseTextChannel in src/lib/messaging/whatsapp.ts): WhatsApp only
 * where the practice enabled it, the patient chose it, the consent ledger holds a current
 * whatsapp_channel grant and an approved template exists for `kind` in the patient's language;
 * otherwise SMS if the patient accepts texts. Without a `kind` (a message with no WhatsApp
 * template) the answer is SMS, so nothing reaches Meta as free text outside the 24-hour window.
 */
export async function textChannelFor(
  patient: Patient,
  org: Pick<Organization, "settings">,
  now: Date = new Date(),
  kind?: string,
): Promise<"sms" | "whatsapp" | null> {
  return chooseTextChannel(patient, getPrivacy(org), { kind, now });
}

export type AppointmentDetails = {
  appointment: Appointment;
  patient: Patient;
  org: Organization;
  service: Service;
  practitioner: Practitioner;
  location: Location;
  room: Room | null;
};

/**
 * Load an appointment with everything around it. A { token } lookup is the patient's
 * self-service link: it matches on the token hash and returns null once the link has
 * expired, unless allowExpired is set (used to show a friendly "link expired" page).
 */
export async function getAppointmentDetails(
  where: { id: string } | { token: string; allowExpired?: boolean },
  tx: Tx = db,
): Promise<AppointmentDetails | null> {
  const condition: SQL = "id" in where ? eq(appointments.id, where.id) : eq(appointments.manageTokenHash, hashToken(where.token));
  const [row] = await tx
    .select({
      appointment: appointments,
      patient: patients,
      org: organizations,
      service: services,
      practitioner: practitioners,
      location: locations,
      room: rooms,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(organizations, eq(organizations.id, appointments.orgId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .leftJoin(rooms, eq(rooms.id, appointments.roomId))
    .where(condition);
  if (!row) return null;
  if ("token" in where && !where.allowExpired && !isManageLinkValid(row.appointment)) return null;
  return row;
}

export async function getOrgAppointmentDetails(orgId: string, id: string, tx: Tx = db) {
  const details = await getAppointmentDetails({ id }, tx);
  return details && details.org.id === orgId ? details : null;
}

export function appointmentLinks(d: Pick<AppointmentDetails, "appointment" | "org">) {
  const token = manageTokenOf(d.appointment);
  const clinicUrl = absoluteUrl(`/c/${d.org.slug}`);
  // A practice booking's "book again" link stays with the practice as controller.
  const ref = d.appointment.processingContext === "practice" ? `&ref=${signPracticeRef(d.org.id)}` : "";
  return {
    manageUrl: token ? absoluteUrl(`/a/${token}`) : clinicUrl,
    icsUrl: token ? absoluteUrl(`/api/ics/appointment/${token}`) : clinicUrl,
    reviewUrl: token ? absoluteUrl(`/a/${token}/review`) : clinicUrl,
    /** The patient's privacy choices for this visit (WP4's page); the privacy center without a token. */
    preferencesUrl: token ? absoluteUrl(`/a/${token}/privacy`) : absoluteUrl("/privacy"),
    rebookUrl: absoluteUrl(
      `/book/${d.org.slug}?service=${d.appointment.serviceId}&practitioner=${d.appointment.practitionerId}${ref}`,
    ),
  };
}

/** The practice's privacy notice, in the patient's language. */
export function practiceNoticeUrl(org: Pick<Organization, "slug">, locale: Patient["locale"]): string {
  return absoluteUrl(lhref(locale, `/c/${org.slug}/privacy`));
}

/**
 * How much a message to this contact may say (docs/messaging.md). "detailed" (treatment and
 * practitioner in SMS, subjects and email bodies) only when all of these hold:
 * - the practice chose detailed messages (privacy.messageContentLevel);
 * - the treatment is not marked sensitive (its name alone would reveal health information);
 * - the patient record has a verified contact (contactVerifiedAt) and the very contact this
 *   message goes to is one of the verified ones, so a mistyped number or address never gets more
 *   than the discreet text.
 * Everything else is "discreet".
 */
export function contentLevelFor(i: {
  privacy: Pick<PrivacySettings, "messageContentLevel">;
  service: Pick<Service, "sensitive">;
  patient: Pick<Patient, "contactVerifiedAt" | "verifiedContacts">;
  contact: { kind: ContactKind; value: string | null };
}): ContentLevel {
  if (i.privacy.messageContentLevel !== "detailed" || i.service.sensitive || !i.patient.contactVerifiedAt) return "discreet";
  return isContactVerified(i.patient, i.contact.kind, i.contact.value) ? "detailed" : "discreet";
}

export function templateData(d: AppointmentDetails, now: Date = new Date()): AppointmentTemplateData {
  const links = appointmentLinks(d);
  const privacy = getPrivacy(d.org);
  const to = recipientFor(d.patient, now);
  const address = `${d.location.address}, ${d.location.city}`;
  const level = (kind: ContactKind, value: string | null) =>
    contentLevelFor({ privacy, service: d.service, patient: d.patient, contact: { kind, value } });
  return {
    locale: d.patient.locale,
    patientFirstName: d.patient.firstName,
    clinicName: d.org.name,
    clinicPhone: d.location.phone ?? d.org.phone,
    brandColor: d.org.brandColor,
    practitionerName: practitionerName(d.practitioner),
    serviceName: d.service.name,
    start: d.appointment.startsAt,
    timezone: d.location.timezone,
    locationName: d.location.name,
    address,
    manageUrl: links.manageUrl,
    icsUrl: links.icsUrl,
    recipientName: to.viaGuardian ? to.name : null,
    viaGuardian: to.viaGuardian,
    contentLevel: { email: level("email", to.email), text: level("phone", to.phone) },
    smsAsciiFallback: resolveSettings(d.org.settings).reminders.smsAsciiFallback,
    legalName: d.org.legalName ?? d.org.name,
    legalAddress: d.org.registeredAddress ?? address,
    privacyUrl: practiceNoticeUrl(d.org, d.patient.locale),
    preferencesUrl: links.preferencesUrl,
    reason: "appointment",
  };
}

/**
 * The WhatsApp fields of an appointment message for deliver(): the template kind (whatsapp.ts),
 * the patient's language and the discreet variables (name, date, practice, link).
 */
export function appointmentWhatsApp(
  d: AppointmentDetails,
  kind: string,
  link?: string,
): { whatsappKind: string; locale: Patient["locale"]; whatsappVariables: Record<string, string> } {
  return { whatsappKind: kind, locale: d.patient.locale, whatsappVariables: templates.whatsappVariables(templateData(d), link) };
}

/** Is the patient still allowed to reschedule online? */
export function canPatientReschedule(d: AppointmentDetails, now = new Date()) {
  const settings = resolveSettings(d.org.settings);
  if (!["scheduled", "requested"].includes(d.appointment.status)) return false;
  return d.appointment.startsAt.getTime() - now.getTime() >= settings.booking.cancelUntilHours * 3_600_000;
}

/** Patients can always cancel an upcoming visit: a late cancellation beats a no-show. */
export function canPatientCancel(d: AppointmentDetails, now = new Date()) {
  return ["scheduled", "requested"].includes(d.appointment.status) && d.appointment.startsAt.getTime() > now.getTime();
}

export function isLateCancellation(d: AppointmentDetails, now = new Date()) {
  const settings = resolveSettings(d.org.settings);
  return d.appointment.startsAt.getTime() - now.getTime() < settings.booking.cancelUntilHours * 3_600_000;
}

export async function findPatientAppointments(orgId: string, patientId: string, tx: Tx = db) {
  return tx
    .select({ appointment: appointments, service: services, practitioner: practitioners, location: locations })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .where(and(eq(appointments.orgId, orgId), eq(appointments.patientId, patientId)));
}
