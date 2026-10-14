"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useId } from "react";
import { REVIEW_REPORT_GROUNDS } from "@/db/enums";
import { useT } from "@/i18n/provider";
import { Button, Input, Select, Textarea } from "../ui";
import type { TextActionState } from "./TextActionForm";

/**
 * A notice about a review from anyone (DSA Art. 16): the reason, an explanation, the notifier's
 * name and email (to confirm receipt and send the outcome) and the good-faith statement.
 */
export function PublicNoticeForm({ action }: { action: (prev: TextActionState, fd: FormData) => Promise<TextActionState> }) {
  const t = useT("reviews");
  const [state, formAction, pending] = useActionState(action, null);
  const uid = useId();
  const label = "mb-1.5 block text-[13px] font-semibold text-slate-700";
  if (state?.ok) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
        <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden /> {state.message}
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor={`${uid}ground`} className={label}>
          {t("publicReport.ground")}
        </label>
        <Select id={`${uid}ground`} name="ground" required defaultValue="">
          <option value="" disabled>
            {t("publicReport.groundPlaceholder")}
          </option>
          {REVIEW_REPORT_GROUNDS.map((g) => (
            <option key={g} value={g}>
              {t(`grounds.${g}`)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor={`${uid}why`} className={label}>
          {t("publicReport.explanation")}
        </label>
        <Textarea id={`${uid}why`} name="explanation" rows={4} maxLength={2000} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}name`} className={label}>
            {t("publicReport.name")}
          </label>
          <Input id={`${uid}name`} name="name" autoComplete="name" maxLength={120} required />
        </div>
        <div>
          <label htmlFor={`${uid}email`} className={label}>
            {t("publicReport.email")}
          </label>
          <Input id={`${uid}email`} name="email" type="email" autoComplete="email" maxLength={254} required aria-describedby={`${uid}emailhint`} />
          <p id={`${uid}emailhint`} className="mt-1 text-xs text-slate-500">
            {t("publicReport.emailHint")}
          </p>
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="goodFaith" value="yes" required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
        {t("publicReport.goodFaith")}
      </label>
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
        {t("publicReport.submit")}
      </Button>
    </form>
  );
}
