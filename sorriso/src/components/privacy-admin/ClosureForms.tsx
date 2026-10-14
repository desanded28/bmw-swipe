"use client";

import { Download, LoaderCircle, Power, Undo2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { cancelClosureAction, requestClosureAction } from "@/app/dashboard/actions/privacy";
import { useT } from "@/i18n/provider";
import { useRunAction } from "../dashboard/useRunAction";
import { Button, Input } from "../ui";
import { FormStatus } from "./PatientForms";

/** Download the whole practice (streams a ZIP); a plain link lets the browser handle the download and any step-up redirect. */
export function ExportAllButton({ label }: { label: string }) {
  return (
    // A route handler streaming a file, not a page: a plain link, so the browser downloads it.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/dashboard/settings/export" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">
      <Download size={16} aria-hidden /> {label}
    </a>
  );
}

/** Close the account: the practice name typed to confirm, then a fresh second factor on the server. */
export function RequestClosureForm({ orgName }: { orgName: string }) {
  const t = useT("privacyAdmin");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(requestClosureAction, null);
  const [typed, setTyped] = useState("");
  const id = useId();
  const matches = typed.trim().toLowerCase() === orgName.trim().toLowerCase();
  return (
    <form action={action} className="space-y-3">
      <label htmlFor={id} className="block text-[13px] font-semibold text-slate-700">
        {t("closure.confirmLabel", { name: orgName })}
      </label>
      <Input id={id} name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} required className="max-w-md" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="danger" disabled={!matches || pending} aria-disabled={!matches}>
          {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Power size={16} aria-hidden />} {t("closure.request")}
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function CancelClosureButton() {
  const t = useT("privacyAdmin");
  const { run, pending } = useRunAction();
  return (
    <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => cancelClosureAction())}>
      <Undo2 size={16} aria-hidden /> {t("closure.cancel")}
    </Button>
  );
}
