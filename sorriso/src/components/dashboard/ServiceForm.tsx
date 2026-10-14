import { saveService } from "@/app/dashboard/actions";
import { SERVICE_CATEGORIES } from "@/db/enums";
import type { Service } from "@/db/schema";
import { CATEGORY_LABELS } from "@/lib/format";
import { Field, Input, Select, Textarea } from "../ui";
import { ActionForm } from "./ActionForm";

export function ServiceForm({ service }: { service?: Service }) {
  const s = service;
  return (
    <ActionForm action={saveService.bind(null, s?.id ?? null)} submitLabel={s ? "Save" : "Add treatment"} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" defaultValue={s?.name} required />
        </Field>
        <Field label="Category" hint="Used for search on the marketplace">
          <Select name="category" defaultValue={s?.category ?? "checkup"}>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Duration (min)">
          <Input type="number" name="durationMinutes" min={5} max={480} step={5} defaultValue={s?.durationMinutes ?? 30} required />
        </Field>
        <Field label="Cleanup buffer" hint="Minutes after">
          <Input type="number" name="bufferMinutes" min={0} max={120} step={5} defaultValue={s?.bufferMinutes ?? 0} />
        </Field>
        <Field label="Price (€)" hint="Empty = on request">
          <Input name="price" inputMode="decimal" defaultValue={s?.priceCents != null ? String(s.priceCents / 100) : ""} />
        </Field>
      </div>
      <Field label="Description">
        <Textarea name="description" rows={2} defaultValue={s?.description ?? ""} />
      </Field>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="onlineBookable" defaultChecked={s?.onlineBookable ?? true} className="h-4 w-4 accent-brand-700" /> Bookable online
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requiresRoom" defaultChecked={s?.requiresRoom ?? true} className="h-4 w-4 accent-brand-700" /> Needs a chair
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="h-4 w-4 accent-brand-700" /> Active
        </label>
      </div>
    </ActionForm>
  );
}
