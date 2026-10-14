# Security

How Sorriso protects access to health data: who can sign in and how, what each role can see,
how integrations and calendar feeds are scoped, which headers every response carries, and what
to do when something goes wrong. Owned by WP6 (security).

> **Review status.** The legal statements in this document (GDPR articles, the 72-hour
> notification duty, Garante guidance) are drafts **to be reviewed by a lawyer/DPO** before they
> are relied on. The technical descriptions are authoritative for the code in this repository.

Code map:

| Area | Code |
| --- | --- |
| Sessions, `requireStaff`, `requireStepUp`, `requirePlatformAdmin` | `src/lib/auth.ts` |
| Roles and permissions | `src/lib/permissions.ts` |
| Passwords (scrypt, policy, common-password list) | `src/lib/password.ts`, `src/lib/security/common-passwords.ts` |
| TOTP (RFC 6238) and recovery codes | `src/lib/totp.ts`, `src/lib/security/mfa.ts` |
| Sign-in throttling, new-device detection | `src/lib/security/login.ts` |
| Withdrawing feeds and keys on removal or demotion | `src/lib/security/offboarding.ts` |
| One-time email tokens (reset, confirm, invite) | `src/lib/security/tokens.ts` |
| Emails about the account (`authEmails` namespace) | `src/lib/security/emails.ts` |
| Rate limits | `src/lib/rate-limit.ts` |
| Partner API keys, scopes, CORS | `src/lib/api.ts`, `src/lib/serializers.ts`, `src/lib/security/ip.ts` |
| Per-request CSP | `src/lib/security/headers.ts` (applied by `src/proxy.ts`) |
| Static headers | `next.config.ts` |
| Public account pages | `src/app/[locale]/(site)/{login,signup,reset-password,invite,verify-email}`, `src/app/auth-actions.ts` |
| Dashboard pages | `/dashboard/account/security`, `/dashboard/team`, `/dashboard/settings/api` |
| Scripts | `scripts/encrypt-existing.ts`, `scripts/grant-platform-admin.ts`, `scripts/check-third-party.ts`, `scripts/seed.ts` |

## Sessions

