"use client";

import { ClipboardCheck, Printer, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { markFormExportedAction } from "@/app/dashboard/actions/care";
import { fmtDay, fmtWhen } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { Badge, Button } from "../ui";
import { useRunAction } from "../dashboard/useRunAction";
import type { AnamnesisSheetData } from "./types";

/**
 * A signed medical history for the clinical team, as a modal sheet that prints on its own (for
 * the clinical record). Rendered at the end of <body> through a portal; while it is open, print
 * styles hide everything else on the page. Opening it was audited by the server action that
 * loaded `data` (patient.clinical.view).
 */
export function AnamnesisSheet({ data, onClose }: { data: AnamnesisSheetData; onClose(): void }) {
  const t = useT("care");
  const tc = useT("common");
  const locale = useLocale();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [exportedAt, setExportedAt] = useState(data.exportedAt);
  const { run, pending } = useRunAction();
  const tz = data.visit?.timezone ?? DEFAULT_TIMEZONE;

  // Focus moves into the sheet and back where it was; print styles apply while it is open.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.dataset.printAnamnesis = "1";
    return () => {
      delete document.body.dataset.printAnamnesis;
      previous?.focus?.();
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Labels come from the form schema: keys under care.anamnesis.* */
  const label = (key: string) => {
    const k = key as `anamnesis.${string}`;
    return k.startsWith("anamnesis.") && t.has(k) ? t(k) : key;
  };
  const option = (v: string) => {
    const key = `anamnesis.options.${v}` as const;
    return t.has(key) ? t(key) : v;
  };
  const answerText = (type: string, v: string | string[] | undefined) => {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return null;
    if (Array.isArray(v)) return v.map(option).join(", ");
    if (type === "yesno" || type === "select") return option(v);
    if (type === "date") return fmtDay(v, "medium", locale);
    return v;
  };
  const signer = data.signerName ?? "—";
  const signedDate = fmtWhen(data.signedAt, tz, locale);
  const signedLine =
    data.signedVia === "otp_sms"
      ? t("sheet.signedSms", { name: signer, date: signedDate })
      : data.signedVia === "otp_email"
        ? t("sheet.signedEmail", { name: signer, date: signedDate })
        : data.signedVia === "staff"
          ? t("sheet.signedStaff", { name: signer, date: signedDate })
          : t("sheet.signed", { name: signer, date: signedDate });
  const languageKey = `languages.${data.locale}` as const;
  const language = tc.has(languageKey) ? tc(languageKey) : data.locale;

  const sheet = (
    <div data-anamnesis-print className="fixed inset-0 z-[70] flex justify-center overflow-y-auto bg-slate-900/40 p-4 print:static print:block print:bg-white print:p-0">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-pop ring-1 ring-slate-200 print:max-w-none print:rounded-none print:shadow-none print:ring-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{data.clinic}</p>
            <h2 id={titleId} className="mt-0.5 text-xl font-bold">
              {t("sheet.title")}
            </h2>
            <p className="mt-1 text-sm font-semibold">
              {`${data.patient.firstName} ${data.patient.lastName}`.trim()}
              {data.patient.birthDate ? (
                <span className="font-normal text-slate-600"> · {t("sheet.born", { date: fmtDay(data.patient.birthDate, "medium", locale) })}</span>
              ) : null}
            </p>
            {data.visit ? (
              <p className="text-sm text-slate-600">
                {t("sheet.visit", { date: fmtWhen(data.visit.start, data.visit.timezone, locale) })}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600 print:hidden"
            aria-label={t("sheet.close")}
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <section aria-label={t("sheet.redFlags")}>
            {data.redFlags.length ? (
              <div className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
                <p className="flex items-center gap-1.5 text-sm font-bold text-red-800">
                  <TriangleAlert size={16} aria-hidden /> {t("sheet.redFlags")}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.redFlags.map((f) => (
                    <li key={f}>
                      <Badge tone="red">{label(`anamnesis.flags.${f}`)}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-600">{t("sheet.noRedFlags")}</p>
            )}
          </section>

          {data.schema.sections.map((section) => (
            <section key={section.id}>
              <h3 className="mb-2 text-sm font-bold text-slate-800">{label(section.titleKey)}</h3>
              <dl className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                {section.fields.map((f) => {
                  const text = answerText(f.type, data.answers[f.id]);
                  const flagged = data.redFlags.includes(f.id);
                  return (
                    <div key={f.id} className="grid gap-1 p-3 sm:grid-cols-[1fr_auto] sm:gap-4">
                      <dt className="text-sm text-slate-700">{label(f.labelKey)}</dt>
                      <dd className={flagged ? "text-sm font-bold text-red-700" : "text-sm font-semibold"}>
                        {text ?? <span className="font-normal text-slate-500">{t("sheet.noAnswer")}</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}

          <div className="space-y-1 text-xs text-slate-600">
            <p>{signedLine}</p>
            <p>{t("sheet.form", { version: data.version, language })}</p>
            {exportedAt ? <p>{t("sheet.exported", { date: fmtWhen(exportedAt, tz, locale) })}</p> : null}
            <p className="print:hidden">{t("sheet.audited")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-4 print:hidden">
          {!exportedAt ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => markFormExportedAction(data.id), (r) => r.ok && setExportedAt(new Date().toISOString()))}
            >
              <ClipboardCheck size={14} aria-hidden /> {t("sheet.markExported")}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={14} aria-hidden /> {t("sheet.print")}
          </Button>
          <Button type="button" size="sm" onClick={onClose}>
            {t("sheet.close")}
          </Button>
        </div>
      </div>
      <style>{PRINT_CSS}</style>
    </div>
  );
  return createPortal(sheet, document.body);
}

/** While the sheet is open, print only the sheet. */
const PRINT_CSS = `@media print {
  body[data-print-anamnesis] > *:not([data-anamnesis-print]) { display: none !important; }
  body[data-print-anamnesis] { background: #fff !important; }
}`;
