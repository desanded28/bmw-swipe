"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { useRunAction } from "../dashboard/useRunAction";

/** The ActionResult code for "re-authenticate first" (src/lib/security/errors.ts; not imported: server code). */
export const STEP_UP_CODE = "step_up_required";

/**
 * useRunAction() for sensitive actions: when the server answers step_up_required, the user is
 * taken to the re-authentication page, which brings them back here afterwards.
 */
export function useSecureAction() {
  const { run, pending } = useRunAction();
  const router = useRouter();
  const pathname = usePathname();
  const secureRun = (fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) =>
    run(fn, (r) => {
      if (!r.ok && r.code === STEP_UP_CODE) {
        router.push(`/dashboard/account/security/verify?next=${encodeURIComponent(pathname)}`);
        return;
      }
      after?.(r);
    });
  return { run: secureRun, pending };
}
