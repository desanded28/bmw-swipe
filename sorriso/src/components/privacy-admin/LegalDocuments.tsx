import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import type { Translator } from "@/i18n/types";
import { Badge } from "../ui";

/**
 * The practice-facing legal documents, rendered on the server for both the public pages
 * (/{locale}/legal/dpa, /terms, /subprocessors) and the dashboard's acceptance page. Texts come
 * from the legalPractice namespace (Italian authoritative); the annexes are generated from the
 * code (register.ts legalDocumentData). Printable: the browser's "save as PDF" gives the PDF.
 */

type T = Translator<"legalPractice">;

/** Paragraphs separated by a blank line in the dictionary. */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className={className ?? "mb-3 leading-relaxed text-slate-700"}>
          {p}
        </p>
      ))}
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 break-inside-avoid-page">
      <h2 className="mb-2 mt-8 text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Contents({ t, items }: { t: T; items: { id: string; title: string }[] }) {
  return (
    <nav aria-label={t("common.contents")} className="my-6 rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200 print:hidden">
      <p className="mb-2 font-semibold">{t("common.contents")}</p>
      <ol className="grid gap-1 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className="text-brand-700 hover:underline">
              {i.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DocumentHeader({ title, version, intro, italianNote }: { title: string; version: string; intro?: string; italianNote?: string | null }) {
  return (
    <header>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{version}</p>
      {italianNote ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {italianNote}
        </p>
      ) : null}
      {intro ? <p className="mt-4 leading-relaxed text-slate-700">{intro}</p> : null}
    </header>
  );
}

const DPA_SECTIONS = [
  "parties",
  "subject",
  "instructions",
  "confidentiality",
  "security",
  "subprocessors",
  "rights",
  "assistance",
  "breach",
  "audits",
  "deletion",
  "transfers",
  "ownPurposes",
  "controller",
  "liability",
  "law",
] as const;

export type SubprocessorRow = {
  id: string;
  name: string;
  legalEntity: string;
  parent: string | null;
  service: string;
  data: string;
  region: string;
  transfer: string;
  dpaUrl: string | null;
  onlyWhatsapp: boolean;
};

export type LegalData = {
  platform: string;
  annex1: { id: string; activity: string; purpose: string; legalBasis: string; subjects: string; dataCategories: string }[];
  controls: { id: string; title: string; body: string }[];
  subprocessors: SubprocessorRow[];
  changes: { version: string; announced: string; effective: string; items: string[] }[];
};

/** The Art. 28 agreement with its three annexes. */
export function DpaDocument({ t, data, version }: { t: T; data: LegalData; version: string }) {
  const toc = [
    ...DPA_SECTIONS.map((s) => ({ id: `dpa-${s}`, title: t(`dpa.${s}.title`) })),
    { id: "dpa-annex1", title: t("dpa.annex1.title") },
    { id: "dpa-annex2", title: t("dpa.annex2.title") },
    { id: "dpa-annex3", title: t("dpa.annex3.title") },
  ];
  return (
    <article className="max-w-none">
      <Contents t={t} items={toc} />
      {DPA_SECTIONS.map((s) => (
        <Section key={s} id={`dpa-${s}`} title={t(`dpa.${s}.title`)}>
          <Paragraphs text={s === "parties" ? t("dpa.parties.body", { platform: data.platform }) : t(`dpa.${s}.body`)} />
        </Section>
      ))}
      <Section id="dpa-annex1" title={t("dpa.annex1.title")}>
        <p className="mb-3 text-sm text-slate-600">{t("dpa.annex1.intro")}</p>
        <div className="space-y-3">
          {data.annex1.map((a) => (
            <div key={a.id} className="rounded-xl p-3 text-sm ring-1 ring-slate-200 break-inside-avoid">
              <p className="font-semibold">{a.activity}</p>
              <p className="text-slate-700">{a.purpose}</p>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[160px_1fr]">
                <dt className="text-slate-500">{t("register.columns.legalBasis")}</dt>
                <dd>{a.legalBasis}</dd>
                <dt className="text-slate-500">{t("register.columns.subjects")}</dt>
                <dd>{a.subjects}</dd>
                <dt className="text-slate-500">{t("register.columns.dataCategories")}</dt>
                <dd>{a.dataCategories}</dd>
              </dl>
            </div>
          ))}
        </div>
      </Section>
      <Section id="dpa-annex2" title={t("dpa.annex2.title")}>
        <p className="mb-3 text-sm text-slate-600">{t("dpa.annex2.intro")}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.controls.map((c) => (
            <li key={c.id} className="rounded-xl p-3 text-sm ring-1 ring-slate-200 break-inside-avoid">
              <p className="font-semibold">{c.title}</p>
              <p className="text-slate-700">{c.body}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="dpa-annex3" title={t("dpa.annex3.title")}>
        <p className="mb-3 text-sm text-slate-600">{t("dpa.annex3.intro", { version })}</p>
        <SubprocessorTable t={t} rows={data.subprocessors} />
      </Section>
    </article>
  );
}

const TERMS_SECTIONS = ["service", "account", "data", "obligations", "marketplace", "availability", "fees", "ip", "suspension", "exit", "liability", "complaints", "changes", "law"] as const;

export function TermsDocument({ t }: { t: T }) {
  return (
    <article>
      <Contents t={t} items={TERMS_SECTIONS.map((s) => ({ id: `terms-${s}`, title: t(`terms.${s}.title`) }))} />
      {TERMS_SECTIONS.map((s) => (
        <Section key={s} id={`terms-${s}`} title={t(`terms.${s}.title`)}>
          <Paragraphs text={t(`terms.${s}.body`)} />
        </Section>
      ))}
    </article>
  );
}

export function SubprocessorTable({ t, rows }: { t: T; rows: SubprocessorRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-3 py-2">
              {t("subprocessors.columns.name")}
            </th>
            <th scope="col" className="px-3 py-2">
              {t("subprocessors.columns.service")}
            </th>
            <th scope="col" className="px-3 py-2">
              {t("subprocessors.columns.data")}
            </th>
            <th scope="col" className="px-3 py-2">
              {t("subprocessors.columns.region")}
            </th>
            <th scope="col" className="px-3 py-2">
              {t("subprocessors.columns.transfer")}
            </th>
            <th scope="col" className="px-3 py-2">
              {t("subprocessors.columns.dpa")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 align-top">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2">
                <span className="font-semibold">{r.name}</span>
                <span className="block text-xs text-slate-500">{r.legalEntity}</span>
                {r.parent ? <span className="block text-xs text-slate-500">{t("subprocessors.parent", { parent: r.parent })}</span> : null}
                {r.onlyWhatsapp ? (
                  <Badge tone="amber" className="mt-1">
                    {t("subprocessors.onlyWhatsapp")}
                  </Badge>
                ) : null}
              </td>
              <td className="px-3 py-2">{r.service}</td>
              <td className="px-3 py-2 text-slate-700">{r.data}</td>
              <td className="px-3 py-2">{r.region}</td>
              <td className="px-3 py-2">{r.transfer}</td>
              <td className="px-3 py-2">
                {r.dpaUrl ? (
                  <a href={r.dpaUrl} rel="noopener noreferrer" target="_blank" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    {t("subprocessors.viewDpa")} <ExternalLink size={12} aria-hidden />
                  </a>
                ) : (
                  <span className="text-slate-500">{t("common.onRequest")}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SubprocessorsDocument({ t, data }: { t: T; data: LegalData }) {
  return (
    <article>
      <Paragraphs text={t("subprocessors.intro")} />
      <SubprocessorTable t={t} rows={data.subprocessors} />
      <Section id="notice" title={t("subprocessors.changelog")}>
        <Paragraphs text={t("subprocessors.noticeRule")} />
        <Paragraphs text={t("subprocessors.transfersNote")} className="mb-3 text-sm leading-relaxed text-slate-600" />
        <ol className="mt-4 space-y-3">
          {data.changes.map((c) => (
            <li key={c.version} className="rounded-xl p-3 text-sm ring-1 ring-slate-200">
              <p className="font-semibold">
                {t("common.version", { version: c.version })} · {t("common.effective", { date: c.effective })}
              </p>
              <p className="text-xs text-slate-500">{t("subprocessors.announced", { date: c.announced })}</p>
              <ul className="mt-1 list-disc pl-5">
                {c.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>
    </article>
  );
}

const STAFF_ITEMS = ["confidentiality", "needToKnow", "freeText", "breaches", "personalDevices", "calendarSync", "adTools", "restricted", "accessLog"] as const;

/** The Art. 29 instructions every staff member accepts (also shown by the invite flow). */
export function StaffInstructionsDocument({ t, version }: { t: T; version: string }) {
  return (
    <article>
      <p className="mb-1 text-sm text-slate-500">{t("staffInstructions.version", { version })}</p>
      <p className="mb-3 leading-relaxed text-slate-700">{t("staffInstructions.intro")}</p>
      <ol className="list-decimal space-y-2 pl-5 leading-relaxed text-slate-700">
        {STAFF_ITEMS.map((k) => (
          <li key={k}>{t(`staffInstructions.${k}`)}</li>
        ))}
      </ol>
    </article>
  );
}
