"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useId, useState } from "react";
import { newApiKey, revokeApiKey } from "@/app/dashboard/actions/apikeys";
import { API_SCOPES, type ApiScope } from "@/db/enums";
import { useT } from "@/i18n/provider";
import { useSecureAction } from "../security/useSecureAction";
import { Badge, Button, Field, Input, Select, Textarea } from "../ui";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  status: "active" | "revoked" | "expired";
  /** Pre-formatted dates and names (server side). */
  lastUsed: string | null;
  expires: string | null;
  createdBy: string | null;
  allowedIps: number;
};

const EXPIRY_MONTHS = [3, 6, 12, 24] as const;
const DEFAULT_SCOPES: ApiScope[] = ["appointments:read", "appointments:write", "patients:read"];

/** Partner API keys: list, revoke, and create with scopes, expiry and an optional IP allow-list. */
export function ApiKeys({ keys }: { keys: ApiKeyRow[] }) {
  const t = useT("security");
  const tc = useT("common");
  const { run, pending } = useSecureAction();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>(DEFAULT_SCOPES);
  const [months, setMonths] = useState(12);
  const [ips, setIps] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scopesLabel = useId();

  const toggle = (s: ApiScope) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {keys.length === 0 ? <li className="p-3 text-sm text-slate-500">{t("api.none")}</li> : null}
        {keys.map((k) => (
          <li key={k.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
            <KeyRound size={15} className="mt-0.5 text-slate-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {k.name}
                {k.status === "revoked" ? <Badge tone="red">{t("api.statusRevoked")}</Badge> : null}
                {k.status === "expired" ? <Badge tone="amber">{t("api.statusExpired")}</Badge> : null}
              </p>
              <p className="text-xs text-slate-500">
                <code>{k.prefix}…</code> · {k.lastUsed ? t("api.lastUsed", { date: k.lastUsed }) : t("api.neverUsed")}
                {k.expires ? ` · ${t("api.expires", { date: k.expires })}` : null}
              </p>
              <p className="mt-1 flex flex-wrap gap-1">
                {k.scopes.map((s) => (
                  <Badge key={s} tone={s === "notes:read" || s === "patients:erase" ? "amber" : "slate"}>
                    {t(`api.scopes.${s}`)}
                  </Badge>
                ))}
                {k.allowedIps ? <Badge tone="blue">{t("api.ipRestricted", { count: k.allowedIps })}</Badge> : null}
              </p>
              {k.createdBy ? <p className="mt-1 text-xs text-slate-600">{t("api.createdBy", { name: k.createdBy })}</p> : null}
            </div>
            {k.status === "active" ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => window.confirm(t("api.revokeConfirm")) && run(() => revokeApiKey(k.id))}>
                {t("api.revoke")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {secret ? (
        <div className="rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200" role="status">
          <p className="font-semibold text-amber-900">{t("api.created")}</p>
          <div className="mt-2 flex gap-2">
            <code className="flex-1 select-all break-all rounded bg-white p-2 text-xs">{secret}</code>
            <Button
              size="sm"
              variant="secondary"
              aria-label={t("api.copyKey")}
              onClick={() => navigator.clipboard?.writeText(secret).then(() => setCopied(true), () => setCopied(false))}
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            </Button>
          </div>
        </div>
      ) : null}

      <form
        className="space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => newApiKey({ name, scopes, expiresInMonths: months, allowedIps: ips }),
            (r) => {
              if (r.ok) {
                setCopied(false);
                setSecret((r.data as { secret: string }).secret);
                setName("");
                setIps("");
              }
            },
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
          <Field label={t("api.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("api.namePlaceholder")} maxLength={80} />
          </Field>
          <Field label={t("api.expiry")}>
            <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {EXPIRY_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {tc("units.months", { count: m })}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <fieldset aria-labelledby={scopesLabel}>
          <legend id={scopesLabel} className="mb-1.5 text-[13px] font-semibold text-slate-700">
            {t("api.access")}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {API_SCOPES.map((s) => (
              <label key={s} className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-sm ring-1 ring-slate-200">
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
                <span>
                  {t(`api.scopes.${s}`)} <code className="block text-[11px] text-slate-600">{s}</code>
                </span>
              </label>
            ))}
          </div>
          {!scopes.length ? <p className="mt-1 text-xs font-medium text-red-600">{t("api.scopeRequired")}</p> : null}
        </fieldset>
        <Field label={t("api.allowedIps")} hint={t("api.allowedIpsHint")}>
          <Textarea value={ips} onChange={(e) => setIps(e.target.value)} rows={2} spellCheck={false} className="font-mono text-xs" />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending || !scopes.length}>
          {t("api.create")}
        </Button>
      </form>
    </div>
  );
}
