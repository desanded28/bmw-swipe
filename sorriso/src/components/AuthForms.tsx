"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { login, signup, type FormState } from "@/app/auth-actions";
import { Button, Field, Input } from "./ui";

export function LoginForm({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required defaultValue={demo ? "demo@sorriso.dev" : ""} />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required defaultValue={demo ? "demo1234" : ""} />
      </Field>
      {state?.error ? <p className="text-sm font-medium text-red-600">{state.error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <LoaderCircle size={18} className="animate-spin" /> : null} Log in
      </Button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name">
          <Input name="name" required autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
      </div>
      <Field label="Password" hint="At least 8 characters">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <hr className="border-slate-100" />
      <Field label="Practice name">
        <Input name="practiceName" required placeholder="Studio Dentistico Rossi" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
        <Field label="Office address">
          <Input name="address" required placeholder="Via Roma 1" />
        </Field>
        <Field label="City">
          <Input name="city" required placeholder="Milano" />
        </Field>
      </div>
      <Field label="Practice phone" hint="Shown to patients and in reminders">
        <Input name="phone" type="tel" placeholder="+39 02 1234 5678" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isDentist" defaultChecked className="h-4 w-4 accent-brand-700" /> I&apos;m also a dentist at
        this practice (create my calendar, Mon–Fri 9–13 / 14–18)
      </label>
      {state?.error ? <p className="text-sm font-medium text-red-600">{state.error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <LoaderCircle size={18} className="animate-spin" /> : null} Create practice
      </Button>
    </form>
  );
}