- The cookie holds a random 256-bit token; the database stores only its SHA-256 (`sessions.id`).
- Name: `__Host-sorriso_session` when `APP_URL` is https (Secure, `Path=/`, no `Domain`, so a
  sibling subdomain can neither read nor plant it), `sorriso_session` on plain-http development.
  `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- **Absolute lifetime**: the practice's `privacy.sessionHours` (1-24, default 12) from sign-in,
  whatever the activity. A shorter value set later applies to open sessions too. Switching
  practice never extends it.
- **Idle timeout**: 30 minutes. `lastSeenAt` slides at most once a minute.
- Stored per session: `ipHash` (HMAC of the IP, never the address) and the user agent, shown in
  *My security → Signed-in devices*.
- **Rotation**: a new session id on sign-in, after the second step, on switching practice
  (`switchSessionOrg`), on accepting an invitation and on a password change.
- **Revocation**: all of a user's sessions are deleted on a password change or reset, an MFA
  reset by a manager, and revocation of platform-admin rights. Removal from a practice deletes the
  sessions open in that practice, and all of them when it was the person's only practice (one
  practice must not sign someone out of the others they work for). Users can sign out any of
  their other sessions themselves. A session older than the user's `passwordChangedAt` is refused
  even if its row survived.

## Signing in

- **Throttling** (`login_attempts`, HMACs of the email and the client network only): after
  5 failures for one email, or 20 from one network (an IPv6 /64 counts as one), within
  15 minutes, every attempt is refused with the same generic message, the correct password
  included, until the window has passed. Failures before the email's last successful sign-in
  don't count against it. An attempt is written (as a failure) **before** its password is
  checked and turned into a success afterwards, and the throttle counts every row written before
  it: a burst of parallel requests can't all read "no failures yet", so at most 5 passwords per
  email (20 per network) are ever tried in a window. Refused attempts are removed again, so
  hammering a locked account doesn't extend the lock.
- **No account enumeration**: an unknown email is checked against a fixed dummy scrypt hash, so
  it costs the same time and gets the same answer as a wrong password. Signup and password reset
  answer "check your inbox" whether or not the address has an account (an existing address gets
  a "someone tried to sign up with your email" message instead).
- **Notifications**: the account owner is emailed when the failure limit is reached and after a
  sign-in from a device not seen before (no successful sign-in from the same network in 90 days
  and no live session with the same browser).
- **Emails about the account** are sent with `orgId` null (they never show in a practice's
  message log) and with a redacted log body: reset, confirmation and invitation links are
  credentials and never sit in the database in clear.
- Every event is audited: `auth.signup` (a practice and its first owner created, next to the
  `legal.accept` rows), `auth.login.success` (with `step: password | mfa | step_up`),
  `auth.login.fail` (with the reason: `password`, `unknown_account`, `throttled`),
  `auth.logout`, `auth.email.verify` (entity user for the sign-in address, entity org for the
  practice's email), `auth.email.resend`, `auth.mfa.enable` (also new recovery codes,
  `change: recovery_codes_regenerated`), `auth.mfa.disable` (`change: disabled |
  removed_for_replacement`), `auth.mfa.reset`, `auth.mfa.fail`, `auth.password.change`,
  `auth.password.reset`, `session.revoke`. Rows written before these actions existed carry the
  stand-ins: `settings.update` with `emailVerified` / `emailVerification: resent`,
  `auth.mfa.enable` with `change: disabled`, `session.revoke` with `cause: mfa_reset`.
- **Email confirmation**: one `email_verify` token kind (24 hours, single use) serves two
  addresses, and the token's own address decides which: the user's sign-in address
  (`users.emailVerifiedAt`) and the practice's email (`organizations.emailVerifiedAt`, which
  online booking needs), the latter only when an owner of that practice issued the link and the
  address is still the practice's. At signup both are the same address. A practice email changed
  in the settings gets its own message (`sendPracticeEmailVerification()`, text
  `authEmails.verifyPracticeEmail`): confirming it never marks the owner's own address as
  verified, and a link whose address no longer matches either confirms nothing.

## Passwords

- scrypt (N=16384, 64-byte key, 16-byte salt).
- 12 to 128 characters, any characters (spaces welcome), no composition rules (NIST SP 800-63B).
  Refused: the 10,000 most common passwords (bundled list), a common password with digits or
  symbols around it (`dragon123456`), four or fewer distinct characters, and passwords containing
  the user's email name or own name.
- **Reset**: a single-use `auth_tokens` row (`password_reset`, 30 minutes, only its hash
  stored); requesting a new one invalidates the older ones. A reset ends every session and
  emails the user.
- **Change** (*My security*): needs the current password (5 tries per 15 minutes), ends every
  other session, voids reset links requested before (so a link someone else asked for can't set
  yet another password afterwards) and emails the user.

## Two-step verification (TOTP)

- RFC 6238: HMAC-SHA1, 30-second steps, 6 digits, ±1 step of drift, 160-bit base32 secrets,
  `node:crypto` only. The secret is stored in `users.totp_secret_enc` (AES-256-GCM, bound to its
  column). A code is accepted once: the matched step is recorded for 2 minutes.
- **Required** for owners, admins and platform admins always, and for every role when the
  practice's `privacy.requireMfa` is on (the default). `requireStaff()` sends someone who still
  has to enrol to `/dashboard/account/security?setup=mfa` and nowhere else (the legal page is
  also reachable, so it can't loop with the legal gate). Demo practices in demo mode are exempt.
- **Enrolment**: the page shows the setup key and an `otpauth://` link (no QR library, nothing
  third-party), then asks for a first code. Enabling it signs out the user's other sessions. Both
  steps need step-up, so a stolen session cookie alone can't put the thief's authenticator on the
  account and lock the owner out; right after signing in the password counts as fresh, so the
  enrolment forced after login goes straight through.
- **Recovery codes**: 10 codes of 10 characters, stored as HMACs, each usable once, shown once
  (copy or download as a text file). Users can generate a new set (old ones stop working).
- **Sign-in**: with MFA on, the password gives a *pending* session that is good for nothing but
  `/{locale}/login/mfa` for 10 minutes; 5 code attempts per sign-in and 10 per 15 minutes per
  user. Success rotates the session and sets `sessions.mfaVerifiedAt`.
