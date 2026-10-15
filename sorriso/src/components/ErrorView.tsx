"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/i18n/provider";
import { Button, LinkButton } from "./ui";

/**
 * What an error boundary (error.tsx) shows inside its layout: in the page's language (common.pages),
 * with the layout around it kept, a retry and a way home. Focus moves to the heading, so a screen
 * reader announces what happened instead of staying on a control that no longer exists.
 * global-error.tsx stays the last resort for a failing root layout.
 */
export function ErrorView({ reset, homeHref }: { reset: () => void; homeHref: string }) {
  const t = useT("common");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div className="grid min-h-[50dvh] place-items-center px-4 py-16 text-center">
      <div className="max-w-md">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold text-slate-900 outline-none">
          {t("pages.errorTitle")}
        </h1>
        <p className="mt-2 text-slate-600">{t("pages.errorBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            {t("actions.retry")}
          </Button>
          <LinkButton href={homeHref} variant="secondary">
            {t("pages.home")}
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
