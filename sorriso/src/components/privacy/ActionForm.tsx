"use client";

import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, cx } from "../ui";

/** What the privacy-center actions answer: a translated message for the form that sent them. */
export type PrivacyFormState = { ok: boolean; message: string } | null;

export type PrivacyAction<S extends PrivacyFormState = PrivacyFormState> = (prev: S, fd: FormData) => Promise<S>;

type ButtonProps = { label: ReactNode; pending: string; variant?: "primary" | "secondary" | "ghost" | "danger" | "subtle"; size?: "sm" | "md" | "lg"; className?: string };

/** A submit button that shows progress and keeps focus while the action runs (aria-disabled, not disabled). */
export function SubmitButton({ label, pending, variant = "primary", size = "md", className }: ButtonProps) {
  const status = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      aria-disabled={status.pending || undefined}
      onClick={(e) => {
        if (status.pending) e.preventDefault();
      }}
      className={cx("aria-disabled:opacity-60", className)}
    >
      {status.pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
      {status.pending ? pending : label}
    </Button>
  );
}

/** The outcome of an action, announced politely (a live region that is always in the page). */
export function FormMessage({ state, id }: { state: PrivacyFormState; id?: string }) {
  return (
    <p id={id} aria-live="polite" className={cx("text-sm font-medium", !state && "sr-only")}>
      {state ? (
        <span className={cx("inline-flex items-start gap-1.5", state.ok ? "text-emerald-700" : "text-red-700")}>
          {state.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />}
          {state.message}
        </span>
      ) : null}
    </p>
  );
}

/**
 * A form posting to a privacy-center server action, with hidden fields, the fields given as
 * children (rendered on the server), a submit button and the action's answer. Works without
 * JavaScript too (progressive enhancement: the action runs as a normal form post).
 */
export function ActionForm({
  action,
  hidden,
  children,
  submit,
  className,
  confirmText,
}: {
  action: PrivacyAction;
  hidden?: Record<string, string>;
  children?: ReactNode;
  submit: ButtonProps;
  className?: string;
  /** Ask before submitting (an irreversible step, such as deleting a review). */
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={cx("space-y-3", className)}
      onSubmit={confirmText ? (e) => (window.confirm(confirmText) ? undefined : e.preventDefault()) : undefined}
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton {...submit} />
        <FormMessage state={state} />
      </div>
    </form>
  );
}
