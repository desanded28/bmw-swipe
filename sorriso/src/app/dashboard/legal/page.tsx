import { CircleAlert, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalAcceptForm, PrintDocumentButton } from "@/components/privacy-admin/LegalForms";
import { DpaDocument, StaffInstructionsDocument, SubprocessorsDocument, TermsDocument } from "@/components/privacy-admin/LegalDocuments";
import { Badge, Card, PageHeader } from "@/components/ui";
import type { LegalDoc } from "@/db/enums";
import { fmtDay, zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { getStaffLocale, getT } from "@/i18n/server";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { objectionMailto, pendingLegal, SUBPROCESSOR_CHANGES } from "@/lib/privacy/gates";
import { latestAcceptance } from "@/lib/privacy/legal";
import { legalDocumentData } from "@/lib/privacy/register";
import { LEGAL_VERSIONS } from "@/lib/privacy/versions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getStaffLocale(), "privacyAdmin")("legal.title") };
}

/** Print only the document being printed (see PrintDocumentButton); the dashboard chrome is hidden. */
const PRINT_CSS = `@media print {
  body[data-printing] * { visibility: hidden !important; }
  body[data-printing] .printing, body[data-printing] .printing * { visibility: visible !important; }
  body[data-printing] .printing { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
}`;

const ORG_DOCS = ["dpa", "terms", "subprocessors"] as const satisfies readonly LegalDoc[];

/**
 * The agreements between the practice and Sorriso, and the staff instructions. Owners and admins
 * (legal.accept) accept the DPA, terms and sub-processor list for the practice; every member
 * accepts the staff instructions for themselves. The dashboard gate sends people here until the
 * current versions are accepted (src/lib/privacy/gates.ts). Every member must be able to reach
 * it, so only a session is required.
 */
export default async function LegalPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const s = await requireStaff();
  const locale = await getStaffLocale();
  const t = getT(locale, "privacyAdmin");
  const lt = getT(locale, "legalPractice");
  const focus = (await searchParams).doc;
  const canAccept = can(s.role, "legal.accept");
  const [pending, latest, mine] = await Promise.all([
    pendingLegal(s),
    Promise.all(ORG_DOCS.map((d) => latestAcceptance(s.org.id, d))),
    latestAcceptance(s.org.id, "staff_instructions", s.user.id),
  ]);
  const data = legalDocumentData(locale, SUBPROCESSOR_CHANGES);
  const day = (d: Date) => fmtDay(zonedDate(d, s.org.timezone), "long", locale);
  const allDone = !pending.org.length && !pending.staffInstructions && !pending.subprocessors;

  const status = (acc: { version: string; acceptedAt: Date } | null, doc: LegalDoc) => {
    const current = LEGAL_VERSIONS[doc];
    if (acc?.version === current)
      return (
        <Badge tone="green">
          <CircleCheck size={12} aria-hidden /> {t("legal.accepted", { date: day(acc.acceptedAt), version: acc.version })}
        </Badge>
      );
    return (
      <Badge tone="amber">
        <CircleAlert size={12} aria-hidden /> {acc ? t("legal.outdated", { version: acc.version, current }) : t("legal.notAccepted", { version: current })}
      </Badge>
    );
  };

  const body = (doc: (typeof ORG_DOCS)[number]) =>
    doc === "dpa" ? (
      <DpaDocument t={lt} data={data} version={LEGAL_VERSIONS.subprocessors} />
    ) : doc === "terms" ? (
      <TermsDocument t={lt} />
    ) : (
      <SubprocessorsDocument t={lt} data={data} />
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <style>{PRINT_CSS}</style>
      <PageHeader title={t("legal.title")} description={t("legal.description")} />
      {pending.org.length && canAccept ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{t("legal.pendingOrg")}</p> : null}
      {pending.staffInstructions ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{t("legal.pendingStaff")}</p> : null}
      {allDone ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <CircleCheck size={16} aria-hidden /> {t("legal.allDone")}{" "}
          <Link href="/dashboard" className="font-semibold underline">
            {t("legal.continue")} →
          </Link>
        </p>
      ) : null}

      <Card id="doc-staff_instructions" className="scroll-mt-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-bold">{lt("staffInstructions.title")}</h2>
          {status(mine, "staff_instructions")}
        </div>
        <div className="mt-3">
          <StaffInstructionsDocument t={lt} version={LEGAL_VERSIONS.staff_instructions} />
        </div>
        {mine?.version !== LEGAL_VERSIONS.staff_instructions ? <LegalAcceptForm doc="staff_instructions" label={lt("staffInstructions.accept")} /> : null}
      </Card>

      {ORG_DOCS.map((doc, i) => {
        const acc = latest[i];
        const current = acc?.version === LEGAL_VERSIONS[doc];
        const id = `doc-${doc}`;
        return (
          <Card key={doc} className="scroll-mt-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-bold">{lt(`docs.${doc}`)}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {status(acc, doc)}
                <PrintDocumentButton targetId={id} label={t("legal.print")} />
              </div>
            </div>
            <details id={id} open={focus === doc || (!current && canAccept)} className="mt-3 rounded-xl bg-white">
              <summary className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">{t("legal.readFull")}</summary>
              <div className="mt-2 max-h-[70vh] overflow-y-auto pr-2 print:max-h-none print:overflow-visible">{body(doc)}</div>
            </details>
            <p className="mt-2 text-xs">
              <a href={lhref(locale, `/legal/${doc}`)} target="_blank" rel="noopener" className="text-brand-700 hover:underline">
                {lhref(locale, `/legal/${doc}`)}
              </a>
            </p>
            {!current ? (
              canAccept ? (
                <LegalAcceptForm doc={doc} label={t(`legal.acceptFor.${doc}`)} />
              ) : (
                <p className="mt-3 text-sm text-slate-500">{t("legal.ownerOnly")}</p>
              )
            ) : null}
            {doc === "subprocessors" && canAccept ? (
              <p className="mt-3 text-sm text-slate-600">
                <a href={objectionMailto(s.org.name, LEGAL_VERSIONS.subprocessors)} className="font-semibold text-brand-700 hover:underline">
                  {t("legal.object")}
                </a>{" "}
                · {t("legal.objectHint")}
              </p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
