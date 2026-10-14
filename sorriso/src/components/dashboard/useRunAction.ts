"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { useT } from "@/i18n/provider";
import { useToast } from "./Toast";

/**
 * Run a server action with toast feedback and refresh the page data. [frozen]
 *
 *   const { run, pending } = useRunAction();
 *   run(() => saveThing(id), (r) => r.ok && close());
 *
 * The toast shows the action's message (or common.feedback.done, "Done.") on success and its
 * error otherwise; `after` runs last with the result either way. Needs the dashboard's
 * I18nProvider (the dashboard layout loads every client namespace, `common` included).
 */
export function useRunAction() {
  const router = useRouter();
  const toast = useToast();
  const t = useT("common");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) =>
    start(async () => {
      const res = await fn();
      toast.show(res.ok ? { tone: "success", text: res.message ?? t("feedback.done") } : { tone: "error", text: res.error });
      if (res.ok) router.refresh();
      after?.(res);
    });
  return { run, pending };
}
