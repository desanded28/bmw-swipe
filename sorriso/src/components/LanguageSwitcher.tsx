"use client";

import { Check, Globe } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ENDONYM, LOCALES, type Locale } from "@/i18n/config";
import { swapLocale } from "@/i18n/href";
import { useLocale, useT } from "@/i18n/provider";
import { cx } from "./ui";

type Props = {
  /** "menu": a compact disclosure (header, booking sidebar); "inline": a plain list (footer). */
  variant?: "menu" | "inline";
  /**
   * "cookie": through /api/locale, which remembers the choice (NEXT_LOCALE) and redirects.
   * "url": straight to the same page in the other language, for the embed: a cross-site iframe
   * can't set first-party cookies, so there the URL alone decides.
   */
  mode?: "cookie" | "url";
  /** Which side the menu opens towards. */
  align?: "left" | "right";
  className?: string;
  /**
   * The page's query without "?" as the server saw it (the proxy's x-search header): used for the
   * links rendered before useSearchParams is known, which are what a visitor without JavaScript
   * gets. Once hydrated, the switcher reads the live query itself.
   */
  search?: string;
};

/**
 * The language switcher: every language under its own name (lang and hreflang set), each a plain
 * link, so it works without JavaScript. The link keeps the page and its query. Choosing a language
 * is the only thing that sets the NEXT_LOCALE cookie.
 */
export function LanguageSwitcher({ search = "", ...props }: Props) {
  // useSearchParams suspends until the query is known; the fallback is the same switcher with the
  // query the server passed (none passed: the links drop it, and /api/locale falls back on the
  // Referer).
  return (
    <Suspense fallback={<Switcher {...props} search={search.replace(/^\?/, "")} />}>
      <WithSearch {...props} />
    </Suspense>
  );
}

function WithSearch(props: Omit<Props, "search">) {
  // null outside an App Router tree (tests, some error pages): no query to keep.
  const search = useSearchParams()?.toString() ?? "";
  return <Switcher {...props} search={search} />;
}

function Switcher({ variant = "menu", mode = "cookie", align = "right", className, search }: Omit<Props, "search"> & { search: string }) {
  const locale = useLocale();
  const ta = useT("a11y");
  const pathname = usePathname() || "/";
  const current = search ? `${pathname}?${search}` : pathname;
  const hrefFor = (l: Locale) =>
    mode === "url" ? swapLocale(current, l) : `/api/locale?${new URLSearchParams({ to: l, next: swapLocale(current, l) })}`;

  const options = LOCALES.map((l) => (
    <li key={l}>
      <a
        href={hrefFor(l)}
        lang={l}
        hrefLang={l}
        rel={mode === "cookie" ? "nofollow" : "alternate"}
        aria-current={l === locale ? "true" : undefined}
        className={cx(
          variant === "menu"
            ? "flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-100"
            : "inline-flex min-h-6 items-center hover:text-ink hover:underline",
          l === locale ? "font-bold text-ink" : "text-slate-600",
        )}
      >
        {ENDONYM[l]}
        {variant === "menu" && l === locale ? <Check size={15} className="text-brand-700" aria-hidden /> : null}
      </a>
    </li>
  ));

  if (variant === "inline") {
    return (
      <div className={className}>
        <p className="mb-2 font-semibold text-slate-800">{ta("language.label")}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">{options}</ul>
      </div>
    );
  }
  return <Menu align={align} className={className} locale={locale} options={options} />;
}

/** A <details> disclosure: keyboard and screen-reader friendly with no script; Escape and outside clicks close it once hydrated. */
function Menu({
  align,
  className,
  locale,
  options,
}: {
  align: "left" | "right";
  className?: string;
  locale: Locale;
  options: React.ReactNode;
}) {
  const ta = useT("a11y");
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <details
      ref={ref}
      className={cx("group relative", className)}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current?.open) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <Globe size={16} aria-hidden />
        <span aria-hidden lang={locale} className="hidden sm:inline">
          {ENDONYM[locale]}
        </span>
        <span aria-hidden className="uppercase sm:hidden">
          {locale}
        </span>
        <span className="sr-only">{ta("language.current", { language: ENDONYM[locale] })}</span>
      </summary>
      <ul
        className={cx(
          "absolute z-40 mt-2 w-48 rounded-xl bg-white p-1 shadow-pop ring-1 ring-slate-200",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {options}
      </ul>
    </details>
  );
}
