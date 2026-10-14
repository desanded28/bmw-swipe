"use client";

import { Check, Printer } from "lucide-react";
import { useId, useState } from "react";
import { acceptLegalDocument } from "@/app/dashboard/actions/privacy";
import type { LegalDoc } from "@/db/enums";
import { useT } from "@/i18n/provider";
import { useRunAction } from "../dashboard/useRunAction";
import { Button } from "../ui";

/** Tick-and-accept for one legal document (recorded with version, language, IP and browser hashes). */
export function LegalAcceptForm({ doc, label }: { doc: LegalDoc; label: string }) {
  const t = useT("privacyAdmin");
  const { run, pending } = useRunAction();
  const [ticked, setTicked] = useState(false);
  const id = useId();
  return (
    <form
      className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200 print:hidden"
      onSubmit={(e) => {
        e.preventDefault();
        if (ticked) run(() => acceptLegalDocument(doc));
      }}
    >
      <label htmlFor={id} className="flex flex-1 items-start gap-2 text-sm font-medium">
        <input id={id} type="checkbox" required checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
        {label}
      </label>
      <Button type="submit" disabled={!ticked || pending}>
        <Check size={16} aria-hidden /> {t("legal.accept")}
      </Button>
    </form>
  );
}

/**
 * Print one document (the browser's "save as PDF" gives the PDF): it is opened and marked, and
 * the page's print stylesheet hides everything else.
 */
export function PrintDocumentButton({ targetId, label }: { targetId: string; label: string }) {
  const print = () => {
    const el = document.getElementById(targetId);
    if (!el) return window.print();
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.classList.add("printing");
    document.body.dataset.printing = "1";
    const done = () => {
      el.classList.remove("printing");
      delete document.body.dataset.printing;
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };
  return (
    <Button type="button" size="sm" variant="ghost" onClick={print} className="print:hidden">
      <Printer size={14} aria-hidden /> {label}
    </Button>
  );
}
