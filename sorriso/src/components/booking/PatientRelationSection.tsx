"use client";

import { Baby, Info, User, Users } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { BOOKED_FOR, GUARDIAN_RELATIONS, type BookedFor } from "@/db/enums";
import { useT } from "@/i18n/provider";
import { ageBand, OTHER_ADULT_ON_MARKETPLACE, relationFormIssue } from "@/lib/privacy/minors";
import { Field, Input, cx } from "../ui";
import type { PatientRelationSectionProps, RelationState } from "./contracts";

const ICONS: Record<BookedFor, typeof User> = { self: User, minor: Baby, other_adult: Users };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LocalField = "guardian.name" | "guardian.phone" | "guardian.email" | "bookedBy.name" | "bookedBy.email";

/**
 * "Who is this appointment for? Me / A minor / Another adult" (WP4), with the details each answer
 * needs:
 * - Me: nothing more. Live hints from the birth date typed below: under 14 a guardian must book
 *   (the server answers guardian_required), from 14 to 17 the notice for young people applies.
 * - A minor: the patient fields below are the child's (birth date required); here the parent or
 *   legal guardian gives their name, relation and the contact the child's messages go to.
 * - Another adult: the patient fields below are the adult's own; here the booker gives their name
 *   and, optionally, a contact. It is stored with the appointment only (booked_by_*), never as the
 *   patient's contact. On Sorriso's search pages only the adult can give the Art. 9 consent, so
 *   (otherAdultNote, explained up front when the form passes `context` and `variant`) a booking is
 *   held until they confirm it at their own contact (OTHER_ADULT_ON_MARKETPLACE "held"; without one
 *   of their own the server answers other_adult_contact_required), and a waitlist entry, which has
 *   no hold, is refused (other_adult_must_book_themselves, shown on the group).
 *
 * "Me" is preselected and reported once on mount (PatientRelationSectionProps: a section that
 * preselects an answer must report it), so the server checks the under-14 rule for every booking.
 * Fields are checked as they are left (required name, a contact, the email's shape); the server's
 * answers arrive in `errors` and win.
 */
