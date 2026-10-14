import { createHash } from "node:crypto";
import type { Appointment, AppointmentStatus, Location, Organization, Patient, Practitioner, Service } from "@/db/schema";

/**
 * FHIR R4 (4.0.1) export of a patient's or a practice's booking data, for portability
 * (Art. 20) and switching providers (EU Data Act ch. VI). A `collection` Bundle with
 * Organization, Location, Practitioner, Patient and Appointment resources.
 *
 * References use deterministic urn:uuid fullUrls (a v5-style hash of the resource type and the
 * Sorriso id), so the same record always gets the same reference across exports and a receiving
 * system can de-duplicate. Every resource also carries the Sorriso id as an identifier.
 *
 * Only booking data is mapped: clinical findings are not part of Sorriso (the practice keeps the
 * clinical record), and free-text notes are left out of FHIR (they are in patient.json).
 */

export const FHIR_ID_SYSTEM = "urn:sorriso:id";

type Resource = { resourceType: string; id: string } & Record<string, unknown>;
export type FhirBundle = {
  resourceType: "Bundle";
  type: "collection";
  timestamp: string;
  meta: { profile?: string[]; tag: { system: string; code: string }[] };
  entry: { fullUrl: string; resource: Resource }[];
};

/** A stable UUID (RFC 4122 layout, version 5 bits) from the resource type and id. */
export function fhirUuid(type: string, id: string): string {
  const h = createHash("sha256").update(`sorriso:${type}/${id}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const fhirRef = (type: string, id: string) => `urn:uuid:${fhirUuid(type, id)}`;

/** Appointment.status: http://hl7.org/fhir/R4/valueset-appointmentstatus.html */
export const FHIR_APPOINTMENT_STATUS: Record<AppointmentStatus, string> = {
  requested: "proposed",
  scheduled: "booked",
  completed: "fulfilled",
  no_show: "noshow",
  cancelled: "cancelled",
};

const identifier = (id: string) => [{ system: FHIR_ID_SYSTEM, value: id }];

export type FhirPatientInput = Pick<
  Patient,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "birthDate"
  | "locale"
  | "guardianName"
  | "guardianRelation"
  | "guardianPhone"
  | "guardianEmail"
  | "erasedAt"
>;

export function patientResource(p: FhirPatientInput): Resource {
  const telecom = [
    ...(p.phone ? [{ system: "phone", value: p.phone, use: "mobile" }] : []),
    ...(p.email ? [{ system: "email", value: p.email }] : []),
  ];
  const guardianTelecom = [
    ...(p.guardianPhone ? [{ system: "phone", value: p.guardianPhone }] : []),
    ...(p.guardianEmail ? [{ system: "email", value: p.guardianEmail }] : []),
  ];
  return {
    resourceType: "Patient",
    id: fhirUuid("Patient", p.id),
    identifier: identifier(p.id),
    active: !p.erasedAt,
    name: [{ use: "official", family: p.lastName, given: [p.firstName] }],
    ...(telecom.length ? { telecom } : {}),
    ...(p.birthDate ? { birthDate: p.birthDate } : {}),
    communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: p.locale }] }, preferred: true }],
    ...(p.guardianName || guardianTelecom.length
      ? {
          contact: [
            {
              // HL7 v2 table 0131: N = next of kin / guardian.
              relationship: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0131", code: "N" }], text: p.guardianRelation ?? "guardian" }],
              ...(p.guardianName ? { name: { text: p.guardianName } } : {}),
              ...(guardianTelecom.length ? { telecom: guardianTelecom } : {}),
            },
          ],
        }
      : {}),
  };
}

export function practitionerResource(p: Pick<Practitioner, "id" | "title" | "name" | "specialty" | "licenseNumber" | "alboProvince" | "alboNumber">): Resource {
  return {
    resourceType: "Practitioner",
    id: fhirUuid("Practitioner", p.id),
    identifier: [
      ...identifier(p.id),
      ...(p.alboNumber ? [{ system: "urn:it:fnomceo:albo-odontoiatri", value: `${p.alboProvince ?? ""}${p.alboProvince ? "-" : ""}${p.alboNumber}` }] : []),
    ],
    name: [{ text: `${p.title} ${p.name}`.trim(), prefix: p.title ? [p.title] : undefined }],
    qualification: p.specialty ? [{ code: { text: p.specialty } }] : undefined,
  };
}

export function organizationResource(o: Pick<Organization, "id" | "name" | "legalName" | "vatNumber" | "phone" | "email" | "website">): Resource {
  const telecom = [
    ...(o.phone ? [{ system: "phone", value: o.phone }] : []),
    ...(o.email ? [{ system: "email", value: o.email }] : []),
    ...(o.website ? [{ system: "url", value: o.website }] : []),
  ];
  return {
    resourceType: "Organization",
    id: fhirUuid("Organization", o.id),
    identifier: [...identifier(o.id), ...(o.vatNumber ? [{ system: "urn:it:partita-iva", value: o.vatNumber }] : [])],
    active: true,
    name: o.legalName ?? o.name,
    ...(o.legalName && o.legalName !== o.name ? { alias: [o.name] } : {}),
    ...(telecom.length ? { telecom } : {}),
  };
}

export function locationResource(l: Pick<Location, "id" | "orgId" | "name" | "address" | "city" | "postalCode" | "phone">): Resource {
  return {
    resourceType: "Location",
    id: fhirUuid("Location", l.id),
    identifier: identifier(l.id),
    name: l.name,
    address: { line: [l.address], city: l.city, ...(l.postalCode ? { postalCode: l.postalCode } : {}), country: "IT" },
    ...(l.phone ? { telecom: [{ system: "phone", value: l.phone }] } : {}),
    managingOrganization: { reference: fhirRef("Organization", l.orgId) },
  };
}

export type FhirAppointmentInput = Pick<
  Appointment,
  "id" | "status" | "startsAt" | "endsAt" | "createdAt" | "patientId" | "practitionerId" | "locationId" | "confirmation"
> & { service: Pick<Service, "id" | "name" | "category"> | null };

export function appointmentResource(a: FhirAppointmentInput): Resource {
  const minutes = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);
  const patientStatus = a.confirmation === "declined" ? "declined" : a.confirmation === "confirmed" ? "accepted" : "needs-action";
  return {
    resourceType: "Appointment",
    id: fhirUuid("Appointment", a.id),
    identifier: identifier(a.id),
    status: FHIR_APPOINTMENT_STATUS[a.status],
    ...(a.service ? { serviceType: [{ coding: [{ system: "urn:sorriso:service-category", code: a.service.category }], text: a.service.name }] } : {}),
    start: a.startsAt.toISOString(),
    end: a.endsAt.toISOString(),
    minutesDuration: minutes,
    created: a.createdAt.toISOString(),
    participant: [
      { actor: { reference: fhirRef("Patient", a.patientId) }, required: "required", status: patientStatus },
      { actor: { reference: fhirRef("Practitioner", a.practitionerId) }, required: "required", status: "accepted" },
      { actor: { reference: fhirRef("Location", a.locationId) }, required: "information-only", status: "accepted" },
    ],
  };
}

/** Assemble a collection Bundle. Resources with the same type and id are included once. */
export function fhirBundle(
  parts: {
    organization?: Parameters<typeof organizationResource>[0] | null;
    locations?: Parameters<typeof locationResource>[0][];
    practitioners?: Parameters<typeof practitionerResource>[0][];
    patients?: FhirPatientInput[];
    appointments?: FhirAppointmentInput[];
  },
  now: Date = new Date(),
): FhirBundle {
  const seen = new Set<string>();
  const entry: FhirBundle["entry"] = [];
  const add = (r: Resource) => {
    const key = `${r.resourceType}/${r.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    entry.push({ fullUrl: `urn:uuid:${r.id}`, resource: r });
  };
  if (parts.organization) add(organizationResource(parts.organization));
  for (const l of parts.locations ?? []) add(locationResource(l));
  for (const p of parts.practitioners ?? []) add(practitionerResource(p));
  for (const p of parts.patients ?? []) add(patientResource(p));
  for (const a of parts.appointments ?? []) add(appointmentResource(a));
  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: now.toISOString(),
    meta: { tag: [{ system: "urn:sorriso:export", code: "booking-data" }] },
    entry,
  };
}
