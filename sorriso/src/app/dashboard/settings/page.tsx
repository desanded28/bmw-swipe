import type { Metadata } from "next";
import Link from "next/link";
import { saveBookingPolicy, saveProfile } from "@/app/dashboard/actions/settings";
import { ActionForm } from "@/components/dashboard/ActionForm";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { APP_URL } from "@/lib/config";
import { can } from "@/lib/permissions";
import { signPracticeRef } from "@/lib/privacy/context";
import { resolveSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

/**
 * Practice profile, booking rules and the booking widget (WP5). Every staff member can see it;
 * saving needs settings.manage. API keys are on /dashboard/settings/api, team members on
 * /dashboard/team.
 */
export default async function SettingsPage() {
  const s = await requireStaff();
  const org = s.org;
  const settings = resolveSettings(org.settings);
  const canManage = can(s.role, "settings.manage");
  const snippet = `<script src="${APP_URL}/widget.js" data-clinic="${org.slug}" async></script>`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Settings & integrations" />
      {!canManage ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Only owners and admins can change settings.</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">Practice profile</h2>
          <ActionForm action={saveProfile} className="space-y-3">
            <Field label="Name">
              <Input name="name" defaultValue={org.name} required />
            </Field>
            <Field label="Description" hint="Shown on your public page">
              <Textarea name="description" rows={3} defaultValue={org.description ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input name="phone" defaultValue={org.phone ?? ""} />
              </Field>
              <Field label="Email" hint="Patients' email replies go here">
                <Input name="email" type="email" defaultValue={org.email ?? ""} />
              </Field>
              <Field label="Website">
                <Input name="website" defaultValue={org.website ?? ""} />
              </Field>
              <Field label="Brand colour">
                <Input type="color" name="brandColor" defaultValue={org.brandColor} className="h-10 !p-1" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="listed" defaultChecked={org.listed} className="h-4 w-4 accent-brand-700" /> Listed in the public search
            </label>
          </ActionForm>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">Online booking rules</h2>
          <ActionForm action={saveBookingPolicy} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum notice (hours)" hint="Earliest bookable slot from now">
                <Input type="number" name="minNoticeHours" min={0} defaultValue={settings.booking.minNoticeMinutes / 60} />
              </Field>
              <Field label="Book up to (days ahead)">
                <Input type="number" name="maxAdvanceDays" min={1} max={365} defaultValue={settings.booking.maxAdvanceDays} />
              </Field>
              <Field label="Slot grid">
                <Select name="slotStepMinutes" defaultValue={String(settings.booking.slotStepMinutes)}>
                  {[5, 10, 15, 20, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      every {m} min
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Online reschedule until (hours before)">
                <Input type="number" name="cancelUntilHours" min={0} defaultValue={settings.booking.cancelUntilHours} />
              </Field>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="requireApproval" defaultChecked={settings.booking.requireApproval} className="mt-0.5 h-4 w-4 accent-brand-700" />
              <span>
                Online bookings are <strong>requests</strong> that the front desk approves (the slot is held meanwhile).
              </span>
            </label>
            <p className="text-xs text-slate-500">Patients can always cancel — a late cancellation is better than a no-show, and the slot goes to the waitlist.</p>
          </ActionForm>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-bold">Booking widget</h2>
        <p className="mb-3 text-sm text-slate-500">Paste this before &lt;/body&gt; on your website for a floating “Book an appointment” button.</p>
        <code className="block break-all rounded-xl bg-ink p-4 text-xs text-slate-100">{snippet}</code>
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href={`/embed/${org.slug}`} target="_blank" className="text-brand-700 hover:underline">
            Preview the embedded flow ↗
          </Link>
          {/* The practice's own link carries its signed ref, so bookings through it stay 'practice' context. */}
          <Link href={`/book/${org.slug}?ref=${signPracticeRef(org.id)}`} target="_blank" className="text-brand-700 hover:underline">
            Direct booking link ↗
          </Link>
          <Link href="/developers" target="_blank" className="text-brand-700 hover:underline">
            API docs ↗
          </Link>
          {can(s.role, "apikeys.manage") ? (
            <Link href="/dashboard/settings/api" className="text-brand-700 hover:underline">
              API keys →
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
