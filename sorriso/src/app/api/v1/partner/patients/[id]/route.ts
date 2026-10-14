import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { apiError, json, partnerRoute, rateLimited, type ApiAuth } from "@/lib/api";
import { ErasureError, erasePatient } from "@/lib/privacy/erasure";
import { getPrivacy } from "@/lib/privacy/settings";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Partner API: one patient's data protection state, and erasure on the practice's instruction.
 *
 * GET    /api/v1/partner/patients/:id   (patients:read)
 *   { patient: { id, restricted, erased, retainUntil } } — lets integrations honour a
 *   restriction or erasure in their own copy (Art. 19 GDPR: recipients are told).
 *
 * DELETE /api/v1/partner/patients/:id   (patients:erase)
 *   Erases the patient the way the practice chose in its privacy settings (erasureDefault):
 *   pseudonymise, or restrict until `retainUntil` (body { "retainUntil": "YYYY-MM-DD",
 *   "reason": "…" }, required when the practice restricts). Audited as patient.erase /
 *   patient.restrict with the API key as actor.
 *
 * Both go through partnerRoute (WP6): the key's IP allow-list and expiry (403 ip_not_allowed, 401
 * otherwise), the per-key rate limit (429), the scope check, no CORS, and an api.request row in
 * the practice's access log. Erasure has its own, much lower limit per key (ERASE_RATE), so a
 * leaked key can't pseudonymise the patient list in a loop.
 */

type Ctx = { params: Promise<{ id: string }> };

/** Erasures per API key: 30 an hour. */
export const ERASE_RATE = { limit: 30, windowMs: 60 * 60_000 };

const ERASURE_STATUS: Partial<Record<ErasureError["code"], number>> = {
  not_found: 404,
  already_erased: 409,
  forms_not_exported: 409,
};

/** Server-to-server only: never cached. */
function noStore(res: Response): Response {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function load(orgId: string, id: string) {
  const [p] = await db
    .select({ id: patients.id, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt, retainUntil: patients.retainUntil })
    .from(patients)
    .where(and(eq(patients.orgId, orgId), eq(patients.id, id)));
  return p ?? null;
}

const view = (p: NonNullable<Awaited<ReturnType<typeof load>>>) => ({
  id: p.id,
  restricted: Boolean(p.restrictedAt),
  erased: Boolean(p.erasedAt),
  retainUntil: p.retainUntil,
});

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return noStore(
    await partnerRoute(req, "patients:read", "partner.patients", async (auth) => {
      const p = await load(auth.org.id, id);
      return p ? json({ patient: view(p) }) : apiError(404, "not_found", "Patient not found.");
    }),
  );
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  return noStore(await partnerRoute(req, "patients:erase", "partner.patients", (auth) => erase(req, auth, id)));
}

async function erase(req: Request, auth: ApiAuth, id: string): Promise<Response> {
  const limit = await rateLimit(`partner-erase:${auth.key.id}`, ERASE_RATE.limit, ERASE_RATE.windowMs);
  if (!limit.ok) return rateLimited(limit.retryAfterSec);
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown; retainUntil?: unknown };
  const mode = getPrivacy(auth.org).erasureDefault;
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.slice(0, 500) : "Erasure requested through the partner API";
  try {
    const res = await erasePatient(auth.org.id, id, {
      mode,
      reason,
      retainUntil: typeof body.retainUntil === "string" ? body.retainUntil : null,
      actor: { type: "api_key", id: auth.key.id },
      headers: req.headers,
    });
    const p = await load(auth.org.id, id);
    return json({ patient: p ? view(p) : { id }, mode: res.mode });
  } catch (err) {
    if (err instanceof ErasureError) return apiError(ERASURE_STATUS[err.code] ?? 422, err.code, `Erasure refused: ${err.code}.`);
    throw err;
  }
}
