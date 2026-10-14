"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { useT } from "@/i18n/provider";
import { Button } from "../ui";

type Action = (prev: unknown, formData: FormData) => Promise<ActionResult>;

/**
 * A <form> bound to a server action that shows its success / error message inline (in a polite
 * live region, so screen readers hear the outcome). The action's messages are already localised.
 */
export function ActionForm({
  action,
  children,
  className,
  submitLabel,
  footer,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  /** Defaults to common.actions.save. */
  submitLabel?: string;
  footer?: React.ReactNode;
}) {
  const tc = useT("common");
  const t = useT("dashboard");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel ?? tc("actions.save")} />
        {footer}
        <span aria-live="polite" className="contents">
          {state ? (
            state.ok ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CircleCheck size={16} aria-hidden /> {state.message ?? t("form.saved")}
              </span>
            ) : (
              <span className="text-sm font-medium text-red-700">{state.error}</span>
            )
          ) : null}
        </span>
      </div>
    </form>
  );
}

export function SubmitButton({ label, variant = "primary" }: { label: string; variant?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}
