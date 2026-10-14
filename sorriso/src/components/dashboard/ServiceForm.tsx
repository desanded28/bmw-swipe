"use client";

import { CircleCheck, LoaderCircle, Scale } from "lucide-react";
import { useActionState, useId, useState } from "react";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { saveService } from "@/app/dashboard/actions/services";
import { PRICE_TYPES, SERVICE_CATEGORIES, type PriceType } from "@/db/enums";
import type { Service } from "@/db/schema";
import { useT } from "@/i18n/provider";
import { checkAdvertising } from "@/lib/compliance/advertising";
import { FindingsPreview } from "../marketplace/Highlighted";
import { Button, Input, Select, Textarea } from "../ui";

type ServiceFields = Pick<
  Service,
  | "id"
  | "name"
  | "category"
  | "description"
  | "durationMinutes"
  | "bufferMinutes"
  | "priceCents"
  | "priceType"
  | "priceMaxCents"
  | "priceIncludes"
  | "recallMonths"
  | "sensitive"
  | "onlineBookable"
  | "requiresRoom"
  | "active"
>;

const euros = (cents: number | null | undefined) => (cents != null ? String(cents / 100) : "");

/**
 * Create or edit a treatment: duration, buffer, the price as patients see it (fixed, starting
 * price or range, quote after a visit), what it includes, the suggested recall interval and the
 * sensitive flag. Names and descriptions are checked live for promotional wording (L. 145/2018);
 * the server blocks it too.
 */
export function ServiceForm({ service }: { service?: ServiceFields }) {
  const t = useT("catalog");
  const tc = useT("common");
  const s = service;
  const uid = useId();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveService.bind(null, s?.id ?? null), null);
  const [priceType, setPriceType] = useState<PriceType>(s?.priceType ?? "fixed");
  const [name, setName] = useState(s?.name ?? "");
  const [description, setDescription] = useState(s?.description ?? "");
  const [includes, setIncludes] = useState(s?.priceIncludes ?? "");
  const findings = { name: checkAdvertising(name), description: checkAdvertising(description), includes: checkAdvertising(includes) };
  const rules = [...new Set([...findings.name, ...findings.description, ...findings.includes].map((f) => f.rule))];
  const label = "mb-1.5 block text-[13px] font-semibold text-slate-700";
  const hint = "mt-1 block text-xs text-slate-500";
  const check = "flex items-center gap-2 text-sm text-slate-700";

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}name`} className={label}>
            {t("serviceForm.name")}
          </label>
          <Input id={`${uid}name`} name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          <FindingsPreview text={name} findings={findings.name} />
        </div>
        <div>
          <label htmlFor={`${uid}cat`} className={label}>
            {t("serviceForm.category")}
          </label>
          <Select id={`${uid}cat`} name="category" defaultValue={s?.category ?? "checkup"} aria-describedby={`${uid}cathint`}>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tc(`categories.${c}`)}
              </option>
            ))}
          </Select>
          <span id={`${uid}cathint`} className={hint}>
            {t("serviceForm.categoryHint")}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor={`${uid}dur`} className={label}>
            {t("serviceForm.duration")}
          </label>
          <Input id={`${uid}dur`} type="number" name="durationMinutes" min={5} max={480} step={5} defaultValue={s?.durationMinutes ?? 30} required />
        </div>
        <div>
          <label htmlFor={`${uid}buf`} className={label}>
            {t("serviceForm.buffer")}
          </label>
          <Input id={`${uid}buf`} type="number" name="bufferMinutes" min={0} max={120} step={5} defaultValue={s?.bufferMinutes ?? 0} aria-describedby={`${uid}bufhint`} />
          <span id={`${uid}bufhint`} className={hint}>
            {t("serviceForm.bufferHint")}
          </span>
        </div>
        <div>
          <label htmlFor={`${uid}ptype`} className={label}>
            {t("serviceForm.priceType")}
          </label>
          <Select id={`${uid}ptype`} name="priceType" value={priceType} onChange={(e) => setPriceType(e.target.value as PriceType)}>
            {PRICE_TYPES.map((p) => (
              <option key={p} value={p}>
                {t(`priceTypes.${p}`)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${uid}recall`} className={label}>
            {t("serviceForm.recallMonths")}
          </label>
          <Input id={`${uid}recall`} type="number" name="recallMonths" min={1} max={60} defaultValue={s?.recallMonths ?? ""} aria-describedby={`${uid}recallhint`} />
          <span id={`${uid}recallhint`} className={hint}>
            {t("serviceForm.recallHint")}
          </span>
        </div>
      </div>
      {priceType !== "quote" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}price`} className={label}>
              {priceType === "from" ? t("serviceForm.priceFrom") : t("serviceForm.price")}
            </label>
            <Input id={`${uid}price`} name="price" inputMode="decimal" defaultValue={euros(s?.priceCents)} aria-describedby={`${uid}pricehint`} />
            <span id={`${uid}pricehint`} className={hint}>
              {t("serviceForm.priceHint")}
            </span>
          </div>
          {priceType === "from" ? (
            <div>
              <label htmlFor={`${uid}pmax`} className={label}>
                {t("serviceForm.priceMax")}
              </label>
              <Input id={`${uid}pmax`} name="priceMax" inputMode="decimal" defaultValue={euros(s?.priceMaxCents)} aria-describedby={`${uid}pmaxhint`} />
              <span id={`${uid}pmaxhint`} className={hint}>
                {t("serviceForm.priceMaxHint")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      <div>
        <label htmlFor={`${uid}incl`} className={label}>
          {t("serviceForm.priceIncludes")}
        </label>
        <Input id={`${uid}incl`} name="priceIncludes" value={includes} onChange={(e) => setIncludes(e.target.value)} maxLength={300} aria-describedby={`${uid}inclhint`} />
        <span id={`${uid}inclhint`} className={hint}>
          {t("serviceForm.priceIncludesHint")}
        </span>
        <FindingsPreview text={includes} findings={findings.includes} />
      </div>
      <div>
        <label htmlFor={`${uid}desc`} className={label}>
          {t("serviceForm.description")}
        </label>
        <Textarea id={`${uid}desc`} name="description" rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        <FindingsPreview text={description} findings={findings.description} />
      </div>
      {rules.length ? (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200" aria-live="polite">
          <p className="flex items-center gap-1.5 font-semibold">
            <Scale size={14} aria-hidden /> {t("advertising.law")}
          </p>
          <ul className="mt-1 list-disc pl-5">
            {rules.map((r) => (
              <li key={r}>{t(`advertising.rules.${r}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="sensitive" defaultChecked={s?.sensitive ?? false} className="mt-0.5 h-4 w-4 accent-brand-700" aria-describedby={`${uid}senshint`} />
        <span>
          {t("serviceForm.sensitive")}
          <span id={`${uid}senshint`} className={hint}>
            {t("serviceForm.sensitiveHint")}
          </span>
        </span>
      </label>
      <div className="flex flex-wrap gap-5">
        <label className={check}>
          <input type="checkbox" name="onlineBookable" defaultChecked={s?.onlineBookable ?? true} className="h-4 w-4 accent-brand-700" /> {t("serviceForm.onlineBookable")}
        </label>
        <label className={check}>
          <input type="checkbox" name="requiresRoom" defaultChecked={s?.requiresRoom ?? true} className="h-4 w-4 accent-brand-700" /> {t("serviceForm.requiresRoom")}
        </label>
        <label className={check}>
          <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="h-4 w-4 accent-brand-700" /> {t("serviceForm.active")}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
          {s ? t("serviceForm.save") : t("serviceForm.add")}
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
