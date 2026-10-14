# Marketplace (WP7)

Patients find a dentist through **transparent, payment-neutral ranking** and Italy-specific
filters, on **profiles practitioners control** and whose Albo registration Sorriso has checked.
Reviews are **consented, pseudonymous by default, screened for health data**, and practices
**cannot suppress them**: only Sorriso's moderators decide, with a statement of reasons and one
appeal.

> **Legal review.** Every legal statement in this package (the ranking page, the review policy,
> the advertising rules, the tax note, the moderation and notice texts) is a careful draft. It
> **must be reviewed by a lawyer / DPO** before go-live. Citations to check against primary
> sources: P2B Regulation 2019/1150 Art. 5; DSA 2022/2065 Art. 16, 17, 20, 21; Codice del Consumo
> art. 22 c. 4-bis (as added by D.Lgs. 26/2023, Omnibus); Legge 145/2018 art. 1 c. 525; TUIR art. 15
> c. 1 lett. c (19% deduction, €129.11 threshold) and the traceable-payment rule (L. 160/2019 c. 679).

## Files

| Area | Files |
| --- | --- |
| Directory, search, stats | `src/lib/directory.ts` |
| Ranking | `src/lib/ranking.ts` |
| Reviews and moderation | `src/lib/reviews.ts` |
| Health-term flagger (pure, client-safe) | `src/lib/health-terms.ts` |
| Health-advertising check (pure, client-safe) | `src/lib/compliance/advertising.ts` |
| Public pages | `src/app/[locale]/(site)/search`, `c/[org]`, `c/[org]/[practitioner]`, `a/[token]/review/**`, `legal/reviews`, `legal/ranking` |
| Public components | `SearchForm`, `PractitionerCard`, `ReviewList`, `ReviewForm`, `RatingBreakdown`, `MapEmbed`, `booking/BookingExtrasSection`, `marketplace/*` |
| Dashboard | `dashboard/reviews`, `services`, `locations`, `settings/funds`, `platform` (hub), `platform/practitioners`, `platform/reviews`; actions `practitioners`, `services`, `locations`, `reviews`, `funds`, `platform` |
| Dashboard components | `dashboard/PractitionerForm` (server wrapper) → `marketplace/PractitionerEditor`, `ServiceForm`, `RoomManager`, `ReviewReply` |
| Dictionaries | `src/i18n/messages/en/{marketplace,reviews,catalog,reviewEmails}.ts` (`reviewEmails` is server-only) |
| Seed | `scripts/seed/marketplace.ts` |

## Listing rule

A practitioner is **listed** (search, profile page, team on the practice page, ratings, reviews)
only when `active && publicProfile && profileApprovedAt && !marketplaceOptOutAt`
(`listedPractitioner()` / `isListed()` in `directory.ts`). Otherwise the practitioner page is a
404. A practice that left the marketplace (`organizations.listed = false`, or a closure request)
has no practice page either, unless the visitor arrives through the practice's own signed link
(`?ref=`). The **booking form** still offers every active practitioner: booking through the
practice's channels doesn't depend on the marketplace.

`PublicClinic.practitioners[]` gained `listed` and `profile` (null when unlisted; the bio of an
unlisted practitioner is not sent). All added `PublicClinic` fields are optional, so existing
literals keep compiling.

### Profiles, approval, opt-out

- **Approval** (`approvePublicProfile`): only the practitioner (their linked `users` account) or
  the practice **owner**. It records `profileApprovedAt` / `profileApprovedByUserId` and is
  audited (`practitioner.profile.approve`). When anyone else (an admin) changes what patients see
  (name, title, areas of interest, bio, languages, specialisations, care options), the approval is
  cleared and must be given again; an approver's own edit refreshes it.
- **Opt-out** (`setMarketplaceOptOut`): only the practitioner, from their own account. It also
  clears the approval; the owner can't undo it (and approving doesn't override it).
- **Legal specialisations** (orthodontics, oral surgery, paediatric dentistry: `LEGAL_SPECIALIZATIONS`)
  are shown only once the **Albo** registration is verified. Everything else is "Areas of
  interest" (the `specialty` text). Changing the Albo province/number or the specialisations
  clears `alboVerifiedAt`.
