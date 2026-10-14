import type { Metadata } from "next";
import Link from "next/link";
import { redirectIfLoggedIn } from "@/app/auth-actions";
import { SignupForm } from "@/components/AuthForms";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Create your practice" };

export default async function SignupPage() {
  await redirectIfLoggedIn();
  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <Card className="p-7">
        <h1 className="text-2xl font-extrabold tracking-tight">Create your practice</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">
          Online booking, multi-office calendar and SMS/WhatsApp confirmations. Set up in two minutes.
        </p>
        <SignupForm />
      </Card>
      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