export function PatientRelationSection({ value, onChange, birthDate, errors, context, variant }: PatientRelationSectionProps) {
  const t = useT("privacy");
  const te = useT("errors");
  const id = useId();
  const [touched, setTouched] = useState<Partial<Record<LocalField, boolean>>>({});
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    onChange(value);
    // Report the preselected answer once; later changes are reported by the controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<RelationState>) => onChange({ ...value, ...patch });
  const setGuardian = (patch: Partial<RelationState["guardian"]>) => set({ guardian: { ...value.guardian, ...patch } });
  const setBookedBy = (patch: Partial<RelationState["bookedBy"]>) => set({ bookedBy: { ...value.bookedBy, ...patch } });
  const touch = (f: LocalField) => setTouched((s) => (s[f] ? s : { ...s, [f]: true }));

  const band = ageBand(birthDate);
  const issue = relationFormIssue(
    { bookedFor: value.bookedFor, guardian: { ...value.guardian, phone: value.guardian.phone || null, email: value.guardian.email || null } },
    birthDate,
  );
  const g = value.guardian;
  const b = value.bookedBy;
  const local: Partial<Record<LocalField, string>> = {
    "guardian.name": g.name.trim().length < 2 ? t("relation.errors.nameRequired") : undefined,
    "guardian.phone": !g.phone.trim() && !g.email.trim() ? t("relation.errors.contactRequired") : undefined,
    "guardian.email": g.email.trim() && !EMAIL.test(g.email.trim()) ? te("fields.invalidEmail") : undefined,
    "bookedBy.name": b.name.trim().length < 2 ? t("relation.errors.nameRequired") : undefined,
    "bookedBy.email": b.email.trim() && !EMAIL.test(b.email.trim()) ? te("fields.invalidEmail") : undefined,
  };
  const err = (f: LocalField) => errors[f] ?? (touched[f] ? local[f] : undefined);
  const groupError = errors.bookedFor;
  const otherNote = otherAdultNote(context, variant, Boolean(groupError));

  return (
    <fieldset className="space-y-3">
      <legend id={`${id}legend`} className="mb-2 text-[13px] font-semibold text-slate-700">
        {t("relation.legend")}
      </legend>
      {/* The group carries the error, so the form's focusFirstInvalid() can land on it. */}
      <div
        role="radiogroup"
        aria-labelledby={`${id}legend`}
        aria-invalid={groupError ? true : undefined}
        aria-describedby={groupError ? `${id}error` : undefined}
        tabIndex={-1}
        className="grid grid-cols-1 gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:grid-cols-3"
      >
        {BOOKED_FOR.map((option) => {
          const Icon = ICONS[option];
          const checked = value.bookedFor === option;
          return (
            <label
              key={option}
              className={cx(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition sm:flex-col sm:items-start sm:gap-1",
                "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600",
                checked ? "bg-brand-50 ring-2 ring-brand-600" : "bg-white ring-line-strong hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name={`${id}bookedFor`}
                value={option}
                checked={checked}
                onChange={() => set({ bookedFor: option })}
                className="sr-only"
              />
              <Icon size={18} className={checked ? "text-brand-700" : "text-slate-500"} aria-hidden />
              <span>
                <span className={cx("block text-sm font-semibold", checked ? "text-brand-800" : "text-slate-800")}>{t(`relation.options.${option}`)}</span>
                <span className="block text-xs text-slate-500">{t(`relation.hints.${option}`)}</span>
              </span>
            </label>
          );
        })}
      </div>
      {groupError ? (
        <p id={`${id}error`} className="text-xs font-medium text-red-600">
          {groupError}
        </p>
      ) : null}

      <div aria-live="polite" className="space-y-3">
        {value.bookedFor === "self" && band === "child" ? <Note tone="amber">{t("relation.under14")}</Note> : null}
        {value.bookedFor === "self" && band === "teen" ? <Note>{t("relation.teen")}</Note> : null}

        {value.bookedFor === "minor" ? (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
            <Note>{t("relation.minor.intro")}</Note>
            {!issue.ok && issue.code === "birthdate_required" ? <Note tone="amber">{t("relation.minor.birthDateNeeded")}</Note> : null}
            {!issue.ok && issue.code === "not_a_minor" ? <Note tone="amber">{t("relation.minor.adult")}</Note> : null}
            <p className="text-[13px] font-semibold text-slate-700">{t("relation.minor.guardianHeading")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("relation.minor.name")} error={err("guardian.name")}>
                <Input
                  value={g.name}
                  onChange={(e) => setGuardian({ name: e.target.value })}
                  onBlur={() => touch("guardian.name")}
                  autoComplete="name"
                  aria-required
                />
              </Field>
              <fieldset aria-describedby={errors["guardian.relation"] ? `${id}relationError` : undefined}>
                <legend className="mb-1.5 text-[13px] font-semibold text-slate-700">{t("relation.minor.relationLegend")}</legend>
                <div className="flex gap-2">
                  {GUARDIAN_RELATIONS.map((r) => (
                    <label
                      key={r}
                      className={cx(
                        "flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-xl px-3 text-sm font-semibold ring-1",
                        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600",
                        g.relation === r ? "bg-brand-50 text-brand-800 ring-2 ring-brand-600" : "bg-white text-slate-700 ring-line-strong",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${id}relation`}
                        value={r}
                        checked={g.relation === r}
                        onChange={() => setGuardian({ relation: r })}
                        className="sr-only"
                      />
                      {t(`relation.minor.relations.${r}`)}
                    </label>
                  ))}
                </div>
                {errors["guardian.relation"] ? (
                  <p id={`${id}relationError`} className="mt-1 text-xs font-medium text-red-600">
                    {errors["guardian.relation"]}
                  </p>
                ) : null}
              </fieldset>
              <Field label={t("relation.minor.phone")} hint={t("relation.minor.contactHint")} error={err("guardian.phone")}>
                <Input
                  value={g.phone}
                  onChange={(e) => setGuardian({ phone: e.target.value })}
                  onBlur={() => touch("guardian.phone")}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
              <Field label={t("relation.minor.email")} error={err("guardian.email")}>
                <Input
                  value={g.email}
                  onChange={(e) => setGuardian({ email: e.target.value })}
                  onBlur={() => {
                    touch("guardian.email");
                    touch("guardian.phone");
                  }}
                  type="email"
                  autoComplete="email"
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">{t("relation.minor.access")}</p>
          </div>
        ) : null}

        {value.bookedFor === "other_adult" ? (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
            <Note>{t("relation.other.intro")}</Note>
            {otherNote ? <Note tone={otherNote.tone}>{t(otherNote.key)}</Note> : null}
            <p className="text-[13px] font-semibold text-slate-700">{t("relation.other.heading")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("relation.other.name")} error={err("bookedBy.name")}>
                <Input
                  value={b.name}
                  onChange={(e) => setBookedBy({ name: e.target.value })}
                  onBlur={() => touch("bookedBy.name")}
                  autoComplete="name"
                  aria-required
                />
              </Field>
              <Field label={t("relation.other.phone")} error={errors["bookedBy.phone"]}>
                <Input value={b.phone} onChange={(e) => setBookedBy({ phone: e.target.value })} type="tel" inputMode="tel" autoComplete="tel" />
              </Field>
              <Field label={t("relation.other.email")} error={err("bookedBy.email")}>
                <Input
                  value={b.email}
                  onChange={(e) => setBookedBy({ email: e.target.value })}
                  onBlur={() => touch("bookedBy.email")}
                  type="email"
                  autoComplete="email"
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">{t("relation.other.hint")}</p>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

/**
 * What "Another adult" means where the form is: on Sorriso's search pages a booking is held for the
 * adult's own confirmation (OTHER_ADULT_ON_MARKETPLACE "held") and a waitlist entry is refused;
 * through the practice's own channels nothing more is needed. A form that doesn't pass `context`
 * learns of the refusal only from the server's error on the group, which now only the waitlist
 * (or the "refused" setting) gives.
 */
function otherAdultNote(
  context: PatientRelationSectionProps["context"],
  variant: PatientRelationSectionProps["variant"],
  refusedByServer: boolean,
): { key: "relation.other.marketplaceHeld" | "relation.other.marketplace" | "relation.other.marketplaceWaitlist"; tone: "slate" | "amber" } | null {
  const held = OTHER_ADULT_ON_MARKETPLACE === "held";
  if (context === "marketplace") {
    if (variant === "waitlist") return { key: "relation.other.marketplaceWaitlist", tone: "amber" };
    return held ? { key: "relation.other.marketplaceHeld", tone: "slate" } : { key: "relation.other.marketplace", tone: "amber" };
  }
  // The practice's own channels never refuse (or hold) a booking for another adult.
  if (context !== undefined || !refusedByServer) return null;
  return { key: held || variant === "waitlist" ? "relation.other.marketplaceWaitlist" : "relation.other.marketplace", tone: "amber" };
}

function Note({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "amber" }) {
  return (
    <p
      className={cx(
        "flex gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed",
        tone === "amber" ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "text-slate-600",
      )}
    >
      <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
