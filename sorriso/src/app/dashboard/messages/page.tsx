import { and, asc, desc, eq, gt, inArray, type SQL } from "drizzle-orm";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReplySimulator } from "@/components/dashboard/ReplySimulator";
import { Badge, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { db } from "@/db";
import { appointments, messages, patients } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { fmtDay, zonedDate, zonedTime } from "@/lib/datefmt";
import { fullName } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Messages" };

const FILTERS = [
  ["all", "All"],
  ["inbound", "Patient replies"],
  ["attention", "Not understood"],
  ["sms", "SMS"],
  ["whatsapp", "WhatsApp"],
  ["email", "Email"],
] as const;

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ f?: string; open?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const f = FILTERS.some(([k]) => k === sp.f) ? sp.f! : "all";
  const tz = s.org.timezone;
  const conditions: SQL[] = [eq(messages.orgId, s.org.id)];
  if (f === "inbound") conditions.push(eq(messages.direction, "inbound"));
  if (f === "attention") conditions.push(eq(messages.direction, "inbound"), eq(messages.intent, "unknown"));
  if (f === "sms" || f === "whatsapp" || f === "email") conditions.push(eq(messages.channel, f));

  const [rows, upcoming] = await Promise.all([
    db
      .select({ m: messages, patient: patients })
      .from(messages)
      .leftJoin(patients, eq(patients.id, messages.patientId))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(150),
    db
      .selectDistinct({ phone: patients.phone, firstName: patients.firstName, lastName: patients.lastName, start: appointments.startsAt })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(and(eq(appointments.orgId, s.org.id), gt(appointments.startsAt, new Date()), inArray(appointments.status, ["scheduled", "requested"])))
      .orderBy(asc(appointments.startsAt))
      .limit(40),
  ]);
  const simPatients = upcoming
    .filter((p) => p.phone)
    .filter((p, i, arr) => arr.findIndex((x) => x.phone === p.phone) === i)
    .map((p) => ({ phone: p.phone!, label: `${p.firstName} ${p.lastName} — next visit ${fmtDay(zonedDate(p.start, tz), "weekday")} ${zonedTime(p.start, tz)}` }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Messages" description="Every reminder, confirmation and patient reply, across email, SMS and WhatsApp." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {FILTERS.map(([k, label]) => (
              <Link key={k} href={`/dashboard/messages?f=${k}`} className={cx("rounded-full px-3 py-1.5 text-sm font-semibold ring-1", f === k ? "bg-ink text-white ring-ink" : "bg-white text-slate-600 ring-slate-200")}>
                {label}
              </Link>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No messages yet" />
          ) : (
            <Card className="divide-y divide-slate-100">
              {rows.map(({ m, patient }) => {
                const inbound = m.direction === "inbound";
                const expanded = sp.open === m.id;
                return (
                  <div key={m.id} className={cx("p-4", inbound && m.intent === "unknown" && "bg-amber-50/60")}>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {inbound ? <ArrowDownLeft size={15} className="text-brand-700" /> : <ArrowUpRight size={15} className="text-slate-400" />}
                      <span className="font-semibold text-slate-800">{patient ? fullName(patient) : formatPhone(inbound ? m.from : m.to)}</span>
                      <Badge tone={m.channel === "email" ? "blue" : m.channel === "whatsapp" ? "green" : "slate"}>{m.channel}</Badge>
                      {inbound ? (
                        <Badge tone={m.intent === "unknown" ? "amber" : m.intent === "cancel" ? "red" : "brand"}>reply → {m.intent}</Badge>
                      ) : (
                        <Badge tone={m.status === "failed" ? "red" : m.status === "captured" ? "amber" : "slate"}>{m.status}</Badge>
                      )}
                      <span className="ml-auto text-slate-400">
                        {fmtDay(zonedDate(m.createdAt, tz), "weekday")} {zonedTime(m.createdAt, tz)}
                      </span>
                    </div>
                    {m.subject ? (
                      <div className="mt-1.5">
                        <Link href={`/dashboard/messages?f=${f}${expanded ? "" : `&open=${m.id}`}`} className="text-sm font-semibold hover:underline">
                          {m.subject}
                        </Link>
                        {expanded && m.html ? <iframe title={m.subject} srcDoc={m.html} sandbox="" className="mt-2 h-[460px] w-full rounded-lg border border-slate-200" /> : null}
                      </div>
                    ) : (
                      <p className={cx("mt-1.5 text-sm [overflow-wrap:anywhere]", inbound ? "font-medium text-slate-900" : "text-slate-600")}>{m.body}</p>
                    )}
                    {m.error ? <p className="mt-1 text-xs text-red-600">{m.error}</p> : null}
                  </div>
                );
              })}
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-bold">Try the two-way flow</h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">Pretend a patient answered their reminder. The calendar updates exactly as it will with real Twilio replies.</p>
            {simPatients.length ? <ReplySimulator patients={simPatients} /> : <p className="text-sm text-slate-500">No upcoming appointments with a mobile number.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
