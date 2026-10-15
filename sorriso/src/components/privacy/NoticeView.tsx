import { ArrowUp, Languages, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * A privacy notice as built by buildNotice() (src/lib/privacy/notices.ts): the title, the version
 * and the date it is in force from, the "Italian version prevails" banner on translations, a
 * highlighted first layer ("In short", the section with id "summary"), a table of contents with
 * anchors, then every section.
 *
 * Section bodies are plain text: paragraphs separated by a blank line; a paragraph whose lines all
 * start with "- " is a list. URLs, "www." addresses and email addresses become links. Nothing is
 * parsed as HTML. Works in server and client components (no hooks); texts come in translated.
 */

export type NoticeViewSection = { id: string; title: string; body: string };

export type NoticeViewProps = {
  title: string;
  lead?: string | null;
  sections: NoticeViewSection[];
  /** "Version 2026-10" and "In force since 14 October 2026", already translated. */
  version: string;
  updated: string;
  labels: { contents: string; backToTop: string; otherNotices: string };
  /** Shown on every translation: the Italian text prevails. */
  italian?: { text: string; linkLabel: string; href: string } | null;
  related?: { href: string; label: string }[];
  /** Extra content under the first layer (e.g. a link to the privacy center). */
  children?: ReactNode;
};

const LINK = /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Text with its URLs and email addresses as links; trailing punctuation stays text. */
export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0;
    const raw = m[0];
    const trail = raw.match(/[.,;:!?)]+$/)?.[0] ?? "";
    const token = raw.slice(0, raw.length - trail.length);
    if (start > last) out.push(text.slice(last, start));
    const href = token.includes("@") && !token.includes("/") ? `mailto:${token}` : token.startsWith("www.") ? `https://${token}` : token;
    out.push(
      <a key={start} href={href} className="break-words font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
        {token}
      </a>,
    );
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The blocks of a section body: lists and paragraphs (lines inside a paragraph stay separate). */
export function NoticeBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-slate-400">
              {lines.map((l, j) => (
                <li key={j}>{linkify(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j ? <br /> : null}
                {linkify(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

export function NoticeView({ title, lead, sections, version, updated, labels, italian, related, children }: NoticeViewProps) {
  const summary = sections.find((s) => s.id === "summary");
  const rest = sections.filter((s) => s !== summary);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6" aria-labelledby="notice-title">
      <header id="top">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
          <ShieldCheck size={16} aria-hidden /> {version}
        </p>
        <h1 id="notice-title" className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {title}
        </h1>
        {lead ? <p className="mt-2 text-slate-600">{lead}</p> : null}
        <p className="mt-2 text-sm text-slate-500">{updated}</p>
      </header>

      {italian ? (
        <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200" role="note">
          <Languages size={16} className="shrink-0" aria-hidden />
          <span>{italian.text}</span>
          <Link href={italian.href} lang="it" hrefLang="it" className="font-semibold underline underline-offset-2">
            {italian.linkLabel}
          </Link>
        </p>
      ) : null}

      {summary ? (
        <section id={summary.id} aria-labelledby={`h-${summary.id}`} className="mt-6 rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-200">
          <h2 id={`h-${summary.id}`} className="text-lg font-bold text-brand-900">
            {summary.title}
          </h2>
          <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-slate-800">
            <NoticeBody text={summary.body} />
          </div>
          {children ? <div className="mt-4">{children}</div> : null}
        </section>
      ) : null}

      {rest.length > 1 ? (
        <nav aria-label={labels.contents} className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/70">
          <h2 className="text-sm font-semibold text-slate-700">{labels.contents}</h2>
          <ol className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {rest.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-8 items-center gap-2 text-brand-700 underline-offset-2 hover:underline">
                  <span className="w-5 text-right text-xs text-slate-600" aria-hidden>
                    {i + 1}.
                  </span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="mt-8 space-y-8">
        {rest.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`h-${s.id}`} className="scroll-mt-24">
            <h2 id={`h-${s.id}`} className="text-xl font-bold tracking-tight text-ink">
              {s.title}
            </h2>
            <div className="mt-2 space-y-3 leading-relaxed text-slate-700">
              <NoticeBody text={s.body} />
            </div>
          </section>
        ))}
      </div>

      {related?.length ? (
        <nav aria-label={labels.otherNotices} className="mt-10 border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-700">{labels.otherNotices}</h2>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="font-semibold text-brand-700 underline-offset-2 hover:underline">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <p className="mt-8">
        <a href="#top" className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <ArrowUp size={14} aria-hidden /> {labels.backToTop}
        </a>
      </p>
    </article>
  );
}
