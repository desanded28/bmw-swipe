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
import { resolveSettings } from "./settings";

export type AppointmentDetails = {
  appointment: Appointment;
  patient: Patient;
  org: Organization;
  service: Service;
  practitioner: Practitioner;
  location: Location;
  room: Room | null;
};

export async function getAppointmentDetails(
  where: { id: string } | { token: string },
  tx: Tx = db,
): Promise<AppointmentDetails | null> {
  const condition: SQL = "id" in where ? eq(appointments.id, where.id) : eq(appointments.manageToken, where.token);
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
  return row ?? null;
}

export async function getOrgAppointmentDetails(orgId: string, id: string, tx: Tx = db) {
  const details = await getAppointmentDetails({ id }, tx);
  return details && details.org.id === orgId ? details : null;
}

export function appointmentLinks(d: Pick<AppointmentDetails, "appointment" | "org">) {
  const token = d.appointment.manageToken;
  return {
    manageUrl: absoluteUrl(`/a/${token}`),
    icsUrl: absoluteUrl(`/api/ics/appointment/${token}`),
    reviewUrl: absoluteUrl(`/a/${token}/review`),
    rebookUrl: absoluteUrl(
      `/book/${d.org.slug}?service=${d.appointment.serviceId}&practitioner=${d.appointment.practitionerId}`,
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

export function canReachByEmail(p: Patient) {
  return Boolean(p.email && p.emailOptIn);
}

export function canReachByPhone(p: Patient) {
  return Boolean(p.phone && p.smsOptIn);
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
