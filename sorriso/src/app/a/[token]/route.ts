import type { NextRequest } from "next/server";
import { legacyRedirect } from "../legacy-redirect";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return legacyRedirect(req, (await params).token);
}
