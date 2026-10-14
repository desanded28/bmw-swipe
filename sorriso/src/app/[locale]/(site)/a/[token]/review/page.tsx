import { BadgeCheck, CalendarCheck, Heart, LinkIcon, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ReviewForm } from "@/components/ReviewForm";
import { Badge, Button, Card, LinkButton, Stars } from "@/components/ui";
import { toLocale, type Locale } from "@/i18n/config";
import { ClientMessages } from "@/i18n/ClientMessages";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { formatDecimal } from "@/i18n/number";
import { rich } from "@/i18n/rich";
import { getT } from "@/i18n/server";
import { getAppointmentDetails } from "@/lib/appointments";
import { isAutomatedRequest } from "@/lib/directory";
import { practitionerName } from "@/lib/format";
import { isManageLinkValid } from "@/lib/links";
import { editableUntil, firstInitialName, reviewForAppointment } from "@/lib/reviews";
import { isMinor } from "@/lib/contact";
import { deleteReviewAction, submitReviewAction, updateReviewAction } from "./actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; token: string }>;

/** Generic on purpose: link previews must name neither the practice nor the patient. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale, "reviews");
  return { title: t("page.metaTitle"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

function Notice({ locale, icon, title, children }: { locale: Locale; icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  const tm = getT(locale, "manage");
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden>
        {icon}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
      {children ? <div className="mt-2 space-y-2 text-slate-600">{children}</div> : null}
      <LinkButton href={lhref(locale, "/")} variant="secondary" className="mt-6">
        {tm("home")}
      </LinkButton>
    </div>
  );
}

/**
 * The author's review of a completed visit, through their visit link: write it (with the
 * publication consent), see its status, edit or delete it while the link is valid. No treatment
 * name anywhere: the page names only the practitioner and the practice.
 */
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ done?: string; deleted?: string; edit?: string }>;
}) {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale, "reviews");
  const tm = getT(locale, "manage");
  const ta = getT(locale, "a11y");
  const sp = await searchParams;

  // Link previewers and crawlers get nothing about the visit.
  if (isAutomatedRequest(await headers())) {
    return (
      <Notice locale={locale} icon={<CalendarCheck size={26} />} title={tm("preview.title")}>
        <p>{tm("preview.body")}</p>
      </Notice>
    );
  }
  if (sp.deleted) return <Notice locale={locale} icon={<Trash2 size={26} />} title={t("page.deleted")} />;

  const d = /^[A-Za-z0-9_-]{8,128}$/.test(token) ? await getAppointmentDetails({ token }) : null;
  if (!d || !isManageLinkValid(d.appointment)) {
    return (
      <Notice locale={locale} icon={<LinkIcon size={26} />} title={tm("invalid.title")}>
        <p>{t("errors.linkInvalid")}</p>
      </Notice>
    );
  }
  const review = await reviewForAppointment(d.appointment.id);
  const clinic = d.org.name;
  const doctor = practitionerName(d.practitioner);
  const nameChoice = isMinor(d.patient) ? null : firstInitialName(d.patient);
  const until = fmtDay(zonedDate(editableUntil(d), d.org.timezone), "long", locale);
  const editable = review && review.status !== "removed" && review.status !== "withdrawn";
  const link = "font-semibold text-brand-700 underline underline-offset-2";

  const header = (
    <>
      <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
        <BadgeCheck size={14} aria-hidden /> {t("page.kicker")}
      </p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{t("page.title", { name: doctor })}</h1>
      <p className="mb-5 mt-1 text-sm text-slate-600">{t("page.subtitle", { clinic })}</p>
    </>
  );

  let body: React.ReactNode;
  if (review && !(sp.edit && editable)) {
    const author = review.authorDisplay === "first_initial" ? review.authorName : t("author.pseudonym");
    body = (
      <>
        {sp.done ? (
          <div className="mb-6 text-center" role="status">
            <Heart size={40} className="mx-auto fill-rose-400 text-rose-400" aria-hidden />
            <h1 className="mt-3 text-2xl font-extrabold">{t("page.thanksTitle")}</h1>
            <p className="mt-2 text-slate-600">{review.status === "published" ? t("page.thanksPublished") : t("page.thanksHeld")}</p>
          </div>
        ) : (
          header
        )}
        <section aria-labelledby="your-review" className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <h2 id="your-review" className="text-sm font-bold">
            {t("page.yourReview")}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Stars value={review.rating} label={ta("rating.stars", { rating: formatDecimal(review.rating, locale) })} />
            <span className="text-sm font-semibold">{author}</span>
            <Badge tone={review.status === "published" ? "green" : review.status === "under_review" ? "amber" : "slate"}>
              {t("page.statusLine", { status: t(`status.${review.status}`) })}
            </Badge>
          </div>
          {review.comment ? <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{review.comment}</p> : null}
          {review.status === "removed" ? <p className="mt-2 text-sm text-slate-600">{t("page.removedNote")}</p> : null}
        </section>
        {editable ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-slate-600">
              {rich(t, "page.editUntil", { link: (c) => <Link href={lhref(locale, "/privacy")} className={link}>{c}</Link> }, { date: until })}
            </p>
            <div className="flex flex-wrap gap-3">
              <LinkButton href={lhref(locale, `/a/${token}/review?edit=1`)} variant="secondary">
                {t("page.edit")}
              </LinkButton>
            </div>
            <details className="rounded-xl p-3 ring-1 ring-red-200">
              <summary className="cursor-pointer text-sm font-semibold text-red-700">{t("page.delete")}</summary>
              <p className="mt-2 text-sm text-slate-600">{t("page.deleteHint")}</p>
              <form action={deleteReviewAction.bind(null, token, locale)} className="mt-3">
                <Button type="submit" variant="danger" size="sm">
                  <Trash2 size={14} aria-hidden /> {t("page.deleteConfirm")}
                </Button>
              </form>
            </details>
          </div>
        ) : null}
        <LinkButton href={lhref(locale, `/c/${d.org.slug}`)} variant="ghost" className="mt-6">
          {t("page.back", { clinic })}
        </LinkButton>
      </>
    );
  } else if (d.appointment.status !== "completed") {
    body = (
      <>
        {header}
        <p className="text-slate-600">{t("page.notCompleted")}</p>
      </>
    );
  } else {
    body = (
      <>
        {header}
        <ClientMessages locale={locale} ns={["reviews", "consents"]}>
          {review ? (
            <ReviewForm
              mode="edit"
              action={updateReviewAction.bind(null, token, locale)}
              practice={clinic}
              practitioner={doctor}
              firstInitialName={nameChoice}
              initial={{ rating: review.rating, comment: review.comment, display: review.authorDisplay }}
            />
          ) : (
            <ReviewForm mode="create" action={submitReviewAction.bind(null, token, locale)} practice={clinic} practitioner={doctor} firstInitialName={nameChoice} />
          )}
        </ClientMessages>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card className="p-7">{body}</Card>
    </div>
  );
}
