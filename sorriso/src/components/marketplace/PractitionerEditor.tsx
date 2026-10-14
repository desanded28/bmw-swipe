"use client";

import { CircleCheck, Eye, LoaderCircle, ShieldAlert, ShieldCheck, UserX } from "lucide-react";
import { useActionState, useId, useState, type KeyboardEvent } from "react";
import type { ActionResult } from "@/app/dashboard/actions/_shared";
import { approvePublicProfile, revokeProfileApproval, savePractitioner, setMarketplaceOptOut } from "@/app/dashboard/actions/practitioners";
import { LEGAL_SPECIALIZATIONS, SPOKEN_LANGUAGES, type LegalSpecialization, type ServiceCategory, type SpokenLanguage } from "@/db/enums";
import type { PractitionerCareOptions } from "@/db/schema";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { useLocale, useT } from "@/i18n/provider";
import { checkAdvertising } from "@/lib/compliance/advertising";
import { practitionerName } from "@/lib/format";
import { useRunAction } from "../dashboard/useRunAction";
import { Avatar, Badge, Button, cx, Input, Textarea } from "../ui";
import { FindingsPreview } from "./Highlighted";
import { ProfileFacts } from "./ProfileFacts";

/** The practitioner fields the editor needs (no feed tokens or other internals reach the browser). */
export type EditorPractitioner = {
  id: string;
  title: string;
  name: string;
  specialty: string;
  bio: string | null;
  color: string;
  licenseNumber: string | null;
  acceptsNewPatients: boolean;
  active: boolean;
  spokenLanguages: SpokenLanguage[];
  specializations: LegalSpecialization[];
  careOptions: PractitionerCareOptions;
  alboProvince: string | null;
  alboNumber: string | null;
  alboVerifiedAt: Date | null;
  publicProfile: boolean;
  profileApprovedAt: Date | null;
  marketplaceOptOutAt: Date | null;
};

export type EditorViewer = {
  /** team.manage: may edit the record and the profile fields. */
  canManage: boolean;
  /** The practice owner or the practitioner themselves. */
  canApprove: boolean;
  /** The practitioner's own linked account. */
  isSelf: boolean;
};

const CARE_KEYS = ["children", "anxiousPatients", "sedation", "specialNeeds"] as const;
type Tab = "details" | "public";

/**
 * Practitioner record and public profile, in two tabs of one form, with a live preview of what
 * patients will see. Approval (practitioner or owner), the practitioner's own "remove me from the
 * marketplace", and the Albo status sit next to the preview. Promotional wording is highlighted
 * as it is typed (the save action blocks it on the server too).
 */
