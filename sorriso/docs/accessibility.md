# Accessibility

Owner: WP1 (public site). This file is the working record behind the public accessibility statement
(`/{locale}/legal/accessibility`, texts in `src/i18n/messages/en/accessibility.ts`).

| | |
| --- | --- |
| Design and test target | WCAG 2.2 level AA |
| Conformance claimed in the statement | WCAG 2.1 level AA as incorporated by EN 301 549 v3.2.1: **partially conformant** (known limitations below) |
| Legal frame (Italy) | European Accessibility Act (Directive (EU) 2019/882) as transposed by D.Lgs. 82/2022; Law 4/2004; AgID guidelines |
| Pages in scope | search, practice and practitioner pages, booking and waitlist (`/{l}/book/{org}`), the manage page (`/{l}/a/{token}`), the privacy center, legal pages, the embed (`/{l}/embed/{org}`) and `public/widget.js` |

> **Review needed.** The statement text (all languages, Italian authoritative) is a draft written
> by engineering. A lawyer or the DPO must review it before go-live, in particular: the legal basis
> paragraph (D.Lgs. 82/2022 applicability to Sorriso as a service provider, and the role of AgID as
> the monitoring authority for services), the 30-day reply commitment, the escalation wording and
> the "partially conformant" claim. The feedback address comes from `PLATFORM_ACCESSIBILITY_EMAIL`
> (falling back to `PLATFORM_PRIVACY_EMAIL`); set it in production. When the statement is reviewed
> again, update `PREPARED_ON` / `REVIEWED_ON` in `src/app/[locale]/(site)/legal/accessibility/page.tsx`.
>
> **The statement says only what was done.** `accessibility.preparation.body` states that the manual
> keyboard and screen-reader review has not been completed yet, and `features.keyboard` / `features.zoom`
> say "built to" rather than claiming a tested result. Change that wording (all languages) only after
> a release row in [Results](#results) records the manual columns as passed.

## What the code guarantees

| Area | How | Proof |
| --- | --- | --- |
| Skip link | `SkipLink` is the first element of `<body>` on every public page (root `[locale]` layout) and targets `<main id="content" tabIndex={-1}>`, rendered by the `(site)` layout, the embed page and the 404 page | manual check below |
| Landmarks | header `nav` "Main", footer navs "For patients", "For practices", "Legal information"; booking summary is an `aside` labelled by its heading | manual check below |
| Language | `<html lang dir>` from the URL; language names in the switcher carry `lang`/`hreflang` | `route.test.ts`, page metadata |
| Focus | visible `:focus-visible` outline (brand-600) in the base layer; inputs use a brand-600 ring; `scroll-padding-top: 5rem` keeps focused fields clear of the sticky header (2.4.11) | `ui.test.ts` (ratios) |
| Reduced motion | `prefers-reduced-motion: reduce` disables animations and smooth scrolling | `globals.css` |
| Labels and errors | `Field` links label (`htmlFor`), hint and error (`aria-describedby`) and sets `aria-invalid`; hint and error are outside the label | `ui.test.ts` |
| Booking steps | stepper is an `ol` labelled "Booking steps" with `aria-current="step"`; each step change moves focus to the step's `h2` (`tabIndex=-1`); never on first load | `BookingFlow.test.ts` |
| Redundant entry (3.3.7) | the whole form (details, privacy, relation, extras, waitlist) lives in `BookingFlow` memory: back, service change and a taken slot keep it; nothing in web storage | `BookingFlow.test.ts` ("returns to the times with an alert…") |
| Errors | submit errors are a `role="alert"` summary; focus moves to the first `aria-invalid` field (or the summary); API codes map to `errors.api.*` in the page language; `notice_outdated` (the privacy notice changed while the form was open) explains why and offers a "Reload the page" button | `BookingFlow.test.ts` ("API errors") |
| Waitlist | birth date field (`autocomplete="bday"`, shared with the booking form) required for a minor, so `birthdate_required` lands on a visible field; an empty "Until" shows, and sends, the practice's online booking horizon from "From"; the confirmation repeats the range | `BookingFlow.test.ts` ("Waitlist") |
| Slot picker | one `role="group"` per day labelled by its header; buttons have `aria-pressed` and a full `aria-label` (weekday, date, time, practitioner, office when several); one `role="status"` region announces loading, results, empty weeks and range changes; prev/next stay focusable while loading (`aria-disabled`) | `SlotPicker.test.ts` |
| Consistent help (3.2.6) | `ClinicHelp` (practice phone, else email) at the bottom of the booking sidebar and of the manage page | manual check below |
| Stars | `role="img"` with a required, localised `label` (e.g. `t("rating.stars")` from `a11y`); no unlocalised fallback | `ui.test.ts` |
| Widget | dialog is `role="dialog"` + `aria-modal`, labelled; focus goes into the frame on open and back to the button on close; Tab is kept inside with sentinels; Escape closes, also with focus inside the cross-origin frame (the embed posts `{ source, type: "close" }` to the validated parent only; `widget.js` checks origin and source); closing hides the dialog and keeps the frame, so reopening shows what was typed; button/title/close localised for 8 languages | `widget.test.ts`, `BookingFlow.test.ts` ("Escape inside the widget's frame") |
| Embed restriction | with allowed websites set, the frame shows the flow only if `?parent` is listed and the `Referer` vouches for it (the parent itself, or this practice's embed with the same parent); no `Referer` (`referrerpolicy="no-referrer"`) fails closed; a request without `Sec-Fetch-Dest` but with `?parent` gets the same check | `page.test.ts` (embed) |

## Contrast decisions

Ratios are WCAG 2.x relative-luminance contrast. `ui.test.ts` recomputes the form-control ones from
`globals.css`.

| Element | Colours | Ratio | Requirement |
| --- | --- | --- | --- |
| Input, select, textarea boundary (`ring-line-strong`) | `#7c8799` on white | **3.63:1** | 1.4.11 ≥ 3:1 (was slate-200, 1.2:1) |
| Same, on the page background / `bg-slate-50` | `#7c8799` on `#f7f9fb` / `#f8fafc` | 3.45:1 / 3.47:1 | ≥ 3:1 |
| Placeholder text | slate-500 `#64748b` on white | 4.76:1 | 1.4.3 ≥ 4.5:1 (was slate-400, 2.56:1) |
| Focus outline / input focus ring | brand-600 `#0a8172` on white / on ink `#0b1324` | 4.78:1 / 3.88:1 | 1.4.11 ≥ 3:1 |
| Secondary text | slate-500 on white / slate-50 | 4.76:1 / 4.55:1 | ≥ 4.5:1 |
| Small labels in grey panels (stepper, summary) | slate-600/700 on slate-50/100 | ≥ 6.9:1 | ≥ 4.5:1 (slate-500 on slate-100 is only 4.34:1: avoid) |
| Slot caption (11px) | brand-800 `#0f534c` on brand-50 / white on brand-700 | 8.45:1 / 6.74:1 | ≥ 4.5:1, ≥ 11px |
| Dark sections | slate-300 / brand-300 on ink | 12.5:1 / 10.5:1 | ≥ 4.5:1 |

No `text-slate-400` (2.56:1) is used for text on light backgrounds in WP1 files.

## Manual checklist (every release)

Run on a production build with the demo data. Browsers and assistive technology:

- **NVDA** (current) with **Firefox** (current) on Windows;
- **VoiceOver** with **Safari** on iOS (current), including the rotor (headings, form controls, landmarks).

Also once with the keyboard alone (no screen reader) in Chrome or Firefox, zoom at 200% and a 320 px
wide window.

### Search (`/it/search`)
1. Tab from the address bar: the first stop is "Skip to main content"; Enter moves focus to the main content.
2. The header navigation is announced as "Main navigation"; the footer navigations by their names.
3. The language switcher opens with Enter/Space, lists the 8 languages read in their own language, Escape closes it; choosing one keeps the search query (also with JavaScript turned off).
4. Filters and result cards are reachable in order, each with a visible focus ring.

### Booking (`/it/book/<demo>`)
1. The stepper is announced as "Booking steps", the current step as "current step".
2. Choosing a treatment moves focus to "Choose a date and time" and it is read.
3. Week navigation: "Previous days"/"Next days" are announced, stay focusable while loading; the status message ("12 times available from …") is read after each change.
4. Each day is a group named by its header; each time reads like "Wednesday 15 October at 10:30, Dr. Anna Rossi", with "pressed"/"not pressed".
5. "+3 more" reads "Show 3 more times on …"; after activating it, focus lands on the first newly shown time.
6. Days without times read "No free times".
7. Picking a time moves focus to "Your details". Every field reads its label, hint (phone hint with the reply word, note privacy hint) and, after a failed submit, its error and "invalid entry".
8. Submit with empty names: the alert "Please correct the 2 highlighted fields." is read and focus is on "First name".
9. Slot taken (book the same time in a second tab first): the flow returns to the times, the alert "Sorry, someone has just booked that time…" is read, focus is on the times heading, and after picking another time every typed field, the channel, the language and the privacy and relation choices are still there.
10. "Remind me by" is a radio group (arrow keys move between SMS, email and, only when the practice enabled it, WhatsApp).
11. The booking confirmation heading receives focus and is read; "Google Calendar" says it opens a new tab.
12. "Need help? Call … on …" is the last item of the sidebar.

### Waitlist (time step, "Join the waitlist")
1. Opening the form moves focus to its heading; "Cancel" returns focus to "Join the waitlist".
2. Names, contacts and the birth date typed in the details step are already filled in, and vice versa.
3. With "Until" empty, its hint reads "Optional. If you leave it empty, we'll look until …".
4. Choose "A minor" and submit without a birth date: the birth date field reads its error and "invalid entry", and has focus.
5. Errors behave as in booking; success is announced ("You're on the waitlist… We'll look for times from … to …").

### Manage (`/it/a/<token>`)
1. Title and preview are generic ("Your appointment"); the page has `noindex` and `no-referrer`.
2. "Reschedule"/"Cancel appointment" announce expanded/collapsed; opening moves focus to the panel heading.
3. After confirming, cancelling or moving, the success message is read and has focus.
4. "Need help?" sits at the end of the page, in the same words as in the booking sidebar.
5. `/it/a/<unknown>` and `/it/a/<expired>` show only a generic message (no practice, no name).

### Embed and widget
1. On a test page with `<script src=".../widget.js" data-clinic="<demo>" data-lang="de">`, the button reads "Termin buchen"; activating it opens a dialog named "Termin buchen", focus is inside the frame, Tab cycles between the frame and "Schließen". Escape closes, both with focus on "Schließen" and with focus on a field inside the form, and focus returns to the button. Reopening shows what was typed.
2. Inline mode (`data-target`): the frame's title is read; the frame grows with its content; Escape inside it does nothing.
3. With allowed websites set in the practice's privacy settings and the widget on another site, only "Open the booking page in a new tab" is shown. Same for a hand-written `<iframe referrerpolicy="no-referrer" src=".../embed/<demo>?parent=<an allowed site>">` on another site.

### Message language in each locale
For each of `it en de fr es pt ro pl`: open `/{l}/book/<demo>`, reach the details step and check
(1) the "Language for messages" select shows the page language, (2) after booking, the patient row
(dashboard, patient page) has that language, (3) the browser console shows no hydration warning.

## Results

Automated checks run on every change (`npx vitest run` on the files below). Manual results are
recorded per release by the tester.

| Release | Date | Automated (WP1 tests) | Keyboard | NVDA + Firefox | VoiceOver + Safari iOS | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| WP1 branch (pre-merge) | 2026-10-14 | pass | not run | not run | not run | No browser or screen reader in the build environment. Server-rendered output checked: skip link first in `<body>`, `main#content`, stepper, labels, slot labels, metadata. |
| Integrated tree (68af52d + WP1 review fixes) | 2026-10-14 | **fail, then pass** | not run | not run | not run | At 68af52d 15 of 23 `BookingFlow.test.ts` tests failed: the shared `PatientRelationSection` / `PrivacySection` / `BookingExtrasSection` now read the `privacy` and `catalog` namespaces, which the test's server render did not load (the book and embed pages do). The render now loads the pages' namespaces; all WP1 tests pass again. |

**Open acceptance item:** the keyboard and screen-reader checklist on `/it/book/<demo>` and
`/it/a/<token>` (NVDA + Firefox, VoiceOver + Safari iOS) has not been run. It stays open until a
release row above records it as passed; until then the public statement says so (see the note at
the top).

| Locale | Select defaults to page language (`BookingFlow.test.ts`) | Patient row stores it | No hydration warning |
| --- | --- | --- | --- |
| it, en, de, fr, es, pt, ro, pl | pass (server render, also with a different `navigator.language`; failing at 68af52d until the render loaded `privacy`/`catalog`, see above) | after merge (booking route, WP6/WP8) | manual, after merge (not run) |

WP1 tests: `src/components/ui.test.ts`, `src/components/booking/BookingFlow.test.ts`,
`src/components/booking/SlotPicker.test.ts`, `src/app/[locale]/(site)/a/[token]/page.test.ts`,
`src/app/[locale]/embed/[org]/page.test.ts`, `src/app/[locale]/embed/[org]/widget.test.ts`,
`src/app/api/locale/route.test.ts`, `src/app/sitemap.test.ts`, `src/app/a/legacy-redirect.test.ts`,
`src/lib/phone.test.ts`, `src/lib/calendar-links.test.ts`.

## Known limitations (mirrored in the statement)

- Practice-written content (service descriptions, bios) is single-language.
- Native date pickers vary by browser and screen reader; dates can always be typed.
- Maps are a visual aid; the address is always text.
- The host page around an embedded widget is the practice's responsibility.
- SMS are plain text.
- Privacy-center downloads are machine-readable files.
- The language switcher without JavaScript keeps the query through the same-origin `Referer`
  (`/api/locale`); with `Referrer-Policy: no-referrer` pages (the manage page) the query is dropped.
