import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { apiError, authenticateApiKey, handleApiError, json, requireScope, type ApiAuth } from "@/lib/api";
import { audit } from "@/lib/audit";
import { ErasureError, erasePatient } from "@/lib/privacy/erasure";
import { getPrivacy } from "@/lib/privacy/settings";

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
 */

type Ctx = { params: Promise<{ id: string }> };

/** Server-to-server only: no CORS headers, never cached; every call is in the practice's access log. */
async function finish(req: Request, auth: ApiAuth | null, res: Response): Promise<Response> {
  for (const name of [...res.headers.keys()]) if (name.toLowerCase().startsWith("access-control-")) res.headers.delete(name);
  res.headers.set("Cache-Control", "no-store");
  if (auth) {
    await audit({
      orgId: auth.org.id,
      actor: { type: "api_key", id: auth.key.id },
      action: "api.request",
      entity: { type: "api_key", id: auth.key.id },
      metadata: { method: req.method, route: "partner.patients", status: res.status },
      headers: req.headers,
    });
  }
  return res;
}

const ERASURE_STATUS: Partial<Record<ErasureError["code"], number>> = {
  not_found: 404,
  already_erased: 409,
  forms_not_exported: 409,
};

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
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return finish(req, null, apiError(401, "unauthorized", "Missing or invalid API key."));
  const denied = requireScope(auth, "patients:read");
  if (denied) return finish(req, auth, denied);
  try {
    const p = await load(auth.org.id, (await params).id);
    return finish(req, auth, p ? json({ patient: view(p) }) : apiError(404, "not_found", "Patient not found."));
  } catch (err) {
    return finish(req, auth, handleApiError(err));
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return finish(req, null, apiError(401, "unauthorized", "Missing or invalid API key."));
  const denied = requireScope(auth, "patients:erase");
  if (denied) return finish(req, auth, denied);
  return finish(req, auth, await erase(req, auth, (await params).id));
}

async function erase(req: Request, auth: ApiAuth, id: string): Promise<Response> {
  try {
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
      if (err instanceof ErasureError) {
        return apiError(ERASURE_STATUS[err.code] ?? 422, err.code, `Erasure refused: ${err.code}.`);
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
