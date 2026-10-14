# Sorriso — online booking & reminders for dental practices

A MioDottore/Docplanner-style platform focused on dentists: a public marketplace where patients find a
dentist and book a real free slot in seconds, and a practice dashboard that runs **multiple offices,
practitioners and chairs on one calendar**, with **two-way SMS / WhatsApp / email reminders** that ask
patients to confirm.

Built for Italian practices and their patients' data: health-related free text is encrypted at field level,
patient links are stored hashed and expire, a hash-chained audit log records access to patient data, and
public URLs are locale-prefixed for 8 languages (`it` default, `en`, `de`, `fr`, `es`, `pt`, `ro`, `pl`).
Translations are filled in namespace by namespace; until then pages fall back to English.

## Quick start

```bash
cd sorriso
npm install
npm run db:reset     # create the SQLite database and load demo data
npm run dev          # http://localhost:3010 (redirects to /it, or your browser's language)
```

Demo logins (password `demo1234`): **demo@sorriso.dev** (owner of a 2-office practice + admin of a second
practice) and **reception@sorriso.dev** (front desk). Or open `/login?demo=1`.

Nothing else is needed locally. Without provider keys every email/SMS/WhatsApp is *captured* and shown in
**Dashboard → Messages**, where you can also simulate patient replies, so the whole confirmation loop works
offline. Encryption and keyed hashes fall back to built-in development keys.

## What's in it

**Patients (public site)**
- Search by treatment and city; results are *practitioners* with their next real free slots, bookable in one click.
- Practice and practitioner pages: offices with maps, team, prices, verified reviews.
- 3-step booking (treatment → time → details), no account. “First available” spreads bookings across the team.
- Choose reminders by SMS, WhatsApp or email. Calendar invite (.ics + Google link).
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
  software — see `/it/developers` for the reference.
- Embeddable widget: `<script src="https://YOUR-DOMAIN/widget.js" data-clinic="studio-bianchi" async></script>`
- Twilio webhooks for inbound replies and delivery receipts; cron endpoints for reminders and retention.

## Environment

Every variable is listed with a one-line explanation in [`.env.example`](.env.example) (copy it to `.env.local`),
which also holds the **production checklist**: EU regions, signed provider DPAs, link and open tracking off at
the SMTP provider. In short:

| Area | Variables |
| --- | --- |
| App and database | `APP_URL`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (Turso), `DEFAULT_COUNTRY_CODE` |
| Encryption (required in production) | `DATA_ENCRYPTION_KEYS` (`kid:base64-32-bytes,…`, first one encrypts), `HMAC_SECRET` |
| Sorriso as controller | `PLATFORM_LEGAL_NAME`, `PLATFORM_ADDRESS`, `PLATFORM_PRIVACY_EMAIL`, `PLATFORM_DPO_EMAIL` |
| Safety fences | `DEMO_MODE`, `ALLOW_DEMO_SEED`, `MESSAGING_ALLOWLIST`, `MESSAGING_LIVE` |
| Email | `SMTP_URL`, `EMAIL_FROM`, `SMTP_REQUIRE_TLS`, `SMTP_PROVIDER_*` (required in production with `SMTP_URL`) |
| SMS / WhatsApp | `TWILIO_*` (EU region: `TWILIO_REGION=ie1`, `TWILIO_EDGE=dublin`), `TWILIO_WHATSAPP_CONTENT_SIDS` |
| Background jobs | `CRON_SECRET`, `REMINDER_WORKER` |

Production refuses to start (`src/instrumentation.ts`) without `DATA_ENCRYPTION_KEYS` and `HMAC_SECRET`, or with
`SMTP_URL` but no `SMTP_PROVIDER_NAME`/`ENTITY`/`REGION`. Real messages go out only on the live deployment
(`MESSAGING_LIVE=1`); everywhere else only to `MESSAGING_ALLOWLIST`, and the rest is captured.

## Production

