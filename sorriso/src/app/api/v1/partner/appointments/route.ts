import { and, asc, eq, gte, lt, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { APPOINTMENT_STATUSES, appointments } from "@/db/schema";
import { apiError, authenticateApiKey, handleApiError, json, preflight } from "@/lib/api";
import { getAppointmentDetails } from "@/lib/appointments";
import { createAppointment } from "@/lib/booking";
import { partnerAppointment } from "@/lib/serializers";
import { patientInputSchema } from "@/lib/validation";

export const OPTIONS = preflight;

/**
 * GET /api/v1/partner/appointments?from=ISO&to=ISO&status=&locationId=&practitionerId=&updatedSince=ISO
 * Lists the practice's appointments (max 500). Use updatedSince for incremental sync.
 */
export async function GET(req: Request) {
  const org = await authenticateApiKey(req);
  if (!org) return apiError(401, "unauthorized", "Missing or invalid API key.");
  const p = new URL(req.url).searchParams;
  const conditions: SQL[] = [eq(appointments.orgId, org.id)];
  const date = (k: string) => {
    const v = p.get(k);
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };
  const from = date("from");
  const to = date("to");
  const updatedSince = date("updatedSince");
  if (from) conditions.push(gte(appointments.startsAt, from));
  if (to) conditions.push(lt(appointments.startsAt, to));
  if (updatedSince) conditions.push(gte(appointments.updatedAt, updatedSince));
  const status = p.get("status");
  if (status && (APPOINTMENT_STATUSES as readonly string[]).includes(status))
    conditions.push(eq(appointments.status, status as (typeof APPOINTMENT_STATUSES)[number]));
  if (p.get("locationId")) conditions.push(eq(appointments.locationId, p.get("locationId")!));
  if (p.get("practitionerId")) conditions.push(eq(appointments.practitionerId, p.get("practitionerId")!));

  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(...conditions))
    .orderBy(asc(appointments.startsAt))
    .limit(500);
  const details = await Promise.all(rows.map((r) => getAppointmentDetails({ id: r.id })));
  return json({ appointments: details.filter(Boolean).map((d) => partnerAppointment(d!)) });
}

const partnerBookingSchema = z.object({
  serviceId: z.string(),
  practitionerId: z.string(),
  locationId: z.string(),
  start: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  patient: z.union([z.object({ id: z.string() }), patientInputSchema]),
  patientNote: z.string().max(1000).optional(),
  internalNote: z.string().max(2000).optional(),
  /** Book even outside working hours / with conflicts (like the front desk can). */
  force: z.boolean().optional(),
  notifyPatient: z.boolean().optional(),
});

/** POST /api/v1/partner/appointments — create an appointment with front-desk powers. */
export async function POST(req: Request) {
  try {
    const org = await authenticateApiKey(req);
    if (!org) return apiError(401, "unauthorized", "Missing or invalid API key.");
    const input = partnerBookingSchema.parse(await req.json());
    const details = await createAppointment({
      orgId: org.id,
      serviceId: input.serviceId,
      practitionerId: input.practitionerId,
      locationId: input.locationId,
      startsAt: new Date(input.start),
      durationMinutes: input.durationMinutes,
      patient:
        "id" in input.patient
          ? input.patient
          : { ...input.patient, email: input.patient.email || null, phone: input.patient.phone || null },
      patientNote: input.patientNote,
      internalNote: input.internalNote,
      source: "api",
      online: false,
      force: input.force,
      notifyPatient: input.notifyPatient ?? true,
    });
    return json({ appointment: partnerAppointment(details) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