export function PractitionerEditor({
  practitioner: p,
  services,
  offered,
  viewer,
  org,
}: {
  practitioner: EditorPractitioner | null;
  services: { id: string; name: string; category: ServiceCategory }[];
  offered: string[];
  viewer: EditorViewer;
  org: { timezone: string };
}) {
  const t = useT("marketplace");
  const tc = useT("common");
  const tcat = useT("catalog");
  const locale = useLocale();
  const uid = useId();
  const [state, formAction, saving] = useActionState<ActionResult | null, FormData>(savePractitioner.bind(null, p?.id ?? null), null);
  const { run, pending } = useRunAction();
  const [tab, setTab] = useState<Tab>(viewer.canManage ? "details" : "public");
  const [confirmOptOut, setConfirmOptOut] = useState(false);
  const initial = {
    title: p?.title ?? "Dr.",
    name: p?.name ?? "",
    specialty: p?.specialty ?? "",
    bio: p?.bio ?? "",
    languages: p?.spokenLanguages ?? ["it"],
    specializations: p?.specializations ?? [],
    care: p?.careOptions ?? {},
  };
  const [title, setTitle] = useState(initial.title);
  const [name, setName] = useState(initial.name);
  const [specialty, setSpecialty] = useState(initial.specialty);
  const [bio, setBio] = useState(initial.bio);
  const [languages, setLanguages] = useState<SpokenLanguage[]>(initial.languages);
  const [specializations, setSpecializations] = useState<LegalSpecialization[]>(initial.specializations);
  const [care, setCare] = useState<PractitionerCareOptions>(initial.care);
  const dirty =
    title !== initial.title ||
    name !== initial.name ||
    specialty !== initial.specialty ||
    bio !== initial.bio ||
    languages.join() !== initial.languages.join() ||
    specializations.join() !== initial.specializations.join() ||
    CARE_KEYS.some((k) => Boolean(care[k]) !== Boolean(initial.care[k]));
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const day = (d: Date) => fmtDay(zonedDate(d, org.timezone), "long", locale);
  const adSpecialty = checkAdvertising(specialty);
  const adBio = checkAdvertising(bio);
  const ro = !viewer.canManage;
  const optedOut = Boolean(p?.marketplaceOptOutAt);
  const listed = Boolean(p && p.publicProfile && p.profileApprovedAt && !optedOut);
  const statusText = !p
    ? null
    : optedOut
      ? t("profile.status.optedOut")
      : !p.publicProfile
        ? t("profile.status.notPublic")
        : !p.profileApprovedAt
          ? t("profile.status.awaitingApproval")
          : t("profile.status.listed");

  const tabs: { id: Tab; label: string }[] = [
    { id: "details", label: t("profile.tabs.details") },
    { id: "public", label: t("profile.tabs.public") },
  ];
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = tab === "details" ? "public" : "details";
    setTab(next);
    document.getElementById(`${uid}tab-${next}`)?.focus();
  };
  const label = "mb-1.5 block text-[13px] font-semibold text-slate-700";
  const check = "flex items-center gap-2 text-sm text-slate-700";
  const hint = "mt-1 block text-xs text-slate-500";

  const preview = (
    <aside aria-labelledby={`${uid}preview`} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p id={`${uid}preview`} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
        <Eye size={14} aria-hidden /> {t("profile.preview")}
      </p>
      <p className="mb-3 text-xs text-slate-500">{t("profile.previewHint")}</p>
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <Avatar name={name || "?"} color={p?.color ?? "#0d9488"} size={44} />
          <div className="min-w-0">
            <p className="font-bold">{name ? practitionerName({ title, name }) : t("profile.previewEmpty")}</p>
            <p className="text-sm text-slate-600">{specialty}</p>
          </div>
        </div>
        {bio ? <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{bio}</p> : null}
        <div className="mt-3">
          <ProfileFacts
            profile={{
              spokenLanguages: languages,
              careOptions: care,
              specializations: p?.alboVerifiedAt ? specializations : [],
              albo: p?.alboVerifiedAt && p.alboProvince ? { province: p.alboProvince, verifiedAt: p.alboVerifiedAt } : null,
            }}
          />
        </div>
      </div>
    </aside>
  );

  const listing = p ? (
    <section aria-labelledby={`${uid}listing`} className="space-y-3 rounded-2xl p-4 ring-1 ring-slate-200">
      <h3 id={`${uid}listing`} className="text-sm font-bold">
        {t("profile.status.title")}
      </h3>
      <p className="flex items-start gap-2 text-sm">
        {listed ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden /> : <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />}
        <span>{statusText}</span>
      </p>
      {!optedOut ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-[13px] font-semibold text-slate-700">{t("profile.approval.title")}</p>
          {p.profileApprovedAt ? (
            <p className="text-sm text-slate-600">{t("profile.approval.approvedBy", { date: day(p.profileApprovedAt) })}</p>
          ) : (
            <p className="text-sm text-slate-600">{t("profile.approval.needed")}</p>
          )}
          {viewer.canApprove ? (
            p.profileApprovedAt ? (
              <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => revokeProfileApproval(p.id))}>
                {t("profile.approval.revoke")}
              </Button>
            ) : (
              <>
                <Button type="button" size="sm" disabled={pending || dirty} onClick={() => run(() => approvePublicProfile(p.id))} aria-describedby={`${uid}approvehint`}>
                  <CircleCheck size={15} aria-hidden /> {t("profile.approval.approve")}
                </Button>
                <p id={`${uid}approvehint`} className="text-xs text-slate-500">
                  {dirty ? t("profile.approval.saveFirst") : t("profile.approval.approveHint")}
                </p>
              </>
            )
          ) : null}
        </div>
      ) : null}
      {viewer.isSelf ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-[13px] font-semibold text-slate-700">{t("profile.optOut.title")}</p>
          {optedOut ? (
            <>
              <p className="text-sm text-slate-600">{t("profile.optOut.removedOn", { date: day(p.marketplaceOptOutAt!) })}</p>
              <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setMarketplaceOptOut(p.id, false))}>
                {t("profile.optOut.undo")}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">{t("profile.optOut.body")}</p>
              {confirmOptOut ? (
                <div role="alertdialog" aria-labelledby={`${uid}optout`} className="space-y-2 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
                  <p id={`${uid}optout`} className="text-sm font-semibold text-red-800">
                    {t("profile.optOut.confirm")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      onClick={() => run(() => setMarketplaceOptOut(p.id, true), () => setConfirmOptOut(false))}
                    >
                      {t("profile.optOut.confirmButton")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmOptOut(false)}>
                      {tc("actions.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" size="sm" variant="danger" onClick={() => setConfirmOptOut(true)}>
                  <UserX size={15} aria-hidden /> {t("profile.optOut.button")}
                </Button>
              )}
            </>
          )}
        </div>
      ) : optedOut && p.marketplaceOptOutAt ? (
        <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">{t("profile.optOut.ownerNote", { date: day(p.marketplaceOptOutAt) })}</p>
      ) : null}
    </section>
  ) : null;

  if (ro) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{t("profile.readOnly")}</p>
        {preview}
        {listing}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div role="tablist" aria-label={t("profile.tabs.label")} className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            id={`${uid}tab-${x.id}`}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            aria-controls={`${uid}panel-${x.id}`}
            tabIndex={tab === x.id ? 0 : -1}
            onClick={() => setTab(x.id)}
            onKeyDown={onTabKey}
            className={cx(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand-600",
              tab === x.id ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div id={`${uid}panel-details`} role="tabpanel" aria-labelledby={`${uid}tab-details`} hidden={tab !== "details"} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
          <div>
            <label htmlFor={`${uid}title`} className={label}>
              {t("profile.title")}
            </label>
            <Input id={`${uid}title`} name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={20} />
          </div>
          <div>
            <label htmlFor={`${uid}name`} className={label}>
              {t("profile.name")}
            </label>
            <Input id={`${uid}name`} name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          </div>
        </div>
        <div>
          <label htmlFor={`${uid}spec`} className={label}>
            {t("profile.areas")}
          </label>
          <Input id={`${uid}spec`} name="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} maxLength={120} aria-describedby={`${uid}spechint`} />
          <span id={`${uid}spechint`} className={hint}>
            {t("profile.areasHint")}
          </span>
          <FindingsPreview text={specialty} findings={adSpecialty} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}lic`} className={label}>
              {t("profile.licence")}
            </label>
            <Input id={`${uid}lic`} name="licenseNumber" defaultValue={p?.licenseNumber ?? ""} maxLength={40} />
          </div>
          <div>
            <label htmlFor={`${uid}color`} className={label}>
              {t("profile.calendarColour")}
            </label>
            <Input id={`${uid}color`} type="color" name="color" defaultValue={p?.color ?? "#0d9488"} className="h-10 !p-1" />
          </div>
        </div>
        <div>
          <label htmlFor={`${uid}bio`} className={label}>
            {t("profile.bio")}
          </label>
          <Textarea id={`${uid}bio`} name="bio" rows={4} maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)} aria-describedby={`${uid}biohint`} />
          <span id={`${uid}biohint`} className={hint}>
            {t("profile.bioHint")}
          </span>
          <FindingsPreview text={bio} findings={adBio} />
          {adBio.length || adSpecialty.length ? (
            <ul className="mt-2 space-y-0.5 text-xs text-slate-600" aria-live="polite">
              {[...new Set([...adBio, ...adSpecialty].map((f) => f.rule))].map((r) => (
                <li key={r}>{tcat(`advertising.rules.${r}`)}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <fieldset>
          <legend className={label}>{t("profile.treatments")}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ring-1 ring-slate-200">
                <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={offered.includes(s.id)} className="h-4 w-4 accent-brand-700" />
                <span className="flex-1">{s.name}</span>
                <span className="text-[11px] text-slate-500">{tc(`categories.${s.category}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-5">
          <label className={check}>
            <input type="checkbox" name="acceptsNewPatients" defaultChecked={p?.acceptsNewPatients ?? true} className="h-4 w-4 accent-brand-700" /> {t("profile.acceptsNew")}
          </label>
          <label className={check}>
            <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-4 w-4 accent-brand-700" /> {t("profile.active")}
          </label>
        </div>
      </div>

      <div id={`${uid}panel-public`} role="tabpanel" aria-labelledby={`${uid}tab-public`} hidden={tab !== "public"} className="space-y-5">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="publicProfile" defaultChecked={p?.publicProfile ?? false} className="mt-0.5 h-4 w-4 accent-brand-700" aria-describedby={`${uid}pubhint`} />
          <span>
            {t("profile.publicSwitch")}
            <span id={`${uid}pubhint`} className={hint}>
              {t("profile.publicSwitchHint")}
            </span>
          </span>
        </label>
        <fieldset>
          <legend className={label}>{t("profile.languages")}</legend>
          <p className="-mt-1 mb-2 text-xs text-slate-500">{t("profile.languagesHint")}</p>
          <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-auto rounded-lg p-1 ring-1 ring-slate-200 sm:grid-cols-3">
            {SPOKEN_LANGUAGES.map((l) => (
              <label key={l} className={check}>
                <input
                  type="checkbox"
                  name="spokenLanguages"
                  value={l}
                  checked={languages.includes(l)}
                  onChange={() => setLanguages(toggle(languages, l))}
                  className="h-4 w-4 accent-brand-700"
                />
                {tc(`languages.${l}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={label}>{t("profile.specializations")}</legend>
          <p className="-mt-1 mb-2 text-xs text-slate-500">{t("profile.specializationsHint")}</p>
          <div className="space-y-1.5">
            {LEGAL_SPECIALIZATIONS.map((sp) => (
              <label key={sp} className={check}>
                <input
                  type="checkbox"
                  name="specializations"
                  value={sp}
                  checked={specializations.includes(sp)}
                  onChange={() => setSpecializations(toggle(specializations, sp))}
                  className="h-4 w-4 accent-brand-700"
                />
                {t(`specializations.${sp}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={label}>{t("profile.careOptions")}</legend>
          <div className="space-y-1.5">
            {CARE_KEYS.map((k) => (
              <label key={k} className={check}>
                <input type="checkbox" name={`care.${k}`} checked={Boolean(care[k])} onChange={(e) => setCare({ ...care, [k]: e.target.checked })} className="h-4 w-4 accent-brand-700" />
                {t(`careOptions.${k}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className={label}>{t("profile.alboTitle")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}aprov`} className="mb-1 block text-xs font-semibold text-slate-600">
                {t("profile.alboProvince")}
              </label>
              <Input id={`${uid}aprov`} name="alboProvince" defaultValue={p?.alboProvince ?? ""} maxLength={40} />
            </div>
            <div>
              <label htmlFor={`${uid}anum`} className="mb-1 block text-xs font-semibold text-slate-600">
                {t("profile.alboNumber")}
              </label>
              <Input id={`${uid}anum`} name="alboNumber" defaultValue={p?.alboNumber ?? ""} maxLength={20} />
            </div>
          </div>
          <p className="text-xs text-slate-500">{t("profile.alboHint")}</p>
          <Badge tone={p?.alboVerifiedAt ? "green" : p?.alboNumber ? "amber" : "slate"}>
            {p?.alboVerifiedAt ? t("profile.alboStatus.verified", { date: day(p.alboVerifiedAt) }) : p?.alboNumber ? t("profile.alboStatus.pending") : t("profile.alboStatus.none")}
          </Badge>
        </fieldset>
        <div className="grid gap-4 lg:grid-cols-2">
          {preview}
          {listing}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
          {p ? t("profile.save") : t("profile.add")}
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