1. **Database**: `DATABASE_URL=libsql://…` and `DATABASE_AUTH_TOKEN` for [Turso](https://turso.tech) in an EU
   region, then `npm run db:migrate`. (The schema is plain SQL in `drizzle/`.)
2. **Keys**: generate `DATA_ENCRYPTION_KEYS` and `HMAC_SECRET` (commands in `.env.example`) and keep a copy
   outside the database. Rotate encryption keys by adding a new one in front and running `npm run db:encrypt`.
3. **Email**: `SMTP_URL` + `EMAIL_FROM` and the `SMTP_PROVIDER_*` description of the provider.
4. **SMS / WhatsApp**: Twilio credentials. Point the number's *“A message comes in”* webhook to
   `https://YOUR-DOMAIN/api/webhooks/twilio`. Business-initiated WhatsApp messages need Meta-approved templates.
5. **Background jobs**: on Vercel, `vercel.json` (region `fra1`) schedules `/api/cron/reminders` every 5 minutes
   (reminders and care jobs) and `/api/cron/retention` daily at 02:15 UTC; Vercel Cron sends
   `Authorization: Bearer $CRON_SECRET`. Long-running servers (`npm start`) run the same jobs in-process; set
   `REMINDER_WORKER=off` to use an external scheduler instead.
6. Set `APP_URL` to the public URL — it's used in every link patients receive.

Before going live with real patients, the legal texts drafted in code must be reviewed by an Italian privacy
lawyer or DPO.

## Scripts

```bash
npm run dev                 # dev server on :3010
npm run build               # production build
npm start                   # production server on :3010 (runs the background jobs in-process)
npm test                    # unit tests (vitest; each test file gets its own SQLite database)
npm run lint && npm run typecheck

npm run db:reset            # wipe + migrate + seed demo data (local SQLite only)
npm run db:migrate          # apply drizzle/ migrations and backfills
npm run db:seed             # load demo data into a migrated database
npm run db:generate         # create a migration after editing src/db/schema.ts
npm run db:encrypt          # re-encrypt encrypted columns under the active key (WP6, coming)

npm run reminders           # send due reminders and run the care jobs once; add -- --watch to keep going
npm run retention           # run the retention job once and print what it purged
npm run check:third-party   # check public pages for third-party requests and cookies (WP6, coming)

npm run i18n:check          # dictionary tests with every English key required in every locale
npm run i18n:report         # missing keys per locale; -- --literals <paths> lists hard-coded JSX text
npm run gen:calendar        # regenerate src/i18n/calendar-names.ts
```

## Project layout

```
src/
  proxy.ts                   locale routing (unprefixed URLs → /{locale}/…) and security headers
  instrumentation.ts         startup checks and the in-process background jobs
  app/[locale]/(site)/       public pages: search, clinic and practitioner pages, booking, patient self-service
  app/[locale]/embed/        the booking page the widget embeds
  app/a/                     short patient links (/a/<token>), redirected to the patient's language
  app/dashboard/             practice dashboard (its own root layout); server actions in actions/
  app/api/                   public and partner API (v1), Twilio webhooks, cron endpoints, calendar feeds
  components/                booking/ and dashboard/ client components
  db/                        schema.ts (Drizzle), enums.ts (safe for client code), encrypted columns
  i18n/                      typed i18n core and dictionaries
  lib/                       domain logic: availability, booking, reminders, inbound replies, messaging/,
                             privacy/ (consent, retention, notices…), audit, crypto, permissions, log
  test/                      vitest setup and fixtures
drizzle/                     SQL migrations
scripts/                     migrate, seed, reset, reminders, retention and i18n tooling
docs/                        the guides below
```

Times are stored in UTC; weekly schedules are stored as wall-clock minutes in each office's time zone, so
availability stays correct across daylight-saving changes.

**Double bookings.** Every booking re-checks the slot inside a write transaction. On a local SQLite file, writes
are serialised in-process (`src/db/serialize.ts`) because libsql gives each transaction its own connection and a
busy timeout would block the event loop; the tests fire concurrent bookings at the same slot and expect exactly
one to succeed.

## Documentation

- [Internationalisation](docs/i18n.md): locales, namespaces, translation API, formatting rules
- Messaging: templates, discreet content, providers, WhatsApp templates — `docs/messaging.md` (coming)
- Privacy: patient journey, DPIA, transfer impact assessment, records of processing, retention, breach runbook —
  `docs/privacy/` (coming)
- Security: key generation and rotation, sessions, MFA, incident steps — `docs/security.md` (coming)
- Marketplace: ranking, reviews, profiles — `docs/marketplace.md` (coming)
- Care: recalls, no-show risk, anamnesis — `docs/care.md` (coming)
- Accessibility statement and checks — `docs/accessibility.md` (coming)
