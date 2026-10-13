import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { LinkButton, Logo } from "./ui";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label={`${APP_NAME} home`}>
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
          <Link href="/search" className="hover:text-ink">
            Find a dentist
          </Link>
          <Link href="/for-clinics" className="hover:text-ink">
            For practices
          </Link>
          <Link href="/developers" className="hover:text-ink">
            API
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost" size="sm">
            Practice login
          </LinkButton>
          <LinkButton href="/search" size="sm" className="hidden sm:inline-flex">
            Book now
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-slate-500 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm">
            Book dentists online with real-time availability. Two-way SMS and WhatsApp reminders that patients actually
            answer.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-slate-800">Patients</p>
          <Link href="/search" className="block hover:text-ink">
            Find a dentist
          </Link>
          <Link href="/search?category=emergency" className="block hover:text-ink">
            Dental emergency
          </Link>
          <Link href="/search?category=hygiene" className="block hover:text-ink">
            Teeth cleaning
          </Link>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-slate-800">Practices</p>
          <Link href="/for-clinics" className="block hover:text-ink">
            Features
          </Link>
          <Link href="/signup" className="block hover:text-ink">
            Create a practice
          </Link>
          <Link href="/developers" className="block hover:text-ink">
            Booking API & widget
          </Link>
        </div>
      </div>
      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {APP_NAME}. Demo project — practices and people shown are fictional.
      </div>
    </footer>
  );
}
