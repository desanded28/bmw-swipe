"use client";

import { CalendarCheck, CircleCheck, LoaderCircle, MapPin, PhoneCall, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { askForCall, chooseNewTime } from "@/app/[locale]/(site)/a/[token]/rebook/actions";
import { lhref } from "@/i18n/href";
import { useLocale, useT } from "@/i18n/provider";
import { Button, Card, buttonClass } from "../ui";

export type RebookOption = {
  key: string;
  /** Already formatted in the page's language ("Martedì 12 marzo alle 09:30"). */
  when: string;
  practitioner: string;
  location: string;
};

/**
 * One-tap rebooking for a visit the practice can't keep: each offered time is a button; picking
 * one moves the appointment at once. "Call me instead" puts the visit on the front desk's call
 * list. Results are announced and take the focus.
 */
export function RebookChooser({
  token,
  clinic,
  options,
  callRequested,
  moreTimesHref,
}: {
  token: string;
  clinic: string;
  options: RebookOption[];
  callRequested: boolean;
  /** The practice's booking page for this treatment, when it can be booked online. */
  moreTimesHref: string | null;
}) {
  const t = useT("care");
  const locale = useLocale();
  const router = useRouter();
  const uid = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ when: string; practitioner: string } | null>(null);
  const [called, setCalled] = useState(callRequested);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "info"; n: number } | null>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  useEffect(() => {
    if (focus) document.getElementById(focus.id)?.focus();
  }, [focus]);
  const focusOn = (id: string) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  const say = (text: string, tone: "error" | "info") => setMessage((m) => ({ text, tone, n: (m?.n ?? 0) + 1 }));

  async function choose(key: string) {
    if (busy) return;
    setBusy(key);
    setMessage(null);
    try {
      const res = await chooseNewTime(token, locale, key);
      if (res.ok) {
        setMoved({ when: res.when, practitioner: res.practitioner });
        focusOn(`${uid}-moved`);
      } else if (res.reason === "taken") {
        say(t("rebook.taken"), "info");
        router.refresh();
      } else if (res.reason === "not_needed") {
        router.refresh();
      } else {
        say(res.reason === "invalid" ? t("rebook.invalid") : t("rebook.error"), "error");
      }
    } catch {
      say(t("rebook.error"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function call() {
    if (busy) return;
    setBusy("call");
    setMessage(null);
    try {
      const res = await askForCall(token);
      if (res.ok) {
        setCalled(true);
        focusOn(`${uid}-called`);
      } else if (res.reason === "not_needed") router.refresh();
      else say(t("rebook.error"), "error");
    } catch {
      say(t("rebook.error"), "error");
    } finally {
      setBusy(null);
    }
  }

  if (moved) {
    return (
      <Card className="p-6 text-center">
        <CircleCheck size={36} className="mx-auto text-emerald-600" aria-hidden />
        <h2 id={`${uid}-moved`} tabIndex={-1} className="mt-3 text-xl font-bold focus:outline-none">
          {t("rebook.movedTitle")}
        </h2>
        <p className="mt-1 text-slate-700" role="status">
          {t("rebook.movedBody", { when: moved.when, practitioner: moved.practitioner })}
        </p>
        <Link href={lhref(locale, `/a/${token}`)} className={buttonClass("secondary", "md", "mt-5")}>
          {t("rebook.manage")}
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p
          key={message.n}
          role={message.tone === "error" ? "alert" : "status"}
          className={
            message.tone === "error"
              ? "rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200"
              : "rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200"
          }
        >
          {message.text}
        </p>
      ) : null}

      <section aria-labelledby={`${uid}-choices`}>
        <h2 id={`${uid}-choices`} className="mb-3 text-lg font-bold">
          {t("rebook.choicesTitle")}
        </h2>
        {options.length ? (
          <ul className="space-y-3">
            {options.map((o) => (
              <li key={o.key}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold">
                      <CalendarCheck size={18} className="shrink-0 text-brand-700" aria-hidden /> {o.when}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <UserRound size={14} aria-hidden /> {t("rebook.with", { practitioner: o.practitioner })}
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-slate-600">
                      <MapPin size={14} aria-hidden /> {t("rebook.at", { location: o.location })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={Boolean(busy)}
                    onClick={() => choose(o.key)}
                    aria-label={t("rebook.chooseLabel", { when: o.when, practitioner: o.practitioner })}
                  >
                    {busy === o.key ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
                    {busy === o.key ? t("rebook.choosing") : t("rebook.choose")}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">{t("rebook.none")}</p>
        )}
        {moreTimesHref ? (
          <p className="mt-3">
            <Link href={moreTimesHref} className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline">
              {t("rebook.moreTimes")}
            </Link>
          </p>
        ) : null}
      </section>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <PhoneCall size={18} className="text-brand-700" aria-hidden /> {t("rebook.callTitle")}
        </h2>
        {called ? (
          <p id={`${uid}-called`} tabIndex={-1} className="mt-1 text-sm text-slate-700 focus:outline-none" role="status">
            {callRequested ? t("rebook.callAlready", { clinic }) : t("rebook.callDone", { clinic })}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">{t("rebook.callBody")}</p>
            <Button type="button" variant="secondary" className="mt-3" disabled={Boolean(busy)} onClick={call}>
              {busy === "call" ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : null}
              {t("rebook.callButton")}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
