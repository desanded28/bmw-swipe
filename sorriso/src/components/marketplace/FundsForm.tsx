"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useId, useState } from "react";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { saveOrgFunds } from "@/app/dashboard/actions/funds";
import { FUND_MODES, type FundKind, type FundMode } from "@/db/enums";
import { useT } from "@/i18n/provider";
import { Badge, Button, cx } from "../ui";
import { AdCheckedText } from "./AdCheckedText";

type Current = { mode: FundMode; serviceIds: string[] | null; note: string | null };

/**
 * Which health funds and insurers the practice works with: per fund, direct billing or
 * reimbursement, all treatments or a selection, and an optional note for patients (checked for
 * promotional wording while typing, Law 145/2018). One form, one save (the list is replaced as a
 * whole).
 */
export function FundsForm({
  funds,
  services,
  current,
}: {
  funds: { id: string; name: string; kind: FundKind }[];
  services: { id: string; name: string }[];
  current: Record<string, Current>;
}) {
  const t = useT("catalog");
  const uid = useId();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveOrgFunds, null);
  const [selected, setSelected] = useState<string[]>(Object.keys(current));
  const [scopes, setScopes] = useState<Record<string, "all" | "some">>(
    Object.fromEntries(Object.entries(current).map(([id, c]) => [id, c.serviceIds ? "some" : "all"])),
  );

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-600" aria-live="polite">
        {t("funds.accepted", { count: selected.length })} · {t("funds.declared")}
      </p>
      <ul className="space-y-2">
        {funds.map((f) => {
          const on = selected.includes(f.id);
          const c = current[f.id];
          const scope = scopes[f.id] ?? "all";
          return (
            <li key={f.id} className={cx("rounded-xl p-3 ring-1", on ? "bg-white ring-brand-200" : "bg-slate-50/60 ring-slate-200")}>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  name={`fund.${f.id}`}
                  checked={on}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, f.id] : selected.filter((x) => x !== f.id))}
                  className="h-4 w-4 accent-brand-700"
                  aria-controls={`${uid}${f.id}`}
                  aria-expanded={on}
                />
                {t("funds.accept", { fund: f.name })}
                <Badge className="ml-1">{t(`funds.kinds.${f.kind}`)}</Badge>
              </label>
              {on ? (
                <div id={`${uid}${f.id}`} className="mt-3 grid gap-3 pl-6 md:grid-cols-2">
                  <fieldset>
                    <legend className="mb-1 text-xs font-semibold text-slate-600">{t("funds.mode")}</legend>
                    {FUND_MODES.map((m) => (
                      <label key={m} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="radio" name={`mode.${f.id}`} value={m} defaultChecked={(c?.mode ?? "indirect") === m} className="h-4 w-4 accent-brand-700" />
                        {t(`funds.modes.${m}`)}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset>
                    <legend className="mb-1 text-xs font-semibold text-slate-600">{t("funds.services")}</legend>
                    {(["all", "some"] as const).map((sc) => (
                      <label key={sc} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name={`scope.${f.id}`}
                          value={sc}
                          checked={scope === sc}
                          onChange={() => setScopes({ ...scopes, [f.id]: sc })}
                          className="h-4 w-4 accent-brand-700"
                        />
                        {sc === "all" ? t("funds.allServices") : t("funds.someServices")}
                      </label>
                    ))}
                    {scope === "some" ? (
                      <div className="mt-2 grid gap-1">
                        {services.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              name={`services.${f.id}`}
                              value={s.id}
                              defaultChecked={c?.serviceIds?.includes(s.id) ?? false}
                              className="h-4 w-4 accent-brand-700"
                            />
                            {s.name}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </fieldset>
                  <div className="md:col-span-2">
                    <label htmlFor={`${uid}note${f.id}`} className="mb-1 block text-xs font-semibold text-slate-600">
                      {t("funds.note")}
                    </label>
                    <AdCheckedText id={`${uid}note${f.id}`} name={`note.${f.id}`} defaultValue={c?.note ?? ""} maxLength={200} aria-describedby={`${uid}notehint`} />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p id={`${uid}notehint`} className="text-xs text-slate-500">
        {t("funds.noteHint")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
          {t("funds.save")}
        </Button>
        <div aria-live="polite">
          {state ? (
            state.ok ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CircleCheck size={16} aria-hidden /> {state.message}
              </span>
            ) : (
              <span role="alert" className="text-sm font-medium text-red-700">
                {state.error}
              </span>
            )
          ) : null}
        </div>
      </div>
    </form>
  );
}
