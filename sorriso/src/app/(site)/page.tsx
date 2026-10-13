import {
  ArrowRight,
  Baby,
  BellRing,
  Building2,
  CalendarCheck,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Smile,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { PractitionerCard } from "@/components/PractitionerCard";
import { SearchForm } from "@/components/SearchForm";
import { LinkButton } from "@/components/ui";
import { listCities, searchPractitioners } from "@/lib/directory";

export const dynamic = "force-dynamic";

const QUICK = [
  { category: "checkup", label: "Check-up", icon: Stethoscope },
  { category: "hygiene", label: "Cleaning", icon: Sparkles },
  { category: "orthodontics", label: "Aligners & braces", icon: Smile },
  { category: "pediatric", label: "Kids", icon: Baby },
  { category: "emergency", label: "Emergency", icon: Siren },
];

export default async function Home() {
  const [cities, soonest] = await Promise.all([listCities(), searchPractitioners({ days: 3 })]);
  const available = soonest.filter((r) => r.slots.length > 0).slice(0, 3);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-transparent">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-800 ring-1 ring-brand-200">
            <ShieldCheck size={14} /> Only verified reviews from real visits
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
            The dentist you need, <span className="text-brand-700">booked in 30 seconds.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Real-time availability from practices near you. No account, no phone queue. Get a reminder by SMS, WhatsApp
            or email — reply <strong>SI</strong> to confirm, or move it with one tap.
          </p>
          <div className="mt-8 max-w-3xl">
            <SearchForm cities={cities} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {QUICK.map(({ category, label, icon: Icon }) => (
              <Link
                key={category}
                href={`/search?category=${category}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:ring-brand-400"
              >
                <Icon size={15} className="text-brand-700" /> {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {available.length ? (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Available soonest</h2>
              <p className="text-sm text-slate-500">Pick a time and you&apos;re done — these slots are live.</p>
            </div>
            <Link href="/search" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block">
              See all dentists →
            </Link>
          </div>
          <div className="grid gap-4">
            {available.map((r) => (
              <PractitionerCard key={r.practitioner.id} result={r} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-6 text-2xl font-bold tracking-tight">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Search,
              title: "Find real availability",
              body: "Compare dentists by treatment, price, verified reviews and the next free slot — at every office they work in.",
            },
            {
              icon: CalendarCheck,
              title: "Book without an account",
              body: "Choose a time, add your name and number. You get an instant confirmation with a calendar invite.",
            },
            {
              icon: MessageCircle,
              title: "Confirm with a reply",
              body: "We remind you by SMS, WhatsApp or email. Reply SI to confirm, NO to cancel — or reschedule in one tap.",
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon size={20} />
                </span>
                <span className="text-xs font-bold text-slate-400">STEP {i + 1}</span>
              </div>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-5 text-2xl font-bold tracking-tight">Dentists by city</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cities.map((c) => (
            <Link
              key={c.city}
              href={`/search?city=${encodeURIComponent(c.city)}`}
              className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-semibold shadow-card ring-1 ring-slate-200/70 hover:ring-brand-400"
            >
              Dentists in {c.city}
              <span className="text-xs font-medium text-slate-400">{c.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-ink p-8 text-white sm:p-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-300">For dental practices</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Fewer no-shows. Every office on one calendar.</h2>
            <p className="mt-3 text-slate-300">
              Multi-office scheduling with chairs, two-way SMS & WhatsApp confirmations, an automatic waitlist that
              refills cancellations, and an open booking API.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/for-clinics" variant="subtle">
                See features <ArrowRight size={16} />
              </LinkButton>
              <LinkButton href="/login?demo=1" className="bg-white/10 ring-1 ring-white/20 hover:bg-white/20">
                Try the demo dashboard
              </LinkButton>
            </div>
          </div>
          <ul className="grid gap-3 text-sm">
            {[
              [Building2, "Multiple offices, practitioners and chairs — no double booking across locations"],
              [BellRing, "Reminder rules per practice: email 48h, SMS 24h, WhatsApp — with fallback"],
              [MessageCircle, "Patients reply SI / NO; the calendar updates itself"],
              [RefreshCw, "Cancellations are offered to the waitlist within seconds"],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Building2;
              return (
                <li key={text as string} className="flex gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                  <I size={18} className="mt-0.5 shrink-0 text-brand-300" />
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