- **Step-up** (`requireStepUp(maxAgeMinutes = 10)`): sensitive operations need a second step or
  a re-entered password (for users without MFA) in the last 10 minutes. Pages redirect to
  `/dashboard/account/security/verify?next=…`; server actions answer
  `{ ok: false, code: "step_up_required" }` and the dashboard's components send the user to the
  same page. Used today for: API keys, invitations, role changes, member removal, MFA resets,
  MFA enrolment, recovery codes and turning MFA off (and by WP5 for exports, erasure and privacy
  settings).

### MFA recovery

1. **Lost phone, has recovery codes**: sign in with a recovery code instead of the 6-digit code,
   then *My security → Use a different phone*.
2. **Lost phone and codes**: an owner or admin of the practice resets it from *Team → Reset
   two-step* after checking the person's identity in person or by phone (never by email alone).
   The member is signed out everywhere and enrols again at the next sign-in. Only an owner can
   reset another owner. The reset is audited (`auth.mfa.reset`) and the
   member is emailed. The authenticator protects the whole account, in every practice, so a
   practice can reset it only for someone who works for that practice alone: for a member of
   another practice too, or a platform admin, the team page doesn't offer it and the action
   answers `shared_account`. Those go to Sorriso support (step 3's procedure).
3. **Sole owner locked out**: Sorriso support handles it as a security incident: verify the
   owner's identity against the practice's contract records (for example a signed request on the
   practice's letterhead plus a call back to the number on file), record it in the incident
   register, then clear the factor and end the sessions in the database
   (`UPDATE users SET totp_secret_enc = NULL, totp_enabled_at = NULL, recovery_code_hashes = '[]' WHERE email = ?;`
   `DELETE FROM sessions WHERE user_id = ?;`). The owner enrols again at the next sign-in.

## Roles and permissions

`src/lib/permissions.ts` is the single source; `permissions.test.ts` snapshots the whole matrix,
so any change shows up in review. Pages call `requirePermission()`, actions
`guard(fn, { permission })`.

| | owner | admin | practitioner | reception |
| --- | --- | --- | --- | --- |
| Calendar, appointments, appointment notes | ✓ | ✓ | ✓ | ✓ |
| Patient identity and contacts | ✓ | ✓ | ✓ | ✓ |
| Edit patients | ✓ | ✓ | | ✓ |
| Patient notes, clinical record, anamnesis | ✓ | ✓ | ✓ | |
| Recalls, message log | ✓ | ✓ | ✓ | ✓ |
| Exports, erasure, restriction, privacy requests and settings, audit log | ✓ | ✓ | | |
| Settings, team, API keys, reminders, catalog, reviews, analytics | ✓ | ✓ | | |
| Close the practice's account | ✓ | | | |

Loaders that hand a patient row to a page pass it through `visiblePatient(role, row)`, so a role
without `patient.notes.read` never receives the notes. Every query is scoped by the session's
practice; `src/lib/security.test.ts` calls every dashboard action and loader with another
practice's ids and checks that nothing of it changes or leaks.

## Team

- **Invitations**: `auth_tokens` (`invite`, 7 days, single use, carrying the role and the
  inviter); a new invitation to the same address replaces the open one. The link
  `/{locale}/invite/{token}` shows the practice's staff instructions (Art. 29 GDPR,
  Art. 2-quaterdecies Codice privacy; text owned by WP5), which the invitee must accept
  (`recordLegalAcceptance('staff_instructions')`, which also stamps
  `memberships.instructionsVersion`). A new person creates an account (the link proves the
  mailbox, so the email counts as confirmed); an existing account must be signed in.
- **Rules**: nobody changes their own role or removes themselves; only an owner gives or takes
  away the owner role (or removes or resets an owner); a practice always keeps one owner.
- **Role changes** are applied with an explicit *Change role* button and a confirmation, never
  by picking from the list alone.
- **Removal** deletes the membership and ends the person's sessions in this practice (all their
  sessions when it was their only practice).
