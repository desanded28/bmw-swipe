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
  type Room,
  type Service,
} from "@/db/schema";
import { absoluteUrl } from "./config";
import { practitionerName } from "./format";
import type { AppointmentTemplateData } from "./messaging/templates";
import { pickTextChannel } from "./contact";
import { hashToken, isManageLinkValid, manageTokenOf } from "./links";
import { isAllowed } from "./privacy/consent";
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
 * sender decides through here: pickTextChannel() gives WhatsApp only where the practice enabled it
 * and the patient chose it, and on top of that WhatsApp needs a current whatsapp_channel grant in
 * the consent ledger. A WhatsApp preference without one (a record from before the ledger, or one
 * set by staff without recording the patient's consent) gets SMS, so nothing reaches Meta without
 * the consent. WP3 adds the per-locale template fallback behind this.
 */
export async function textChannelFor(
  patient: Patient,
  org: Pick<Organization, "settings">,
  now: Date = new Date(),
): Promise<"sms" | "whatsapp" | null> {
  const whatsappEnabled =
    getPrivacy(org).whatsappEnabled && patient.preferredChannel === "whatsapp" && (await isAllowed(patient.id, "whatsapp_channel"));
  return pickTextChannel(patient, { whatsappEnabled }, now);
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
    rebookUrl: absoluteUrl(
      `/book/${d.org.slug}?service=${d.appointment.serviceId}&practitioner=${d.appointment.practitionerId}${ref}`,
    ),
  };
}

export function templateData(d: AppointmentDetails): AppointmentTemplateData {
  const links = appointmentLinks(d);
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
    address: `${d.location.address}, ${d.location.city}`,
    manageUrl: links.manageUrl,
    icsUrl: links.icsUrl,
  };
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
