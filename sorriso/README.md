# Sorriso — online booking & reminders for dental practices

A MioDottore/Docplanner-style platform focused on dentists: a public marketplace where patients find a
dentist and book a real free slot in seconds, and a practice dashboard that runs **multiple offices,
practitioners and chairs on one calendar**, with **two-way SMS / WhatsApp / email reminders** that ask
patients to confirm.

```bash
cd sorriso
npm install
npm run db:reset     # create the SQLite database and load demo data
npm run dev          # http://localhost:3010
```

Demo logins (password `demo1234`): **demo@sorriso.dev** (owner of a 2-office practice + admin of a second
practice) and **reception@sorriso.dev** (front desk). Or open `/login?demo=1`.

Without any provider keys every email/SMS/WhatsApp is *captured* and shown in **Dashboard → Messages**, and
you can simulate patient replies there — so the whole confirmation loop works locally.

## What's in it

**Patients (public site)**
- Search by treatment and city; results are *practitioners* with their next real free slots, bookable in one click.
- Practice and practitioner pages: offices with maps, team, prices, verified reviews.
- 3-step booking (treatment → time → details), no account. “First available” spreads bookings across the team.
- Choose reminders by SMS, WhatsApp or email, in Italian or English. Calendar invite (.ics + Google link).
- Self-service link in every message: confirm, reschedule (until N hours before), cancel (always allowed —
  a late cancellation beats a no-show).
- Waitlist: “text me if something earlier opens up”. Freed slots are offered automatically, first to book wins.
- Verified reviews only — requested after a visit is marked completed.

**Practices (dashboard)**
- **Calendar**: day view by practitioner or by chair, week view, filter by office/practitioner. Working hours shaded,
  time off hatched, cleanup buffers visible. Click an empty slot to book, drag an appointment to move it.
- **Multi-office**: a practitioner can work in Milano in the morning and Monza in the afternoon; they can never be
  double-booked across offices, and every booking needs a free chair at that office.
- **Confirmations board**: tomorrow at a glance, who's still unconfirmed, one-click remind/confirm, patients with
  past no-shows flagged; online requests to approve; past visits to mark completed / no-show.
- **Two-way messaging**: replies like *SI, Sì, OK, 👍, “ci sarò”* confirm; *NO, “non posso”* cancel (slot goes to the
  waitlist); *“spostare”* gets a reschedule link; *STOP* opts out; anything else is flagged for the front desk.
- **Reminder rules** per practice (default: email 48h asking to confirm, text 24h asking to confirm, text 2h).
  Later reminders stop asking once confirmed; falls back to email if there's no mobile.
- Team & working hours (several windows per day, each at an office), time off and closures (practitioner, chair,
  office or whole practice), treatments with duration/buffer/price, offices & chairs, patients, waitlist, reviews.
- Optional approval mode: online bookings arrive as requests that hold the slot until approved.
- Per-practitioner **calendar feed** (subscribe in Google/Apple/Outlook), roles (owner/admin/reception/practitioner),
  one login for several practices.

**Integrations**
- Public booking API (the website and widget use it themselves) and a partner API with keys for practice
  software — see `/developers` for the reference.
- Embeddable widget: `<script src="https://YOUR-DOMAIN/widget.js" data-clinic="studio-bianchi" async></script>`
- Twilio webhooks for inbound replies and delivery receipts; cron endpoint for reminders.

## How it works

| Piece | Where |
| --- | --- |
| Data model (orgs → offices → chairs, practitioners, schedules, appointments, reminders, messages, waitlist…) | `src/db/schema.ts` |
| Availability engine: hours per office, conflicts across offices, buffers, time off, chair capacity, policy | `src/lib/availability.ts` |
| Booking operations (create/confirm/cancel/reschedule/approve/outcome), all in write transactions | `src/lib/booking.ts` |
| Reminder scheduling and dispatch (lease-based, safe with overlapping cron runs, retries) | `src/lib/reminders.ts` |
| Inbound SMS/WhatsApp reply understanding | `src/lib/inbound.ts` |
| Message templates (IT/EN, email HTML + text, SMS) | `src/lib/messaging/templates.ts` |
| Providers: SMTP (nodemailer), Twilio SMS/WhatsApp, dev capture | `src/lib/messaging/providers.ts` |
| Waitlist offers | `src/lib/waitlist.ts` |
| Public API, partner API, webhooks, cron, ICS | `src/app/api/**` |
| Dashboard server actions (all scoped to the signed-in practice) | `src/app/dashboard/actions.ts` |

Times are stored in UTC; weekly schedules are stored as wall-clock minutes in each office's time zone, so
availability stays correct across daylight-saving changes.

**Double bookings.** Every booking re-checks the slot inside a write transaction. On a local SQLite file, writes
are serialised in-process (`src/db/serialize.ts`) because libsql gives each transaction its own connection and a
busy timeout would block the event loop; the tests fire concurrent bookings at the same slot and expect exactly
one to succeed.

## Production

1. **Database**: set `DATABASE_URL=libsql://…` and `DATABASE_AUTH_TOKEN` for [Turso](https://turso.tech), then
   `npm run db:migrate`. (The schema is plain SQL in `drizzle/`; moving to Postgres means switching the Drizzle
   dialect.)
2. **Email**: `SMTP_URL` + `EMAIL_FROM` (Resend, Postmark, SES, Mailgun… anything with SMTP).
3. **SMS / WhatsApp**: Twilio credentials (see `.env.example`). Point the number's *“A message comes in”*
   webhook to `https://YOUR-DOMAIN/api/webhooks/twilio`. Business-initiated WhatsApp messages need a
   Meta-approved template (`TWILIO_WHATSAPP_CONTENT_SID`).
4. **Reminders**: long-running servers (`npm start`) send them in-process every minute. On serverless, call
   `GET /api/cron/reminders` every 1–5 minutes with `Authorization: Bearer $CRON_SECRET` (`vercel.json`
   includes a 5-minute Vercel Cron, which needs a paid plan; otherwise use any external scheduler).
5. Set `APP_URL` to the public URL — it's used in every link patients receive.

Before going live with real patients, review GDPR basics for health data: a privacy notice and DPA with the
practice, data retention, and EU hosting for the database and providers.

## Scripts

```bash
npm run dev          # dev server on :3010
npm run build        # production build
npm test             # unit tests (availability, DST, booking races, reminders, SMS replies)
npm run lint && npm run typecheck
npm run db:reset     # wipe + migrate + seed (local SQLite only)
npm run db:generate  # create a migration after editing src/db/schema.ts
npm run reminders -- --watch   # standalone reminder worker
```
