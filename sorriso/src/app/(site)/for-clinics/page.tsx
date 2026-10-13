import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  CalendarRange,
  Code2,
  ListChecks,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { Card, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "For dental practices" };

const FEATURES = [
  {
    icon: Building2,
    title: "Every office, one calendar",
    body: "Practitioners work at different offices on different days. Availability is computed per office, and a dentist can never be double-booked across locations.",
  },
  {
    icon: CalendarRange,
    title: "Chairs, buffers and closures",
    body: "Bookings reserve a chair automatically. Cleanup buffers per treatment, holidays, maintenance and personal time off all block availability.",
  },
  {
    icon: MessageCircle,
    title: "Two-way SMS & WhatsApp",
    body: "Reminders ask patients to reply SI / NO. Replies confirm or cancel the appointment instantly; anything else is flagged for the front desk.",
  },
  {
    icon: BellRing,
    title: "Reminder rules you control",
    body: "e.g. email 48h before asking to confirm, SMS 24h before, short SMS 2h before. Patients choose SMS, WhatsApp or email; falls back to email automatically.",
  },
  {
    icon: RefreshCw,
    title: "Cancellations refill themselves",
    body: "When a slot frees up it's offered to matching waitlist patients within seconds. First to book gets it — no phone calls.",
  },
  {
    icon: ListChecks,
    title: "Confirmation board",
    body: "See tomorrow at a glance: confirmed, waiting, and who needs a call. Patients with past no-shows are highlighted.",
  },
  {
    icon: BadgeCheck,
    title: "Verified reviews only",
    body: "Review requests go out after a completed visit, so every review on your profile is from a real patient.",
  },
  {
    icon: Code2,
    title: "Open booking API & widget",
    body: "Embed booking on your website with one script tag, sync with your practice software via REST, subscribe to calendar feeds.",
  },
  {
    icon: Users,
    title: "Roles for your team",
    body: "Owners, admins, front desk and practitioners — each sees what they need. Switch between practices with one login.",
  },
];

export default function ForClinicsPage() {
  return (
    <div>
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-300">For dental practices</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Fill your chairs. Stop chasing confirmations.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            Online booking, a multi-office calendar and reminders patients actually answer — in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup" size="lg" variant="subtle">
              Create your practice <ArrowRight size={17} />
            </LinkButton>
            <LinkButton href="/login?demo=1" size="lg" className="bg-white/10 ring-1 ring-white/20 hover:bg-white/20">
              Open the demo dashboard
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon size={20} />
              </span>
              <h2 className="mt-4 font-bold">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6">
        <Card className="grid gap-8 p-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">How a confirmation works</h2>
            <ol className="mt-5 space-y-4 text-sm">
              {[
                "Patient books online (or you book them at the desk) and gets a confirmation with a calendar invite.",
                "48h before: email asking to confirm with one click.",
                "24h before: SMS or WhatsApp — “Reply SI to confirm or NO to cancel”.",
                "Reply SI → the appointment turns green in your calendar. Reply NO → it's cancelled and offered to the waitlist.",
                "Anything else (“can I come 30 minutes later?”) lands in your inbox, flagged on the calendar.",
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-slate-700">{text}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex items-center justify-center rounded-2xl bg-slate-100 p-6">
            <div className="w-full max-w-xs space-y-3 rounded-[2rem] bg-white p-5 shadow-pop ring-8 ring-slate-800">
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400">
                <Smartphone size={13} /> Studio Bianchi
              </p>
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 p-3 text-[13px] leading-snug">
                Studio Dentistico Bianchi: ciao Marco, promemoria Igiene con Sara Conti mer 15 ott alle 10:30, Via Torino 42,
                Milano. Rispondi SI per confermare o NO per disdire.
              </div>
              <div className="ml-auto w-fit rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-[13px] text-white">SI 👍</div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 p-3 text-[13px] leading-snug">
                Grazie! Presenza confermata per mer 15 ott alle 10:30. A presto!
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-50 p-6 ring-1 ring-brand-200">
          <p className="flex items-center gap-2 font-semibold text-brand-900">
            <ShieldCheck size={18} /> Your data stays yours: export any time via the API, no lock-in.
          </p>
          <LinkButton href="/developers" variant="secondary">
            Read the API docs
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
