import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, ne, type SQL } from "drizzle-orm";
import type { ApptDTO, Resources } from "@/components/dashboard/types";
import { db } from "@/db";
import {
  appointments,
  locations,
  patients,
  practitionerServices,
  practitioners,
  rooms,
  services,
  type AppointmentStatus,
} from "@/db/schema";
import { fullName, practitionerName } from "./format";

export async function loadResources(orgId: string, timezone: string): Promise<Resources> {
  const [pracs, locs, svcs] = await Promise.all([
    db.select().from(practitioners).where(and(eq(practitioners.orgId, orgId), eq(practitioners.active, true))).orderBy(asc(practitioners.name)),
    db.select().from(locations).where(and(eq(locations.orgId, orgId), eq(locations.active, true))).orderBy(asc(locations.name)),
    db.select().from(services).where(and(eq(services.orgId, orgId), eq(services.active, true))).orderBy(asc(services.sortOrder)),
  ]);
  const [links, roomRows] = await Promise.all([
    pracs.length ? db.select().from(practitionerServices).where(inArray(practitionerServices.practitionerId, pracs.map((p) => p.id))) : [],
    locs.length ? db.select().from(rooms).where(and(inArray(rooms.locationId, locs.map((l) => l.id)), eq(rooms.active, true))).orderBy(asc(rooms.name)) : [],
  ]);
  return {
    timezone,
    practitioners: pracs.map((p) => ({
      id: p.id,
      name: practitionerName(p),
      color: p.color,
      serviceIds: links.filter((l) => l.practitionerId === p.id).map((l) => l.serviceId),
    })),
    locations: locs.map((l) => ({ id: l.id, name: l.name, timezone: l.timezone })),
    // Grouped by office (offices are already sorted by name), then chair name.
    rooms: locs.flatMap((l) => roomRows.filter((r) => r.locationId === l.id).map((r) => ({ id: r.id, name: r.name, locationId: r.locationId }))),
    services: svcs.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes })),
  };
}

export async function listAppointments(
  orgId: string,
  opts: {
    from?: Date;
    to?: Date;
    locationId?: string;
    practitionerIds?: string[];
    statuses?: AppointmentStatus[];
    includeCancelled?: boolean;
    patientId?: string;
    needsAttention?: boolean;
    order?: "asc" | "desc";
    limit?: number;
  } = {},
): Promise<ApptDTO[]> {
  const conditions: SQL[] = [eq(appointments.orgId, orgId)];
  if (opts.from) conditions.push(gte(appointments.startsAt, opts.from));
  if (opts.to) conditions.push(lt(appointments.startsAt, opts.to));
  if (opts.locationId) conditions.push(eq(appointments.locationId, opts.locationId));
  if (opts.practitionerIds?.length) conditions.push(inArray(appointments.practitionerId, opts.practitionerIds));
  if (opts.statuses?.length) conditions.push(inArray(appointments.status, opts.statuses));
  else if (!opts.includeCancelled) conditions.push(ne(appointments.status, "cancelled"));
  if (opts.patientId) conditions.push(eq(appointments.patientId, opts.patientId));
  if (opts.needsAttention) conditions.push(eq(appointments.needsAttention, true));

  const query = db
    .select({ a: appointments, patient: patients, service: services, practitioner: practitioners, location: locations, room: rooms })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .leftJoin(rooms, eq(rooms.id, appointments.roomId))
    .where(and(...conditions))
    .orderBy(opts.order === "desc" ? desc(appointments.startsAt) : asc(appointments.startsAt));
  const rows = opts.limit ? await query.limit(opts.limit) : await query;

  return rows.map(({ a, patient, service, practitioner, location, room }) => ({
    id: a.id,
    start: a.startsAt.toISOString(),
    end: a.endsAt.toISOString(),
    blockedUntil: a.blockedUntil.toISOString(),
    status: a.status,
    confirmation: a.confirmation,
    confirmedVia: a.confirmedVia,
    needsAttention: a.needsAttention,
    source: a.source,
    isNewPatient: a.isNewPatient,
    patientNote: a.patientNote,
    internalNote: a.internalNote,
    cancelReason: a.cancelReason,
    manageToken: a.manageToken,
    patient: {
      id: patient.id,
      name: fullName(patient),
      phone: patient.phone,
      email: patient.email,
      noShowCount: patient.noShowCount,
      preferredChannel: patient.preferredChannel,
    },
    service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes },
    practitioner: { id: practitioner.id, name: practitionerName(practitioner), color: practitioner.color },
    location: { id: location.id, name: location.name, timezone: location.timezone },
    room: room ? { id: room.id, name: room.name } : null,
  }));
}
