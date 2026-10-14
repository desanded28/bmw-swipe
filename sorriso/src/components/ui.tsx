import clsx from "clsx";
import Link from "next/link";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { APP_NAME } from "@/lib/config";
import { initials } from "@/lib/format";

export { clsx as cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 shadow-sm disabled:bg-brand-700/50",
  secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:ring-slate-300",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50",
  subtle: "bg-brand-50 text-brand-800 hover:bg-brand-100",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70", className)} {...props} />;
}

type Tone = "slate" | "green" | "amber" | "red" | "blue" | "violet" | "brand";
const tones: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
};

export function Badge({ tone = "slate", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/*
 * Form controls: the boundary (ring-line-strong) is 3.6:1 against white, the placeholder (slate-500)
 * 4.7:1, the focus ring (brand-600) 4.8:1. See docs/accessibility.md.
 */
const field =
  "block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm ring-1 ring-inset ring-line-strong placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-brand-600 focus:outline-none disabled:bg-slate-50 aria-[invalid=true]:ring-red-600";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(field, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(field, "min-h-20", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(field, "pr-8", className)} {...props} />;
}

/** What Field wires into its control: the id its label points at, plus the hint and error to announce. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

type ControlElementProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: unknown };

const CONTROL_TYPES: unknown[] = ["input", "select", "textarea", Input, Select, Textarea];

/** A single form control Field can wire up by cloning it (anything else keeps the legacy wrapping label). */
function isControl(node: ReactNode): node is ReactElement<ControlElementProps> {
  return isValidElement(node) && CONTROL_TYPES.includes(node.type);
}

/**
 * A labelled form control. The label points at the control (htmlFor), and the hint and error are
 * linked to it with aria-describedby, the error also with aria-invalid, so a screen reader reads all
 * three on focus. Hint and error sit outside the label: the accessible name stays the label alone.
 *
 * The id is `id`, else the child's own id, else a generated one. The child gets it by cloning when
 * it is a single <Input>, <Select>, <Textarea> or native control. For a composite control (a
 * country-code select next to a number), pass a function: it receives the props to spread on the
 * element the label names. Any other children keep the legacy behaviour (wrapped in the label).
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  id,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode | ((control: FieldControlProps) => ReactNode);
  className?: string;
  /** The control's id; generated when omitted. */
  id?: string;
}) {
  const generated = useId();
  const only = typeof children === "function" ? null : Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  const child = isControl(only) ? only : null;
  const controlId = id ?? child?.props.id ?? `${generated}control`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [child?.props["aria-describedby"], error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");
  const control: FieldControlProps = {
    id: controlId,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(error ? { "aria-invalid": true as const } : {}),
  };
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-slate-700";
  const notes = (
    <>
      {hint ? (
        <span id={hintId} className="mt-1 block text-xs text-slate-500">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      ) : null}
    </>
  );

  if (typeof children === "function" || child) {
    return (
      <div className={clsx("block", className)}>
        <label htmlFor={controlId} className={labelClass}>
          {label}
        </label>
        {typeof children === "function" ? children(control) : cloneElement(child!, control)}
        {notes}
      </div>
    );
  }
  // Legacy: arbitrary children, labelled by the wrapping <label> (implicit association).
  return (
    <div className={clsx("block", className)}>
      <label className="block">
        <span className={labelClass}>{label}</span>
        {children}
      </label>
      {notes}
    </div>
  );
}

export function Avatar({
  name,
  color = "#0c675d",
  size = 48,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #0b1324))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/**
 * A star rating drawn as one image. Pass `label`, the localised reading of the rating (for example
 * t("rating.stars", { rating }) from the a11y namespace): it is what screen readers announce. Without
 * it the label falls back to a language-neutral "4.5/5" (kept optional only for existing callers).
 */
export function Stars({
  value,
  size = 14,
  className,
  label,
}: {
  value: number;
  size?: number;
  className?: string;
  label?: string;
}) {
  const uid = useId();
  return (
    <span role="img" aria-label={label ?? `${value.toFixed(1)}/5`} className={clsx("inline-flex", className)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        const gradient = `${uid}star${i}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden focusable="false">
            <defs>
              <linearGradient id={gradient}>
                <stop offset={`${fill * 100}%`} stopColor="#f59e0b" />
                <stop offset={`${fill * 100}%`} stopColor="#cbd5e1" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#${gradient})`}
              d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.8L10 1.5z"
            />
          </svg>
        );
      })}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      {icon ? (
        <div className="mb-3 text-slate-500" aria-hidden>
          {icon}
        </div>
      ) : null}
      <p className="font-semibold text-slate-800">{title}</p>
      {children ? <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-extrabold tracking-tight text-ink", className)}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#0c675d" />
        <path d="M8 13.5c0-2.5 2-4.5 4.4-4.5 1.4 0 2.4.6 3.6.6s2.2-.6 3.6-.6C22 9 24 11 24 13.5c0 3-1.3 4.6-2 7.5-.5 2-1 3-2 3-1.7 0-1.5-5-4-5s-2.3 5-4 5c-1 0-1.5-1-2-3-.7-2.9-2-4.5-2-7.5z" fill="#fff" />
        <path d="M11.5 14.5c1.2 1.3 2.8 2 4.5 2s3.3-.7 4.5-2" stroke="#0c675d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
      <span className="text-lg">{APP_NAME}</span>
    </span>
  );
}
