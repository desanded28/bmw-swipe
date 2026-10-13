import type { AppointmentDetails } from "./appointments";
import { appointmentLinks, canPatientCancel, canPatientReschedule } from "./appointments";
import { fullName, practitionerName } from "./format";

/** Public (patient-facing) view of an appointment. No internal notes. */
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

/** Partner API view: full details for the practice's own integrations. */
export function partnerAppointment(d: AppointmentDetails) {
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
      birthDate: d.patient.birthDate,
      noShowCount: d.patient.noShowCount,
    },
    patientNote: d.appointment.patientNote,
    internalNote: d.appointment.internalNote,
    createdAt: d.appointment.createdAt.toISOString(),
    updatedAt: d.appointment.updatedAt.toISOString(),
  };
}
