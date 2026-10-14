import { savePractitioner } from "@/app/dashboard/actions/practitioners";
import type { Practitioner, Service } from "@/db/schema";
import { CATEGORY_LABELS } from "@/lib/format";
import { Field, Input, Textarea } from "../ui";
import { ActionForm } from "./ActionForm";

export function PractitionerForm({
  practitioner,
  services,
  offered,
}: {
  practitioner?: Practitioner;
  services: Service[];
  offered: string[];
}) {
  const p = practitioner;
  return (
    <ActionForm action={savePractitioner.bind(null, p?.id ?? null)} submitLabel={p ? "Save profile" : "Add practitioner"} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
        <Field label="Title">
          <Input name="title" defaultValue={p?.title ?? "Dr."} placeholder="Dr." />
        </Field>
        <Field label="Full name">
          <Input name="name" defaultValue={p?.name} required />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Specialty">
          <Input name="specialty" defaultValue={p?.specialty ?? "General dentist"} />
        </Field>
        <Field label="Languages">
          <Input name="languages" defaultValue={p?.languages ?? "Italiano, English"} />
        </Field>
        <Field label="License number" hint="Albo / registration">
          <Input name="licenseNumber" defaultValue={p?.licenseNumber ?? ""} />
        </Field>
        <Field label="Calendar colour">
          <Input type="color" name="color" defaultValue={p?.color ?? "#0d9488"} className="h-10 !p-1" />
        </Field>
      </div>
      <Field label="Bio" hint="Shown on the public profile">
        <Textarea name="bio" rows={3} defaultValue={p?.bio ?? ""} />
      </Field>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-slate-700">Treatments offered online</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ring-1 ring-slate-200">
              <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={offered.includes(s.id)} className="h-4 w-4 accent-brand-700" />
              <span className="flex-1">{s.name}</span>
              <span className="text-[11px] text-slate-400">{CATEGORY_LABELS[s.category]}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="acceptsNewPatients" defaultChecked={p?.acceptsNewPatients ?? true} className="h-4 w-4 accent-brand-700" /> Accepts new patients
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-4 w-4 accent-brand-700" /> Active (bookable)
        </label>
      </div>
    </ActionForm>
  );
}
