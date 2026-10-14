"use client";

import { MailPlus, ShieldCheck, ShieldOff, UserMinus } from "lucide-react";
import { useState } from "react";
import { changeMemberRole, inviteMember, removeMember, resetMemberMfa, withdrawInvite } from "@/app/dashboard/actions/team";
import { MEMBERSHIP_ROLES, type MembershipRole } from "@/db/enums";
import { useT } from "@/i18n/provider";
import { Badge, Button, Field, Input, Select } from "../ui";
import { useSecureAction } from "./useSecureAction";

export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  role: MembershipRole;
  mfa: boolean;
  instructionsAccepted: boolean;
  you: boolean;
  /** Also a member of another practice, or a platform admin: no two-step reset from here. */
  sharedAccount?: boolean;
};
export type InviteRow = { id: string; email: string; role: MembershipRole; expires: string };

/** Team members with role changes, removal and two-step resets (managers), plus invitations. */
export function TeamMembers({
  members,
  invites,
  canManage,
  isOwner,
}: {
  members: MemberRow[];
  invites: InviteRow[];
  canManage: boolean;
  isOwner: boolean;
}) {
  const t = useT("security");
  const tc = useT("common");
  const { run, pending } = useSecureAction();
  const roles = MEMBERSHIP_ROLES.filter((r) => isOwner || r !== "owner");

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-slate-100">
        {members.map((m) => (
          <Member key={m.userId} m={m} roles={roles} editable={canManage && !m.you && (isOwner || m.role !== "owner")} />
        ))}
      </ul>

      {canManage && invites.length ? (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-700">{t("team.invite.pendingTitle")}</h3>
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.email}</p>
                  <p className="text-xs text-slate-500">
                    {tc(`roles.${i.role}`)} · {t("team.invite.expires", { date: i.expires })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => window.confirm(t("team.invite.withdrawConfirm")) && run(() => withdrawInvite(i.id))}
                >
                  {t("team.invite.withdraw")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManage ? <InviteForm roles={roles} /> : null}
    </div>
  );
}

/**
 * One member. Picking a role in the list changes nothing by itself: the "Change role" button
 * applies it after a confirmation (arrowing through a closed select fires a change per option,
 * and a role change must never happen on input alone, WCAG 3.2.2).
 */
function Member({ m, roles, editable }: { m: MemberRow; roles: readonly MembershipRole[]; editable: boolean }) {
  const t = useT("security");
  const tc = useT("common");
  const { run, pending } = useSecureAction();
  const [role, setRole] = useState<MembershipRole>(m.role);
  const selectId = `role-${m.userId}`;
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {m.name}
          {m.you ? <Badge tone="brand">{t("team.you")}</Badge> : null}
        </p>
        <p className="truncate text-xs text-slate-500">{m.email}</p>
        <p className="mt-1 flex flex-wrap gap-1.5">
          <Badge tone={m.mfa ? "green" : "amber"}>
            {m.mfa ? <ShieldCheck size={12} aria-hidden /> : <ShieldOff size={12} aria-hidden />}
            {t(m.mfa ? "team.mfaOn" : "team.mfaOff")}
          </Badge>
          {!m.instructionsAccepted ? <Badge tone="amber">{t("team.instructionsPending")}</Badge> : null}
        </p>
        {editable && m.mfa && m.sharedAccount ? <p className="mt-1 text-xs text-slate-500">{t("team.sharedAccount")}</p> : null}
      </div>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            {t("team.changeRole", { name: m.name })}
          </label>
          <Select
            id={selectId}
            value={role}
            disabled={pending}
            className="h-8 w-auto py-1 text-[13px]"
            onChange={(e) => setRole(e.target.value as MembershipRole)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {tc(`roles.${r}`)}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending || role === m.role}
            onClick={() =>
              window.confirm(t("team.changeRoleConfirm", { name: m.name, role: tc(`roles.${role}`) })) &&
              run(
                () => changeMemberRole(m.userId, role),
                (r) => !r.ok && setRole(m.role),
              )
            }
          >
            {t("team.changeRoleSubmit")}
          </Button>
          {m.mfa && !m.sharedAccount ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => window.confirm(t("team.resetMfaConfirm", { name: m.name })) && run(() => resetMemberMfa(m.userId))}
            >
              {t("team.resetMfa")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => window.confirm(t("team.removeConfirm", { name: m.name })) && run(() => removeMember(m.userId))}
          >
            <UserMinus size={14} aria-hidden /> {t("team.remove")}
          </Button>
        </div>
      ) : (
        <Badge tone={m.role === "owner" ? "brand" : "slate"}>{tc(`roles.${m.role}`)}</Badge>
      )}
    </li>
  );
}

function InviteForm({ roles }: { roles: readonly MembershipRole[] }) {
  const t = useT("security");
  const tc = useT("common");
  const { run, pending } = useSecureAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("reception");
  return (
    <form
      className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => inviteMember({ email, role }),
          (r) => r.ok && setEmail(""),
        );
      }}
    >
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <MailPlus size={16} aria-hidden /> {t("team.invite.title")}
      </h3>
      <p className="mb-3 mt-1 text-xs text-slate-500">{t("team.invite.description")}</p>
      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_auto] sm:items-end">
        <Field label={t("team.invite.email")}>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("team.invite.emailPlaceholder")} autoComplete="off" />
        </Field>
        <Field label={t("team.invite.role")}>
          <Select value={role} onChange={(e) => setRole(e.target.value as MembershipRole)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {tc(`roles.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={pending || !email}>
          {t("team.invite.submit")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t(`team.roleHelp.${role}`)}</p>
    </form>
  );
}
