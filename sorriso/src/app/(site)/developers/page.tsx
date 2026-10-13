import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { APP_URL } from "@/lib/config";

export const metadata: Metadata = { title: "Booking API & widget" };

function Code({ children }: { children: string }) {
  return (
    <pre className="scrollbar-thin overflow-x-auto rounded-xl bg-ink p-4 text-[13px] leading-relaxed text-slate-100">
      <code>{children.trim()}</code>
    </pre>
  );
}

type Endpoint = { method: "GET" | "POST" | "PATCH"; path: string; auth: "public" | "token" | "api key" | "secret"; desc: string };

const ENDPOINTS: { group: string; items: Endpoint[] }[] = [
  {
    group: "Public booking (used by the website and widget)",
    items: [
      { method: "GET", path: "/api/v1/clinics/:slug", auth: "public", desc: "Practice profile, offices, practitioners (with services & offices) and bookable services." },
      { method: "GET", path: "/api/v1/clinics/:slug/availability?serviceId=&from=&days=&practitionerId=&locationId=", auth: "public", desc: "Free slots per day. Omit practitionerId for “first available” (load-balanced). Returns nextAvailable when the window is empty." },
      { method: "POST", path: "/api/v1/clinics/:slug/appointments", auth: "public", desc: "Book a slot. Re-validated in a write transaction: two patients can never get the same slot." },
      { method: "POST", path: "/api/v1/clinics/:slug/waitlist", auth: "public", desc: "Join the waitlist for a service, optionally a practitioner/office, a date range and part of day." },
    ],
  },
  {
    group: "Patient self-service (token from the patient's link)",
    items: [
      { method: "GET", path: "/api/v1/appointments/:token", auth: "token", desc: "Appointment details and what the patient may still do (canCancel, canReschedule)." },
      { method: "POST", path: "/api/v1/appointments/:token/confirm", auth: "token", desc: "Confirm attendance." },
      { method: "POST", path: "/api/v1/appointments/:token/cancel", auth: "token", desc: "Cancel (frees the slot for the waitlist). Body: { reason? }" },
      { method: "POST", path: "/api/v1/appointments/:token/reschedule", auth: "token", desc: "Move to another free slot. Body: { start, practitionerId?, locationId? }" },
    ],
  },
  {
    group: "Partner API (your practice software)",
    items: [
      { method: "GET", path: "/api/v1/partner/resources", auth: "api key", desc: "Offices, chairs, practitioners (with schedules) and services — for ID mapping." },
      { method: "GET", path: "/api/v1/partner/appointments?from=&to=&updatedSince=&status=", auth: "api key", desc: "List appointments. Use updatedSince for incremental sync." },
      { method: "POST", path: "/api/v1/partner/appointments", auth: "api key", desc: "Create with front-desk powers (custom duration, force outside hours, existing patient id)." },
      { method: "PATCH", path: "/api/v1/partner/appointments/:id", auth: "api key", desc: "Reschedule, cancel, mark completed / no-show, or record a phone confirmation." },
    ],
  },
  {
    group: "Infrastructure",
    items: [
      { method: "POST", path: "/api/webhooks/twilio", auth: "public", desc: "Inbound SMS / WhatsApp replies (Twilio-signed). Answers inline with TwiML." },
      { method: "POST", path: "/api/webhooks/twilio/status", auth: "public", desc: "Delivery receipts (delivered / failed)." },
      { method: "GET", path: "/api/cron/reminders", auth: "secret", desc: "Send due reminders. Call every 1–5 minutes with Authorization: Bearer $CRON_SECRET." },
      { method: "GET", path: "/api/ics/practitioner/:token", auth: "token", desc: "Subscribable calendar feed for a practitioner (Google / Apple / Outlook)." },
    ],
  },
];

