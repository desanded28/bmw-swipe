import type { NextRequest } from "next/server";
import { legacyRedirect } from "../../legacy-redirect";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; rest: string[] }> }) {
  const { token, rest } = await params;
  return legacyRedirect(req, token, rest);
}