- **What leaves with a manager** (`src/lib/security/offboarding.ts`): feed URLs and API key
  secrets are shown once, to whoever creates them, so on removal, or on a role change to a role
  that can no longer create them, Sorriso withdraws what the person holds:
  - calendar feeds whose current URL they generated (`practitioners.icsIssuedByUserId`, set by
    `rotateIcsToken` and cleared when the feed is turned off) are turned off once they can't
    manage the team; the feed of their own practitioner profile stays while they are a member;
  - on removal, the feed of the practitioner profile linked to them is turned off too, whoever
    generated it (it delivers to their calendar);
  - API keys they created are revoked once they can't manage API keys.
  Each is audited (`ics.feed.rotate` with `enabled: false`, `apikey.revoke`, with
  `cause: member_removed | role_changed`), the confirmation dialogs say so, and the result tells
  the manager how many links and keys stopped working, to issue again if still needed.
  Migration 0003 filled `icsIssuedByUserId` for existing feeds from their newest
  `ics.feed.rotate` audit row; feeds carried over from before the first migration (backfill)
  have none and can't be attributed: after removing a manager, regenerate such feeds from the
  team page.
- Audited: `member.invite` (sent, accepted), `member.invite_withdraw`, `member.role_change`,
  `member.remove`, `auth.mfa.reset`.

## Partner API keys

- Format `sk_<256-bit random>`; only the SHA-256 is stored; the secret is shown once.
- **Scopes**: `appointments:read`, `appointments:write`, `patients:read`, `patients:write`,
  `notes:read`, `patients:erase`. Responses are cut to the scopes: appointment notes only with
  `notes:read`, birth date and no-show count only with `patients:read`. Restricted/erased flags
  are always included so integrations can honour Art. 18 and 17 (Art. 19).
- **Expiry**: always, 1-24 months (default 12). Expired and revoked keys get 401. A key from
  before expiries existed (`expires_at` NULL) expires 12 months after it was created
  (`apiKeyExpiry()`), and the API settings page shows that date. The formerly hard-coded demo
  key `sk_demo_studio_bianchi_local_only` is refused whatever the database says.
- **IP allow-list** (optional): exact addresses or CIDR ranges, IPv4 and IPv6; another address
  gets 403 `ip_not_allowed`. The address is `clientIp()`'s (see *Rate limits*), so the
  deployment's trusted header must be configured correctly.
- The public booking and waitlist routes called with a key need `appointments:write`, count
  against the key's per-minute limit and are audited as `api.request` like the partner routes.
