import { apiError, json, preflight } from "@/lib/api";
import { getPublicClinic } from "@/lib/directory";

export const OPTIONS = preflight;

/** GET /api/v1/clinics/:slug — practice profile, offices, practitioners and bookable services. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getPublicClinic(slug);
  if (!clinic) return apiError(404, "not_found", "Clinic not found.");
  return json(clinic);
}
