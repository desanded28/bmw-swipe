import type { Metadata } from "next";
import Link from "next/link";
import { redirectIfLoggedIn } from "@/app/auth-actions";
import { LoginForm } from "@/components/AuthForms";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Practice login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  await redirectIfLoggedIn();
  const { demo } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <Card className="p-7">
        <h1 className="text-2xl font-extrabold tracking-tight">Practice login</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">Manage calendars, patients and reminders.</p>
        <LoginForm demo={demo === "1"} />
        <div className="mt-6 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
          <p className="font-semibold">Demo accounts (password demo1234)</p>
          <p className="mt-1">
            <code>demo@sorriso.dev</code> — owner, 2 practices
            <br />
            <code>reception@sorriso.dev</code> — front desk
          </p>
          {demo !== "1" ? (
            <Link href="/login?demo=1" className="mt-2 inline-block font-semibold underline">
              Fill in the demo login
            </Link>
          ) : null}
        </div>
      </Card>
      <p className="mt-5 text-center text-sm text-slate-500">
        New practice?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