- Creating a key needs step-up and emails every owner of the practice.
- `/api/v1/partner/**` sends **no CORS headers** (a browser page can't use a key), `no-store`,
  600 calls per minute per key, and audits every call (`api.request`: method, route, status;
  actor = the key).
- New partner routes (for example WP5's patient erasure) go through `partnerRoute(req, scope,
  route, handler)` in `src/lib/api.ts`, which does the key check, scope, rate limit, CORS
  stripping and the `api.request` audit.

## Calendar feeds

`/api/ics/practitioner/{token}.ics` serves a feed only while the practice's
`privacy.icsFeedsEnabled` and the practitioner's feed are on and the token (looked up by hash) is
younger than 12 months (a feed without an expiry, issued before expiries existed, no longer
works). Events cover the past 7 days and the next 30 and read "Appointment" (or
"Appointment · G. S." with `icsDetail: initials`): never the treatment, the patient's name or a
note. A patient who restricted processing (Art. 18) or was erased is always just "Appointment",
whatever `icsDetail` says: the dashboard masks them too, and the calendar provider is a third
party. Each fetch is audited (`ics.feed.fetch`, with the HMAC of the caller's IP), rate-limited
(30 per hour per feed; unknown URLs 30 per hour per network) and `Cache-Control: no-store`. The
URL is shown once when created; only the linked practitioner or a manager can create, rotate
or turn off a feed, and the card explains that the calendar provider receives the data.

## Patient links

- **Staff copying a link** (`issuePatientLink`, audited `appointment.link.issue`, 120 per user per
  hour): the link opens the patient's data, so the restriction rules apply as in the drawer. A
  restricted patient's (Art. 18) only for staff with `patient.restricted.read` who gave a reason
  for that record recently (`restricted` otherwise); an erased patient's never (`erased`).
- **Proving a contact** (`patients.verifiedContacts`): a patient's explicit POST from the link
  (confirm, cancel, reschedule; never a GET, which mail scanners make) records the contact the
  link was delivered to (`manageLinkContact()` in `src/lib/security/link-contact.ts`), only when
  exactly one contact can be holding it: the visit was booked by staff or from a waitlist offer
  (online, widget and API bookings also return the link to the browser that booked, which proves
  nothing about the phone or email typed in), staff never copied the link, and every message that
  carried it went to that one contact. Online bookings prove contacts by an SMS reply or a
  one-time code instead.

## Headers

Per request (`src/lib/security/headers.ts`, every response including redirects):

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<random>' 'strict-dynamic';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';
  frame-src https://www.openstreetmap.org; object-src 'none'; base-uri 'none'; form-action 'self';
  frame-ancestors 'none'            (https: on /{locale}/embed/*)
```

The nonce is passed to the app in the `content-security-policy` and `x-nonce` request headers
(always overwritten, so a client can't supply its own); Next.js puts it on every script it
renders. **Every HTML page must therefore be rendered per request**: a page prerendered at build
time has no nonce and the browser blocks its scripts. `check:third-party` reports such pages.

Static (`next.config.ts`): `poweredByHeader: false`; HSTS (production, 2 years, preload);
`X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`;
`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`;
`Cross-Origin-Opener-Policy: same-origin`; `X-Frame-Options: DENY` everywhere except
`/{locale}/embed/*`; and on `/a/*`, `/{locale}/a/*`, `/api/ics/*`, `/api/v1/appointments/*` and
`/{locale}/privacy/*`: `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`,
`Cache-Control: private, no-store`.

The embed's `frame-ancestors https:` doesn't name a practice's allowed websites: the proxy has no
database access, and browsers ignore `frame-ancestors` in a `<meta>` tag. The embed page enforces
the list itself and fails closed (a parent that isn't listed, or that the Referer doesn't vouch
for, gets only a link that opens the booking in a new tab, nothing to click through a frame).

## Rate limits

Fixed windows in the `rate_limits` table (shared by every serverless instance), keyed by an HMAC
of the client's network (an IPv6 /64 counts as one network).

**Client address** (`clientIp()` in `src/lib/rate-limit.ts`): only a header the deployment's own
edge writes is believed. Anything else a client can send with any value, to pick its rate-limit
bucket or pass an API key's IP allow-list.

| Deployment | Address used | Configure |
| --- | --- | --- |
| Vercel | `x-vercel-forwarded-for` (the platform overwrites it) | nothing (`VERCEL` is set by the platform) |
| Behind one proxy that appends to `X-Forwarded-For` (Caddy, nginx with `$proxy_add_x_forwarded_for`, Traefik) | the last `X-Forwarded-For` hop | nothing (the default) |
| Behind a proxy that overwrites a dedicated header (nginx `X-Real-IP $remote_addr`, Cloudflare `CF-Connecting-IP`), or several proxies | that header | `TRUSTED_IP_HEADER=x-real-ip` (or `cf-connecting-ip`, …) |

`x-real-ip` and `x-vercel-forwarded-for` are ignored unless configured this way: a proxy that
doesn't know them passes a client's value through untouched. The app must not be reachable
except through the proxy (a direct client could write `X-Forwarded-For` itself).

| Endpoint | Limit |
| --- | --- |
| Sign-in | 5 failures per email, 20 per network, per 15 min (`login_attempts`) |
| Second step | 5 per sign-in, 10 per user per 15 min |
| Signup | 5 per network per hour |
| Password reset request | 5 per network per 15 min; 3 emails per address per hour |
| Public booking (`POST /api/v1/clinics/:slug/appointments`) | 10 per network per 10 min (with an API key: the key's 600 per minute) |
| Waitlist | 5 per network per 10 min (with an API key: the key's 600 per minute) |
| Clinic profile, availability | 120 per network per minute |
| `/api/v1/appointments/:token` | 60 reads, 20 changes per network per 10 min |
| Practitioner feed | 30 per feed per hour; 30 unknown URLs per network per hour |
| Partner API | 600 per key per minute |
| Staff: invitations, patient links | 20 per practice per hour; 120 links per user per hour |

## Encryption at rest

- Free text that may hold health data is AES-256-GCM encrypted per value (`encryptedText`),
  with the `table.column` as associated data so a ciphertext can't be moved to another column.
- **Keys**: `DATA_ENCRYPTION_KEYS="k2:<base64 32 bytes>,k1:<…>"`. The first key encrypts; all
  decrypt. Generate one with `openssl rand -base64 32`. Keep them in the hosting provider's
  secret store, never in the repository or the database. The app refuses to start in production
  without keys and `HMAC_SECRET`.
- **Rotation**:
  1. Add the new key in front (`k3:<new>,k2:<old>`) and deploy.
  2. `npm run db:encrypt -- --dry-run` shows how many values are not yet under `k3`;
     `npm run db:encrypt` rewrites them in batches of 500 (idempotent, safe to re-run; a value
     edited meanwhile is left for the next run). Besides every `encryptedText` column it rotates
     the review texts `src/lib/reviews.ts` encrypts itself (`reviews.comment` and
     `removed_reason`, `review_reports.details`, `patient_response` and `decision_reason`), but
     only their values that are already encrypted: a published comment is public and stays in
     plaintext.
  3. When it reports 0 left and backups encrypted under the old key have aged out, remove the
     old key.
- **`HMAC_SECRET`** keys every lookup hash (contacts, IPs, tokens) and the audit chain. Rotating
  it invalidates: the audit chain's verification for older rows (record `logAuditHeads()` first),
  contact matching for the privacy center, rate-limit and login-attempt history, unsubscribe
  links and practice `?ref=` links. Rotate it only after a suspected leak, as an incident.

## Demo safety

- `scripts/seed.ts` refuses to run when `NODE_ENV` is production or `DATABASE_URL` is not a
  local `file:` database, unless `ALLOW_DEMO_SEED=1` (`npm run db:reset` sets it for a local
  reset).
- Seeded phone numbers are in the unassigned `+39 000…` range and emails use reserved domains
  (`.example`, `example.com`), the demo logins included (`demo@sorriso.example`,
  `reception@sorriso.example`, `src/lib/security/demo-accounts.ts`), so no real person can be
  contacted even if a provider is misconfigured: sign-in alerts, resets and invitations a public
  demo sends for them go nowhere. The demo API key is random, stored hashed and printed once.
- The login page's demo box and `?demo=1` exist only when `DEMO_MODE=1`. Messaging outside the
  live deployment goes only to `MESSAGING_ALLOWLIST` (`src/lib/demo.ts`).

## No third parties

`npm run check:third-party` (against a running server, default `http://localhost:3010`, or
`--base`) fetches `/`, `/it/search`, `/it/c/<demo>`, `/it/book/<demo>`, `/it/embed/<demo>` and a
manage link, and fails if the HTML or the CSS loads anything from another origin (the
OpenStreetMap URL inside the click-to-load map template excepted), if a response sets a cookie
other than the staff session, `NEXT_LOCALE` or the privacy-center session (`__Host-sorriso_pc`,
`sorriso_pc` on plain http), or if a script lacks the CSP nonce. Run it before every release.

## Platform admins

`npm run platform:grant -- <email> [--revoke]` (`scripts/grant-platform-admin.ts`). Platform
admins must use two-step verification; every request to `/dashboard/platform/**` is audited
(`platform.access`), and the grant or revocation itself is recorded on the platform audit chain
(`platform.admin_grant`, `metadata.platformAdmin`; older rows: `member.role_change` with
`scope: platform`). Revoking ends the user's sessions.

## Incident response

*To be reviewed by a lawyer/DPO.* Sorriso is the practices' processor (Art. 28) for practice
data and an independent controller for marketplace data; the steps differ in who notifies whom.

1. **Contain** (minutes): revoke what is compromised: sign out the affected users (*Team* or
   `DELETE FROM sessions WHERE user_id = ?`), revoke API keys, turn off calendar feeds
   (`privacy.icsFeedsEnabled`), rotate credentials of compromised providers. For a leaked
   `DATA_ENCRYPTION_KEYS` entry: add a new key, run `db:encrypt`, remove the leaked key.
2. **Preserve evidence**: export the affected audit chains and run `verifyAuditChain()` against
   the last logged heads (`logAuditHeads()` output in the hosting logs); keep application logs
   (they hold no personal data by design).
3. **Assess** with the DPO: which data, which practices and patients, likely consequences.
4. **Notify**: as processor, tell every affected practice without undue delay (Art. 33(2)) with
   what is known; the practice, as controller, notifies the Garante within 72 hours of becoming
   aware (Art. 33(1)) and the patients when the risk is high (Art. 34). For marketplace data
   Sorriso notifies the Garante itself.
5. **Record** the incident in the breach register (Art. 33(5)) whatever the outcome, with the
   decisions taken and why.
6. **Review**: fix the cause, add a test that would have caught it, update this document.