- An empty "Areas of interest" is stored empty (never an English default); WP7's pages and cards
  show `marketplace.profile.defaultSpecialty` ("Dentist", translated) instead, without a `lang`
  attribute since it is not the practice's text. The title has no default either (the field shows
  "Dr." as a placeholder only).
- **Albo verification queue**: `/dashboard/platform/practitioners` (platform admins). The
  moderator looks the registration up in the public FNOMCeO register (opened by hand: no
  automated requests) and confirms it (`alboVerifiedAt`, `alboVerifiedByUserId`). Public badge:
  "Registered with the Albo degli Odontoiatri of {province}: verified on {date}" (the number itself
  is not published).
- `PractitionerForm` keeps its props (`practitioner?`, `services`, `offered`) and reads the viewer
  from the session. **Integration blocker: WP6's `team/[id]` renders it only with `team.manage`**,
  which the `practitioner` role lacks, so today a dentist logged in with their own account can't
  reach "Remove me from the marketplace" or approve their profile (the server actions allow them).
  WP6 must also render it when `p.userId === s.user.id` (for them it shows the preview, approval
  and opt-out only). WP7 owns no dashboard route where a self-service page could live.
- New practitioners never get a slug from `RESERVED_PRACTITIONER_SLUGS` (e.g. `privacy`, shadowed
  by WP4's `/c/<org>/privacy`).

## Ranking

`scoreResult(input, ctx)` in `src/lib/ranking.ts` is a weighted sum of five signals in 0..1
(`RANK_WEIGHTS`, also rendered on `/legal/ranking`, so the page can't drift from the code):

| Signal | Weight | Normalisation |
| --- | --- | --- |
| soonest slot for the searched treatment | 30% | 1 within a day, 0.5 at ~3 days, 0 without a slot |
| Bayesian rating `(C·m + Σ) / (C + n)`, C = 5, m = platform mean | 30% | `(score − 1) / 4` |
| location (city match, or distance 2–30 km) | 15% | 1 / linear / 0 |
| reliability `1 − staff-cancellation rate (180 days)` | 15% | rate per practitioner; below 10 appointments (none included) the rate over all of the practice's appointments |
| profile completeness (6 items) | 10% | share of items |

- **Ties** rotate daily: ordered by an FNV-1a hash of `(Rome calendar day, practitioner id)`.
- **Urgent** searches sort by the soonest slot first; the score breaks ties.
- **Never paid**: ranking reads only `RankInput`. No plan, subscription, fee or billing field
  exists in it, and a test proves extra fields change nothing.
- **Reasons** (`RankReason[]`, keys in `marketplace.rank.*`): the top three contributing factors,
  plus the filters matched (language, fund). Shown under "Why am I seeing this?" on each card.
- `buildRankInputs(orgId, now?)` gives WP2 the practice's own inputs (real ratings, reliability,
  completeness and the soonest check-up slot over 14 days).
- Ranking metrics computed from practice data (cancellation counts, completeness) are aggregate
  counts used for **Sorriso's own purpose** (critique 5): list them as Sorriso-controller
  processing in `roles.ts` / the DPA (WP5).

## Search

`/[locale]/search` query parameters (all optional; anything malformed is ignored):
`city`, `category`, `q`, `lang` (ISO 639-1, `spokenLanguages`), `fund` (a `funds.slug`; also
restricts to the treatments the fund covers), `maxPrice` (euros), `priceType`
(`fixed|from|quote`), `access` (repeat or comma-separate: `stepFree, lift, accessibleWc,
disabledParking, hearingLoop, wheelchairTransferChair`: all must hold at one office), `children`
(care option or a paediatric treatment), `anxiety`, `sedation`, `urgent`. Filtered pages are
`noindex`. Result links go to `/{locale}/book/<org>?practitioner&service[&location&start]`: no
`?via=marketplace` (the server decides the context; Sorriso-hosted pages are marketplace).

`SearchResult` is now slim public data (no `settings`, tokens or user ids reach the browser) and
carries `today` and `rank`. `PractitionerCard` and `SearchForm` are client components (they need
the `marketplace` namespace in a `<ClientMessages>`, as the home page already does). The card takes
an optional `headingLevel` (2 by default; the home page could pass 3).

**Profile statistics** (`profile_stats`): `recordProfileStats("searchImpressions" | "views", ids,
headers)` from the search and practitioner pages. Server-side daily counters, no cookie or
identifier; bots, link previewers, headless browsers, scripts and router prefetches are skipped.

## Practice and practitioner pages

- `lang` attributes on practice-written text (description, service names, bios, directions,
  replies) when `contentLocale` differs from the page locale; `*_i18n` translations are used when
  the practice wrote them.
- Medical director line, price labels (`fixed`, `from`, range, `quote`, on request, free),
  "includes", declared health funds (direct billing / reimbursement, "as declared by the
  practice"), accessibility features and directions, the 19% tax-deduction note, the rating
  breakdown with the weighted score and "How we verify reviews" next to every rating.
- **Map**: click-to-load (`MapEmbed`): nothing is requested from openstreetmap.org until the button
  is pressed; then the iframe has `referrerPolicy="no-referrer"` and a sandbox. Directions are an
  OpenStreetMap link with `rel="noreferrer noopener"`. WP6's CSP needs `frame-src
  https://www.openstreetmap.org` for the map to load.
- hreflang alternates on every page (`alternatesFor`). Neutral: no advertising, nothing about
  other practices or platforms.

## Funds

- `funds`: the migration seeds 15 funds and insurers; `scripts/seed/marketplace.ts` adds FISDE,
  Casagit and Allianz for the demo. **Production needs those three (and future additions) in a
  migration or a platform CRUD page** (critique 51).
- `/dashboard/settings/funds` (`catalog.manage`, audited `settings.update`): per fund, direct
  billing or reimbursement, all treatments or a selection, and a note.
- `BookingExtrasSection` (booking form, `catalog` namespace) offers the funds declared for the
  chosen treatment ("I'll pay myself" by default) and posts `fundId`; `booking.ts` keeps it only if
  the practice still lists it for that treatment. It also shows the tax note.

## Catalogue and advertising rules

`ServiceForm`: price type, starting price and optional upper bound, what the price includes, the
suggested recall interval (WP8 uses it to pre-fill the clinician's choice), the **sensitive** flag
(WP3 keeps such names out of messages). Offices get accessibility checkboxes and directions (all
six features are stored explicitly, so "described" is distinguishable from "not described").
Chairs: rename, disable, add (`RoomManager`); room-level accessibility has no column, so the
"chair suitable for wheelchair transfer" feature is per office.

`checkAdvertising(text)` (`src/lib/compliance/advertising.ts`) returns `{ severity, rule, span,
text }[]` over per-language lists (all 8 applied to every text):

- **block** (save refused, words highlighted): superlatives ("il migliore", "the best"),
  discounts and offers ("sconto", "offerta", "-20%"), "free" offers ("gratis", "prima visita
  gratuita"), guaranteed results, before/after pictures ("prima/dopo"), price comparisons.
- **warn** (saved with a warning): suggestive words ("indolore", "rivoluzionario"), "specialist"
  titles, the plain "prima e dopo", "promozione", percentages.

`saveService` (name, description, includes), `savePractitioner` (title, areas of interest, bio),
`saveOrgFunds` (each fund's note) and `saveLocation` (directions) refuse on block (code
`advertising`) and save with a warning on warn; the forms highlight the matches live
(`marketplace/AdCheckedText` for the fund notes and directions). Office and practice names are
not checked (surnames such as "Migliore" would be refused).

## Reviews

### Statuses

| Status | Meaning |
| --- | --- |
| `published` | public (`publishedAt`); counted in ratings |
| `under_review` | held by the health-term check, or reported by the practice |
| `removed` | removed by a moderator (statement of reasons in `removedReason`) |
| `withdrawn` | deleted by the author: text cleared, consent withdrawn |
| `pending` | not used by WP7 |

`getRatings`, `getRatingBreakdown` and `getPublicReviews` count only `published` reviews of
listed practitioners. The deprecated `published` column is still written, never read.

### Writing a review (`/[locale]/a/[token]/review`)

- Requires a completed visit and a valid visit link; one review per visit; rate limited.
- **Consent**: an explicit, unticked checkbox with the exact frozen text
  `consents.review_publication.label` ("…I can delete it at any time from the privacy center"),
  recorded with `recordConsent(review_publication)` (platform consent: `org_id NULL`, Sorriso is
  controller). For a child under 14 the link went to the guardian, who consents
  (`actorRelation` parent/legal_guardian); without a guardian the review is refused.
- **Author**: "Verified patient" by default (translated at display time); first name and initial
  only if chosen, never for minors. The dashboard shows the same label: practices never learn which
  patient wrote a pseudonymous review.
- **Health-term check** (`src/lib/health-terms.ts`): lexicons in 8 languages (complications such
  as "implant failed", infections, conditions, pregnancy, medicines) and patterns for phone
  numbers, emails and links → **hold** (`under_review`, flags stored as rule ids, never the text);
  treatment names and symptoms → **warn** (a reminder while typing). Names of third parties can't
  be detected by patterns (critique 53): moderation and reports cover them. A held comment is
  stored **encrypted** (`encrypt(…, "reviews.comment")`) until a moderator publishes it.
- **Edit / delete** while the visit link is valid (re-checked on edit; a review the practice
  reported stays hidden, and any text not published at once is stored encrypted). After that, the privacy center (WP4) calls `withdrawReview(id, actor)`, which clears
  the text and the reply, closes open reports, withdraws `review_publication` in the ledger and
  audits `review.withdraw`. `listPatientReviews(patientIds)` returns decrypted texts for WP4.
- Service names are never shown on reviews (the queries don't even select them).

### The practice

`actions/reviews.ts` exports exactly `replyToReview` and `reportReview`:

- **Reply**: only under published reviews; a just-in-time warning (professional secrecy), the
  health-term check run on the reply with highlights, neutral templates **in the review's
  language**, and a required confirmation ("no information about the patient's health or
  treatment"); audited `review.reply`. The server runs the flagger again (`replyAsPractice`): a
  reply with health or contact details ("hold" findings) is refused (`health_terms`) and the
  editor disables "Publish" meanwhile; treatment names and symptoms ("warn") pass and their rule
  ids go into the audit metadata (`flags`).
- **Report** (ground + explanation, encrypted): hides the review (`under_review`) until a moderator
  decides; audited `review.report`. It can be filed while a notice from the public is open (two
  reports, decided separately: "keep" on one doesn't publish what the practice's other open
  report hides, and a removed review comes back only through an appeal of the decision that
  removed it, see `decisionApplies`; the decision is still recorded and sent). Within 6 months of a decision **on its own report that kept the
  review**, the practice's next report is its **one appeal** (the review stays published
  meanwhile); after an appeal (by either side) the decision is final. Decisions on notices from the
  public or on the automatic check are not the practice's to appeal: its next report is a fresh one
  (hidden, the author asked, the practice told the outcome). A removal on its own report offers it
  no appeal (the author can appeal it).
- **What the practice sees** (`practiceReviews`): a comment only while the stored text is the public
  one (published, or the published text its own report is hiding); never a held text (also after
  an edit of a once-published review) nor a removed one. Only its own reports and their appeals,
  with their decisions and reasons; nothing about notices from the public or the automatic check.

### Moderation (`/dashboard/platform/reviews`, platform admins)

1. **Ask the author** (`askAuthor`): message `reviewEmails.moderationRequestHidden` (the practice's
   report hides the review) or `moderationRequestVisible` (a notice or an appeal: it stays
   published), chosen from the review's status, through the patient's channel (guardian routing, opt-outs, restriction respected) with a **signed link**
   (`reviewLinkToken`: report id + expiry + HMAC) to `/{locale}/a/<token>/review/respond`, valid
   7 days. It works after the visit link has expired. The author's reply is stored encrypted.
2. **Decide** keep or remove with a **statement of reasons** (≥ 20 characters), sent to the author
   (`decisionKept` / `decisionRemoved`, with the appeal link valid 6 months), to the practice when
   the report or appeal being decided is its own or the author appealed the decision on its report
   (`practice.*`: the staff member who reported, else the practice's address), and to a member of
   the public whose notice it was (`notice.*`). Audited `review.moderate` with the reason
   (encrypted in the audit log). The reason is stored encrypted (`review_reports.decision_reason`,
   and `reviews.removed_reason` on a removal): it often describes the health detail at issue.
3. **Appeal** once per decision (practice: through `reportReview`; author: the signed link,
   against a removal). A **different moderator** must decide it; the outcome is final on Sorriso
   (`finalKept` / `finalRemoved`), with the out-of-court bodies and courts mentioned.
4. **Held reviews** (no report) are decided the same way (`decideHeldReview`); the decision is
   recorded as a report from the automatic check, so the author can appeal it.

Anyone can send a **notice** about a published review (DSA Art. 16) from the "Report" link under
it (`/legal/reviews?report=<id>`): reason, explanation, name, email and the good-faith statement;
rate limited; the review is not hidden; receipt and decision are emailed. The notifier's name and
email are kept inside the encrypted report details.

**Go-live dependency** (critique 59): platform moderators must answer within 7 days.

## Audit actions used

`review.reply`, `review.report`, `review.moderate`, `review.withdraw`, `consent.record` (via
`recordConsent`), `practitioner.profile.approve` (approval, approval withdrawn, opt-out with
`metadata.marketplaceOptOut`, Albo verified/revoked with `metadata.albo`; the closed list has no
dedicated actions for the last two), `settings.update` (funds), `platform.access`
(`requirePlatformAdmin`).

## Data protection notes

- Sorriso is **controller** for: review publication (consent `review_publication`, org_id NULL),
  the moderation of reviews and notices, profile statistics and ranking signals.
- Encrypted free text outside `encryptedText` columns (the schema is frozen): held and removed
  review comments, report details, author replies and the moderators' statements of reasons use
  `encrypt()` with the AADs `reviews.comment`, `review_reports.details`,
  `review_reports.patient_response`, `review_reports.decision_reason` and `reviews.removed_reason`
  (readers: `readComment`, `readReportDetails`, `readAuthorResponse`, `readDecisionReason`,
  `readRemovedReason` in `src/lib/reviews.ts`). `decrypt()` passes plaintext through, so readers
  can always call it. **WP5's exports** (`csv/reviews.csv`, `review_reports`) should decrypt those
  five columns; `scripts/encrypt-existing.ts` key rotation should include them.
- Retention to define (WP5): `review_reports` (suggested: 6 months after the final decision, the
  appeal window), removed reviews' text (same), `profile_stats` (24 months).
- No third-party requests on page load (map click-to-load, OSM links only); no cookies.

## Demo data (`scripts/seed/marketplace.ts`)

Funds (+ FISDE, Casagit, Allianz) and each practice's declared funds; profiles with spoken
languages, care options and Albo registrations (some verified, some waiting); one practitioner
pending approval (Elena Greco, Roma) and one who opted out (Rosa Esposito, Napoli); price types;
office accessibility and directions; two reviews held by the health-term check, one reported by
the practice and one notice from the public (flagship practice); two weeks of profile statistics.

## Requests to other packages

- **WP6** `team/[id]` (**integration blocker**): render `<PractitionerForm>` also for the linked
  practitioner (see above); CSP `frame-src https://www.openstreetmap.org`.
- **WP6** `src/lib/security.test.ts` and the lead's `actions/_shared.test.ts` (**merge blocker**:
  typecheck and 4 tests fail until then): `setReviewPublished` no longer exists (acceptance: only
  `replyToReview` and `reportReview`); use `reportReview(id, "defamation", "details…")` instead.
- **WP1** `BookingFlow` (`time.practitionerOption`) and `a/[token]/page.tsx`, **WP6**
  `team/page.tsx` and `team/[id]/page.tsx`: `practitioner.specialty` may now be empty; fall back to
  `marketplace.profile.defaultSpecialty`.
- **WP1** `sitemap.ts`: also require `profileApprovedAt IS NOT NULL` (use `listedPractitioner()`),
  otherwise it lists practitioners whose page is a 404. `BookingFlow.test.ts`: add `"catalog"` (and
  `"privacy"`) to the test's namespaces, as the booking pages do.
- **WP5**: decrypt the encrypted review columns in exports (now five, with
  `review_reports.decision_reason` and `reviews.removed_reason`); retention keys above;
  Sorriso-controller processing in `roles.ts`. **WP6** `scripts/encrypt-existing.ts`: include the
  five columns (with their AADs) in key rotation.
- **Lead**: dedicated audit actions `practitioner.marketplace.opt_out` and
  `practitioner.albo.verify` (currently recorded as `practitioner.profile.approve`); FISDE,
  Casagit, Allianz in the funds data.
