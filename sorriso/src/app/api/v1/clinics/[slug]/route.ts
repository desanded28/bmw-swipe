import { apiError, json, limitByIp, preflight } from "@/lib/api";
import { getPublicClinic } from "@/lib/directory";

export const OPTIONS = preflight;

/** GET /api/v1/clinics/:slug — practice profile, offices, practitioners and bookable services. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await limitByIp(req, "clinic", 120, 60_000);
  if (limited) return limited;
  const { slug } = await params;
  const clinic = await getPublicClinic(slug);
  if (!clinic) return apiError(404, "not_found", "Clinic not found.");
  return json(clinic);
}
