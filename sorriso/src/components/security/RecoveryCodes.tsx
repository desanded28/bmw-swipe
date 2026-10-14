"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n/provider";
import { Button } from "../ui";

/** Freshly generated recovery codes, shown once with copy and download (a local text file). */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useT("security");
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = t("mfa.codesFileName");
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200" role="region" aria-label={t("mfa.recoveryTitle")}>
      <p className="font-semibold text-amber-900">{t("mfa.recoveryTitle")}</p>
      <p className="mt-1 text-sm text-amber-900">{t("mfa.recoveryIntro")}</p>
      <ol className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-white p-3 font-mono text-sm ring-1 ring-amber-100">
        {codes.map((c) => (
          <li key={c} className="tracking-wider">
            {c}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            navigator.clipboard?.writeText(text).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {t("mfa.copyCodes")}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={download}>
          <Download size={14} aria-hidden /> {t("mfa.downloadCodes")}
        </Button>
        <Button type="button" size="sm" onClick={onDone}>
          {t("mfa.savedCodes")}
        </Button>
      </div>
    </div>
  );
}
