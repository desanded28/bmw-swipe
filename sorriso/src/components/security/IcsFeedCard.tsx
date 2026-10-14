"use client";

import { CalendarSync, Check, Copy, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { disableIcsFeed, rotateIcsToken } from "@/app/dashboard/actions/ics";
import { useT } from "@/i18n/provider";
import { Button, Card } from "../ui";
import { useRunAction } from "../dashboard/useRunAction";

/**
 * A practitioner's personal calendar feed (team/[id]). Works only while the practice allows feeds
 * (privacy.icsFeedsEnabled) and this feed is on; the URL is shown once, right after it's created.
 * Rendered only for the practitioner themselves or a manager.
 */
export function IcsFeedCard({
  practitionerId,
  orgEnabled,
  feedOn,
  expires,
  detail,
  canOpenPrivacySettings,
}: {
  practitionerId: string;
  orgEnabled: boolean;
  feedOn: boolean;
  /** Pre-formatted expiry date of the current URL. */
  expires: string | null;
  detail: "none" | "initials";
  canOpenPrivacySettings: boolean;
}) {
  const t = useT("security");
  const { run, pending } = useRunAction();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = () =>
    run(
      () => rotateIcsToken(practitionerId),
      (r) => {
        if (r.ok) {
          setCopied(false);
          setUrl((r.data as { url: string }).url);
        }
      },
    );

  return (
    <Card className="p-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <CalendarSync size={18} aria-hidden /> {t("ics.title")}
      </h2>
      <p className="mb-3 text-sm text-slate-500">{t("ics.description")}</p>

      {!orgEnabled ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
          {t("ics.orgDisabled")}{" "}
          {canOpenPrivacySettings ? (
            <Link href="/dashboard/settings/privacy" className="font-semibold text-brand-700 hover:underline">
              {t("ics.privacySettings")}
            </Link>
          ) : null}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{t(detail === "initials" ? "ics.warningInitials" : "ics.warningNone")}</span>
          </p>
          {url ? (
            <div className="space-y-2" role="status">
              <p className="text-sm font-semibold">{t("ics.urlLabel")}</p>
              <div className="flex gap-2">
                <code className="block flex-1 select-all break-all rounded-lg bg-slate-100 p-3 text-xs">{url}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-label={t("ics.copyUrl")}
                  onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false))}
                >
                  {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                </Button>
              </div>
              <p className="text-xs text-slate-500">{t("ics.urlOnce")}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {feedOn && expires ? t("ics.on", { date: expires }) : t("ics.off")} {t("ics.window")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {feedOn || url ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => window.confirm(t("ics.rotateConfirm")) && create()}
                >
                  {t("ics.rotate")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() =>
                    window.confirm(t("ics.disableConfirm")) &&
                    run(
                      () => disableIcsFeed(practitionerId),
                      (r) => r.ok && setUrl(null),
                    )
                  }
                >
                  {t("ics.disable")}
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" disabled={pending} onClick={create}>
                {t("ics.generate")}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
