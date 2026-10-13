import { and, desc, eq } from "drizzle-orm";
import { UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePatient } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/dashboard/ActionForm";
import { AppointmentList } from "@/components/dashboard/AppointmentList";
import { Avatar, Badge, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { db } from "@/db";
import { messages, patients } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { listAppointments, loadResources } from "@/lib/dashboard";
import { fmtDay, zonedDate, zonedTime } from "@/lib/datefmt";
import { fullName } from "@/lib/format";

export const metadata: Metadata = { title: "Patient" };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  const [p] = await db.select().from(patients).where(and(eq(patients.id, id), eq(patients.orgId, s.org.id)));
  if (!p) notFound();
  const tz = s.org.timezone;
  const [resources, history, log] = await Promise.all([
    loadResources(s.org.id, tz),
    listAppointments(s.org.id, { patientId: id, includeCancelled: true, order: "desc" }),
    db.select().from(messages).where(and(eq(messages.patientId, id), eq(messages.orgId, s.org.id))).orderBy(desc(messages.createdAt)).limit(30),
  ]);
  const upcoming = history.filter((a) => Date.parse(a.start) > Date.now() && a.status !== "cancelled").reverse();
  const past = history.filter((a) => !upcoming.includes(a));
  const completed = history.filter((a) => a.status === "completed").length;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/patients" className="text-sm font-semibold text-slate-500 hover:text-ink">
        ← Patients
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-4">
        <Avatar name={fullName(p)} color="#475569" size={56} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fullName(p)}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{completed} completed visit{completed === 1 ? "" : "s"}</Badge>
            {p.noShowCount ? (
              <Badge tone="red">
                <UserX size={12} /> {p.noShowCount} no-show{p.noShowCount > 1 ? "s" : ""}
              </Badge>
            ) : null}
            <Badge tone="blue">prefers {p.preferredChannel}</Badge>
            <Badge>{p.locale === "it" ? "Italiano" : "English"}</Badge>
            {!p.smsOptIn ? <Badge tone="amber">SMS opt-out</Badge> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-bold">Upcoming</h2>
            <AppointmentList appointments={upcoming} resources={resources} empty="No upcoming appointments." />
          </section>
          <section>
            <h2 className="mb-2 font-bold">History</h2>
            <AppointmentList appointments={past} resources={resources} quickActions={false} empty="No past appointments." />
          </section>
          <section>
            <h2 className="mb-2 font-bold">Messages</h2>
            <Card className="divide-y divide-slate-100">
              {log.length === 0 ? <p className="p-4 text-sm text-slate-500">No messages.</p> : null}
              {log.map((m) => (
                <div key={m.id} className="p-3 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {m.direction === "inbound" ? "← reply" : "→ sent"} · {m.channel} · {m.status} · {fmtDay(zonedDate(m.createdAt, tz), "short")} {zonedTime(m.createdAt, tz)}
                    {m.intent ? ` · understood as ${m.intent}` : ""}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-slate-700">{m.subject ?? m.body}</p>
                </div>
              ))}
            </Card>
          </section>
        </div>

        <Card className="h-fit p-5">
          <h2 className="mb-4 font-bold">Details</h2>
          <ActionForm action={updatePatient.bind(null, p.id)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input name="firstName" defaultValue={p.firstName} required />
              </Field>
              <Field label="Last name">
                <Input name="lastName" defaultValue={p.lastName} required />
              </Field>
            </div>
            <Field label="Mobile">
              <Input name="phone" type="tel" defaultValue={p.phone ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={p.email ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth">
                <Input name="birthDate" type="date" defaultValue={p.birthDate ?? ""} />
              </Field>
              <Field label="Language">
                <Select name="locale" defaultValue={p.locale}>
                  <option value="it">Italiano</option>
                  <option value="en">English</option>
                </Select>
              </Field>
            </div>
            <Field label="Reminders by">
              <Select name="preferredChannel" defaultValue={p.preferredChannel}>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </Select>
            </Field>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="smsOptIn" defaultChecked={p.smsOptIn} className="h-4 w-4 accent-brand-700" /> SMS / WhatsApp OK
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="emailOptIn" defaultChecked={p.emailOptIn} className="h-4 w-4 accent-brand-700" /> Email OK
              </label>
            </div>
            <Field label="Notes" hint="Internal: allergies, anxiety, preferences…">
              <Textarea name="notes" rows={3} defaultValue={p.notes ?? ""} />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
