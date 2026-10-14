import { ClipboardList, Hourglass, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { AnamnesisForm } from "@/components/care/AnamnesisForm";
import { LinkButton } from "@/components/ui";
import { toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { fmtDay, fmtWhen, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getT } from "@/i18n/server";
import { audit } from "@/lib/audit";
import { anamnesisAccess, isPreviewBot, TOKEN_SHAPE } from "@/lib/forms";
import { rateLimitByIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; token: string }>;

/** Same budget as the manage page: generous for a patient, tight for someone guessing tokens. */
const LINK_LIMIT = 30;
const LINK_WINDOW_MS = 10 * 60 * 1000;

/** Generic: link previews must show neither the practice nor the patient. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "care");
  return {
    title: t("form.metaTitle"),
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

function Message({ locale, token, text, icon }: { locale: Locale; token: string | null; text: string; icon: React.ReactNode }) {
  const t = getT(locale, "care");
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden>
        {icon}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t("form.closed.title")}</h1>
      <p className="mt-2 text-slate-600">{text}</p>
      {token ? (
        <LinkButton href={lhref(locale, `/a/${token}`)} variant="secondary" className="mt-6">
          {t("form.closed.back")}
        </LinkButton>
      ) : null}
    </div>
  );
}

/** The patient's medical-history form, opened from their appointment link (no account). */
export default async function AnamnesisPage({ params }: { params: Params }) {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale, "care");
  const h = await headers();

  if (isPreviewBot(h.get("user-agent"))) {
    return <Message locale={locale} token={null} text={t("form.preview")} icon={<ClipboardList size={26} />} />;
  }
  const limit = await rateLimitByIp(h, "patient-link", LINK_LIMIT, LINK_WINDOW_MS);
  if (!limit.ok) return <Message locale={locale} token={null} text={t("form.errors.rate_limited")} icon={<Hourglass size={26} />} />;

  const access = TOKEN_SHAPE.test(token) ? await anamnesisAccess(token) : ({ ok: false, reason: "invalid" } as const);
  if (!access.ok) {
    const text =
      access.reason === "disabled"
        ? t("form.closed.disabled")
        : access.reason === "closed"
          ? t("form.closed.closed")
          : access.reason === "restricted"
            ? t("form.closed.restricted")
            : t("form.closed.invalid");
    return <Message locale={locale} token={access.reason === "invalid" ? null : token} text={text} icon={<ClipboardList size={26} />} />;
  }

  const { d, template, current, contactHint } = access;
  // The patient opened their own appointment's form through the link only they received.
  await audit({
    orgId: d.org.id,
    actor: { type: "patient_link", id: d.appointment.id },
    action: "appointment.view",
    entity: { type: "appointment", id: d.appointment.id },
    metadata: { page: "anamnesis" },
    headers: h,
  });
  const tz = d.location.timezone;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm font-semibold text-slate-600">{d.org.name}</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{t("form.title")}</h1>
      <p className="mt-2 text-slate-700">
        {t("form.intro", { clinic: d.org.name, when: fmtWhen(d.appointment.startsAt, tz, locale) })}
      </p>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 ring-1 ring-brand-200">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
        {t("form.privacy", { clinic: d.org.name })}
      </p>
      {current ? (
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200" role="status">
          {t("form.alreadySent", { date: fmtDay(zonedDate(current.signedAt, tz), "long", locale) })}
        </p>
      ) : null}
      <div className="mt-6">
        <ClientMessages locale={locale} ns={["care"]}>
          <AnamnesisForm token={token} schema={template.schema} clinic={d.org.name} contactHint={contactHint?.masked ?? null} />
        </ClientMessages>
      </div>
    </div>
  );
}
