"use client";

import { ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { useId, useState } from "react";
import {
  confirmMfaEnrolmentAction,
  regenerateRecoveryCodesAction,
  removeMfa,
  startMfaEnrolment,
} from "@/app/dashboard/actions/security";
import { useT } from "@/i18n/provider";
import { Badge, Button, Field, Input } from "../ui";
import { RecoveryCodes } from "./RecoveryCodes";
import { useSecureAction } from "./useSecureAction";

type Setup = { secret: string; formatted: string; uri: string };

/**
 * Two-step verification for the signed-in user: set-up (setup key + otpauth:// link, then a first
 * code), recovery codes, replacing the phone and, where the role allows it, turning it off.
 */
export function MfaPanel({
  enabled,
  since,
  recoveryLeft,
  required,
  practice,
  startOpen,
}: {
  enabled: boolean;
  /** Pre-formatted date the user enabled it. */
  since: string | null;
  recoveryLeft: number;
  /** Required for this user (their role, a practice rule or platform admin): can't be turned off. */
  required: boolean;
  practice: string;
  /** Came here because enrolment is required: start the set-up straight away. */
  startOpen: boolean;
}) {
  const t = useT("security");
  const { run, pending } = useSecureAction();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const codeId = useId();

  const start = () =>
    run(startMfaEnrolment, (r) => {
      if (r.ok) setSetup(r.data as Setup);
    });

  if (codes) return <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />;

  if (enabled) {
    return (
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="green">
            <ShieldCheck size={13} aria-hidden /> {t("mfa.on")}
          </Badge>
          {since ? <span className="text-slate-600">{t("mfa.enabledSince", { date: since })}</span> : null}
        </p>
        <p className={recoveryLeft <= 2 ? "text-sm font-medium text-amber-800" : "text-sm text-slate-600"}>
          {t("mfa.recoveryLeft", { count: recoveryLeft })} {recoveryLeft <= 2 ? t("mfa.recoveryLow") : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => window.confirm(t("mfa.regenerateConfirm")) && run(regenerateRecoveryCodesAction, (r) => r.ok && setCodes((r.data as { codes: string[] }).codes))}
          >
            {t("mfa.regenerate")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => window.confirm(t("mfa.replaceConfirm")) && run(() => removeMfa("replace"), (r) => r.ok && start())}
          >
            {t("mfa.replace")}
          </Button>
          {required ? null : (
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => window.confirm(t("mfa.disableConfirm")) && run(() => removeMfa("disable"))}
            >
              {t("mfa.disable")}
            </Button>
          )}
        </div>
        {required ? <p className="text-xs text-slate-500">{t("mfa.cannotDisable")}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {required ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
          <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden /> {t("mfa.requiredBanner", { practice })}
        </p>
      ) : (
        <p className="text-sm">
          <Badge tone="slate">{t("mfa.off")}</Badge>
        </p>
      )}
      <p className="text-sm text-slate-600">{t("mfa.intro")}</p>
      {!setup ? (
        <Button type="button" disabled={pending} onClick={start} autoFocus={startOpen}>
          {t("mfa.start")}
        </Button>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => confirmMfaEnrolmentAction(code),
              (r) => {
                if (r.ok) {
                  setSetup(null);
                  setCode("");
                  setCodes((r.data as { codes: string[] }).codes);
                }
              },
            );
          }}
        >
          <ol className="list-decimal space-y-4 pl-5 text-sm text-slate-700">
            <li>
              <p>{t("mfa.step1")}</p>
              <a
                href={setup.uri}
                className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"
              >
                {t("mfa.openApp")} <ExternalLink size={14} aria-hidden />
              </a>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("mfa.secretLabel")}</p>
              <code className="mt-1 block select-all break-all rounded-lg bg-slate-100 p-3 font-mono text-sm tracking-wider">{setup.formatted}</code>
            </li>
            <li>
              <p>{t("mfa.step2")}</p>
              <Field label={t("mfa.code")} className="mt-2 max-w-48">
                <Input
                  id={codeId}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  required
                  className="text-center font-mono text-lg tracking-[0.3em]"
                />
              </Field>
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || code.replace(/\D/g, "").length !== 6}>
              {t("mfa.confirm")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
              {t("mfa.cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
