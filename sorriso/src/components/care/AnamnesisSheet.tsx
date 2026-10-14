"use client";

import { ClipboardCheck, Printer, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { markFormExportedAction } from "@/app/dashboard/actions/care";
import { fmtDay, fmtWhen } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { Badge, Button } from "../ui";
import { useRunAction } from "../dashboard/useRunAction";
import { useNativeModal } from "./modal";
import type { AnamnesisSheetData } from "./types";

/**
 * A signed medical history for the clinical team, as a modal sheet that prints on its own (for
 * the clinical record). Rendered at the end of <body> through a portal; while it is open, print
 * styles hide everything else on the page. Opening it was audited by the server action that
 * loaded `data` (patient.clinical.view).
 */
export function AnamnesisSheet({ data, onClose }: { data: AnamnesisSheetData; onClose(): void }) {
  return createPortal(<AnamnesisSheetDialog data={data} onClose={onClose} />, document.body);
}

/**
 * The sheet itself: a native <dialog> opened with showModal() (src/components/care/modal.ts), so
 * it stacks above the appointment drawer's own modal dialog (the drawer goes inert behind it, not
 * the other way round), keeps focus inside, and Escape closes the sheet only. Exported for tests.
 */
export function AnamnesisSheetDialog({ data, onClose }: { data: AnamnesisSheetData; onClose(): void }) {
  const t = useT("care");
  const tc = useT("common");
  const locale = useLocale();
  const titleId = useId();
  const { ref, props: dialogProps } = useNativeModal(onClose, { printable: true });
  const [exportedAt, setExportedAt] = useState(data.exportedAt);
  const { run, pending } = useRunAction();
  const tz = data.visit?.timezone ?? DEFAULT_TIMEZONE;

  // Print styles apply while it is open.
  useEffect(() => {
    document.body.dataset.printAnamnesis = "1";
    return () => {
      delete document.body.dataset.printAnamnesis;
    };
  }, []);

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

  return (
    <dialog
      ref={ref}
      data-anamnesis-print
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl bg-white p-0 text-ink shadow-pop ring-1 ring-slate-200 backdrop:bg-slate-900/40 print:rounded-none print:shadow-none print:ring-0"
      {...dialogProps}
    >
      <div>
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
            data-autofocus
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
    </dialog>
  );
}

/**
 * While the sheet is open, print only the sheet (the drawer it was opened from included: it is a
 * dialog of its own). For the print the sheet is a plain dialog (modalForPrint) laid out in the
 * page flow, so a long history runs over several pages.
 */
const PRINT_CSS = `@media print {
  body[data-print-anamnesis] > *:not([data-anamnesis-print]) { display: none !important; }
  body[data-print-anamnesis] dialog:not([data-anamnesis-print]) { display: none !important; }
  body[data-print-anamnesis] { background: #fff !important; }
  dialog[data-anamnesis-print] {
    position: static !important; inset: auto !important; margin: 0 !important; width: auto !important;
    max-width: none !important; height: auto !important; max-height: none !important; overflow: visible !important;
  }
  dialog[data-anamnesis-print]::backdrop { display: none !important; }
}`;
