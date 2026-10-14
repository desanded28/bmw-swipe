"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useId } from "react";
import { Button, Textarea } from "../ui";

export type TextActionState = { ok?: boolean; error?: string; message?: string } | null;

/**
 * A one-field form bound to a server action (the author's reply to the moderators, an appeal):
 * a labelled textarea, the error announced, and the success message in place of the form.
 */
export function TextActionForm({
  action,
  name,
  label,
  hint,
  submitLabel,
  maxLength = 2000,
  rows = 4,
}: {
  action: (prev: TextActionState, formData: FormData) => Promise<TextActionState>;
  name: string;
  label: string;
  hint?: string;
  submitLabel: string;
  maxLength?: number;
  rows?: number;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const id = useId();
  if (state?.ok) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
        <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden /> {state.message}
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor={`${id}text`} className="block text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      <Textarea
        id={`${id}text`}
        name={name}
        rows={rows}
        maxLength={maxLength}
        required
        aria-describedby={[hint ? `${id}hint` : null, state?.error ? `${id}error` : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={state?.error ? true : undefined}
      />
      {hint ? (
        <p id={`${id}hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {state?.error ? (
        <p id={`${id}error`} role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