const methodTone = { GET: "blue", POST: "green", PATCH: "amber" } as const;

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">Booking API & widget</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Everything the {APP_URL.replace(/^https?:\/\//, "")} website does goes through this API, so anything a patient can do
        your integration can do too. JSON over HTTPS, CORS enabled, times in ISO 8601 (UTC).
      </p>

      <h2 className="mb-3 mt-10 text-xl font-bold">1. Embed booking on your website</h2>
      <Card className="space-y-4 p-6">
        <p className="text-sm text-slate-600">A floating “Book an appointment” button that opens the booking flow:</p>
        <Code>{`<script src="${APP_URL}/widget.js" data-clinic="studio-bianchi" async></script>`}</Code>
        <p className="text-sm text-slate-600">
          Or inline inside your page, pre-filtered to one practitioner (also <code>data-service</code>, <code>data-location</code>,{" "}
          <code>data-color</code>, <code>data-label</code>):
        </p>
        <Code>{`<div id="booking"></div>
<script src="${APP_URL}/widget.js" data-clinic="studio-bianchi"
        data-target="#booking" data-practitioner="PRACTITIONER_ID" async></script>
<script>
  window.addEventListener("sorriso:booked", (e) => console.log("booked", e.detail.appointmentId));
</script>`}</Code>
      </Card>

      <h2 className="mb-3 mt-10 text-xl font-bold">2. Book through the API</h2>
      <Card className="space-y-4 p-6">
        <Code>{`# 1. what's free?
curl "${APP_URL}/api/v1/clinics/studio-bianchi/availability?serviceId=SERVICE_ID&days=7"

# 2. book it
curl -X POST "${APP_URL}/api/v1/clinics/studio-bianchi/appointments" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceId": "SERVICE_ID",
    "practitionerId": "PRACTITIONER_ID",
    "locationId": "LOCATION_ID",
    "start": "2026-10-20T08:30:00.000Z",
    "patient": { "firstName": "Marco", "lastName": "Rossi",
                 "phone": "+393331234567", "email": "marco@example.com",
                 "locale": "it", "preferredChannel": "whatsapp" }
  }'`}</Code>
        <p className="text-sm text-slate-600">
          Errors use one shape: <code>{`{ "error": { "code": "practitioner_busy", "message": "…" } }`}</code>. Slot conflicts return
          409 with codes <code>practitioner_busy</code>, <code>no_room</code>, <code>time_off</code>, <code>outside_hours</code>,{" "}
          <code>too_soon</code>; validation errors return 422 with an <code>issues</code> list.
        </p>
      </Card>

      <h2 className="mb-3 mt-10 text-xl font-bold">3. Sync with your practice software</h2>
      <Card className="space-y-4 p-6">
        <p className="text-sm text-slate-600">
          Create an API key in <em>Dashboard → Settings → Integrations</em> and send it as a bearer token. The seeded demo practice
          has the key <code>sk_demo_studio_bianchi_local_only</code>.
        </p>
        <Code>{`curl -H "Authorization: Bearer sk_…" \\
  "${APP_URL}/api/v1/partner/appointments?updatedSince=2026-10-01T00:00:00Z"

curl -X PATCH -H "Authorization: Bearer sk_…" -H "Content-Type: application/json" \\
  -d '{"status":"no_show"}' "${APP_URL}/api/v1/partner/appointments/APPOINTMENT_ID"`}</Code>
      </Card>

      <h2 className="mb-3 mt-10 text-xl font-bold">Reference</h2>
      <div className="space-y-6">
        {ENDPOINTS.map((g) => (
          <Card key={g.group} className="overflow-hidden">
            <p className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm font-bold">{g.group}</p>
            <div className="divide-y divide-slate-100">
              {g.items.map((e) => (
                <div key={e.method + e.path} className="grid gap-2 px-5 py-3 sm:grid-cols-[64px_1fr_90px]">
                  <Badge tone={methodTone[e.method]} className="h-fit w-fit">
                    {e.method}
                  </Badge>
                  <div className="min-w-0">
                    <code className="break-all text-[13px] font-semibold text-ink">{e.path}</code>
                    <p className="mt-0.5 text-sm text-slate-600">{e.desc}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 sm:text-right">{e.auth}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
