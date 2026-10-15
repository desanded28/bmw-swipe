import type { ApiScope } from "@/db/enums";
import type { AppointmentDetails } from "./appointments";
import { appointmentLinks, canPatientCancel, canPatientReschedule } from "./appointments";
import { fullName, practitionerName } from "./format";

/**
 * Public (patient-facing) view of an appointment. No internal notes.
 *
 * ADD-ONLY CONTRACT (F9.1): the manage page (WP1), the privacy card (WP4) and forms/rebook (WP8)
 * read this shape, and partner integrations receive it from the booking API. Fields may be added;
 * never remove, rename or change the type of one.
 */
export function publicAppointment(d: AppointmentDetails) {
  const links = appointmentLinks(d);
  return {
    id: d.appointment.id,
    status: d.appointment.status,
    confirmation: d.appointment.confirmation,
    start: d.appointment.startsAt.toISOString(),
    end: d.appointment.endsAt.toISOString(),
    timezone: d.location.timezone,
    service: { id: d.service.id, name: d.service.name, durationMinutes: d.service.durationMinutes, priceCents: d.service.priceCents },
    practitioner: { id: d.practitioner.id, name: practitionerName(d.practitioner), specialty: d.practitioner.specialty },
    location: { id: d.location.id, name: d.location.name, address: d.location.address, city: d.location.city, phone: d.location.phone },
    clinic: { slug: d.org.slug, name: d.org.name, phone: d.org.phone },
    patient: { firstName: d.patient.firstName },
    canCancel: canPatientCancel(d),
    canReschedule: canPatientReschedule(d),
    manageUrl: links.manageUrl,
    icsUrl: links.icsUrl,
  };
}

/**
 * Partner API view for the practice's own integrations, cut to the key's scopes (data
 * minimisation): appointment notes, free text that may hold health data, only with notes:read;
 * birth date and no-show count only with patients:read. The patient's restricted/erased flags are
 * always there, so integrations can honour Art. 18 and 17 (Art. 19).
 *
 * A restricted or erased patient's visit carries only ids, times, status and those flags: no name,
 * contacts, birth date, no-show count, service name or notes. Restricted data may only be stored
 * (Art. 18(2)); sending it to a recipient is processing, and the dashboard itself shows it only to
 * staff who give a reason each time. The fields stay in the shape, as null.
 */
export function partnerAppointment(d: AppointmentDetails, scopes: readonly ApiScope[]) {
  const withheld = Boolean(d.patient.restrictedAt || d.patient.erasedAt);
  const notes = scopes.includes("notes:read");
  const patientDetails = scopes.includes("patients:read");
  if (withheld) {
    return {
      id: d.appointment.id,
      status: d.appointment.status,
      confirmation: d.appointment.confirmation,
      confirmedVia: d.appointment.confirmedVia,
      start: d.appointment.startsAt.toISOString(),
      end: d.appointment.endsAt.toISOString(),
      source: d.appointment.source,
      serviceId: d.service.id,
      serviceName: null,
      practitionerId: d.practitioner.id,
      locationId: d.location.id,
      roomId: d.room?.id ?? null,
      patient: {
        id: d.patient.id,
        name: null,
        email: null,
        phone: null,
        ...(patientDetails ? { birthDate: null, noShowCount: null } : {}),
        restricted: Boolean(d.patient.restrictedAt),
        erased: Boolean(d.patient.erasedAt),
      },
      ...(notes ? { patientNote: null, internalNote: null } : {}),
      createdAt: d.appointment.createdAt.toISOString(),
      updatedAt: d.appointment.updatedAt.toISOString(),
    };
  }
  return {
    id: d.appointment.id,
    status: d.appointment.status,
    confirmation: d.appointment.confirmation,
    confirmedVia: d.appointment.confirmedVia,
    start: d.appointment.startsAt.toISOString(),
    end: d.appointment.endsAt.toISOString(),
    source: d.appointment.source,
    serviceId: d.service.id,
    serviceName: d.service.name,
    practitionerId: d.practitioner.id,
    locationId: d.location.id,
    roomId: d.room?.id ?? null,
    patient: {
      id: d.patient.id,
      name: fullName(d.patient),
      email: d.patient.email,
      phone: d.patient.phone,
      ...(patientDetails ? { birthDate: d.patient.birthDate, noShowCount: d.patient.noShowCount } : {}),
      restricted: Boolean(d.patient.restrictedAt),
      erased: Boolean(d.patient.erasedAt),
    },
    ...(notes ? { patientNote: d.appointment.patientNote, internalNote: d.appointment.internalNote } : {}),
    createdAt: d.appointment.createdAt.toISOString(),
    updatedAt: d.appointment.updatedAt.toISOString(),
  };
}
