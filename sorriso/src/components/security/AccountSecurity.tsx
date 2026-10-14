"use client";

import { LaptopMinimal, LogOut, MailWarning } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  changePassword,
  resendVerificationEmail,
  revokeOtherSessions,
  revokeSession,
  verifyStepUp,
} from "@/app/dashboard/actions/security";
import { useT } from "@/i18n/provider";
import { Badge, Button, Field, Input } from "../ui";
import { useRunAction } from "../dashboard/useRunAction";

/** Client parts of /dashboard/account/security: sessions, password, email confirmation, step-up. */

export type SessionRow = { id: string; device: string; signedIn: string; lastActive: string; current: boolean };

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const t = useT("security");
  const { run, pending } = useRunAction();
  const others = sessions.filter((s) => !s.current);
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <LaptopMinimal size={18} className="shrink-0 text-slate-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {s.device}
                {s.current ? <Badge tone="brand">{t("sessions.current")}</Badge> : null}
              </p>
              <p className="text-xs text-slate-500">
                {t("sessions.signedIn", { when: s.signedIn })} · {t("sessions.lastActive", { when: s.lastActive })}
              </p>
            </div>
            {!s.current ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => window.confirm(t("sessions.revokeConfirm")) && run(() => revokeSession(s.id))}
              >
                <LogOut size={14} aria-hidden /> {t("sessions.revoke")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {others.length ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => window.confirm(t("sessions.revokeOthersConfirm")) && run(revokeOtherSessions)}
        >
          {t("sessions.revokeOthers")}
        </Button>
      ) : (
        <p className="text-sm text-slate-500">{t("sessions.none")}</p>
      )}
    </div>
  );
}

export function PasswordForm() {
  const t = useT("security");
  const { run, pending } = useRunAction();
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const mismatch = values.confirm.length > 0 && values.confirm !== values.next;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => changePassword(values),
          (r) => r.ok && setValues({ current: "", next: "", confirm: "" }),
        );
      }}
    >
      <Field label={t("password.current")}>
        <Input type="password" autoComplete="current-password" required value={values.current} onChange={set("current")} />
      </Field>
      <Field label={t("password.new")} hint={t("password.hint")}>
        <Input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={values.next} onChange={set("next")} />
      </Field>
      <Field label={t("password.confirm")} error={mismatch ? t("password.mismatch") : null}>
        <Input type="password" autoComplete="new-password" required value={values.confirm} onChange={set("confirm")} aria-invalid={mismatch || undefined} />
      </Field>
      <Button type="submit" disabled={pending || mismatch}>
        {t("password.submit")}
      </Button>
    </form>
  );
}

export function EmailStatus({ email, verified }: { email: string; verified: boolean }) {
  const t = useT("security");
  const { run, pending } = useRunAction();
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-semibold">{email}</span>
      {verified ? (
        <Badge tone="green">{t("email.verified")}</Badge>
      ) : (
        <>
          <Badge tone="amber">
            <MailWarning size={13} aria-hidden /> {t("email.notVerified")}
          </Badge>
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(resendVerificationEmail)}>
            {t("email.resend")}
          </Button>
        </>
      )}
    </div>
  );
}

/** Re-authentication: a code from the authenticator when MFA is on, else the password. */
export function StepUpForm({ mfa, next }: { mfa: boolean; next: string }) {
  const t = useT("security");
  const router = useRouter();
  const { run, pending } = useRunAction();
  const [value, setValue] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => verifyStepUp(mfa ? { code: value } : { password: value }),
          (r) => {
            if (r.ok) router.push(next);
            else setValue("");
          },
        );
      }}
    >
      <Field label={mfa ? t("mfa.code") : t("password.current")}>
        {mfa ? (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            required
            autoFocus
            className="text-center font-mono text-lg tracking-[0.3em]"
          />
        ) : (
          <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="current-password" required autoFocus />
        )}
      </Field>
      <Button type="submit" disabled={pending || !value}>
        {t("stepUp.submit")}
      </Button>
    </form>
  );
}
