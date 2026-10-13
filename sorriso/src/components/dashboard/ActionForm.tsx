"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/app/dashboard/actions";
import { Button } from "../ui";

type Action = (prev: unknown, formData: FormData) => Promise<ActionResult>;

/** A <form> bound to a server action that shows its success / error message inline. */
export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Save",
  footer,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  footer?: React.ReactNode;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} />
        {footer}
        {state ? (
          state.ok ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CircleCheck size={16} /> {state.message ?? "Saved."}
            </span>
          ) : (
            <span className="text-sm font-medium text-red-600">{state.error}</span>
          )
        ) : null}
      </div>
    </form>
  );
}

export function SubmitButton({ label, variant = "primary" }: { label: string; variant?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? <LoaderCircle size={16} className="animate-spin" /> : null}
      {label}
    </Button>
  );
}
