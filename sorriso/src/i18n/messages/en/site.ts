/**
 * English source for the site namespace: the public shell (header, footer, 404), the home page,
 * the page for practices and the developer documentation. Owned by WP1 (public site).
 *
 * Product copy makes no comparative claims about competitors (D.Lgs. 145/2007). Code, attribute
 * names and API values stay in <code> tags and are never translated.
 */
import { p } from "../../plural";

export default {
  meta: {
    title: "{app}: book your dentist online",
    description:
      "Find a dentist near you, see real availability and book in seconds. Reminders by SMS or email: confirm or reschedule with one tap.",
  },
  header: {
    findDentist: "Find a dentist",
    forPractices: "For practices",
    api: "API",
    login: "Practice login",
    bookNow: "Book now",
  },
  footer: {
    tagline: "Book dentists online with real-time availability. Reminders patients can answer with one word.",
    patients: "Patients",
    findDentist: "Find a dentist",
    emergency: "Dental emergency",
    cleaning: "Teeth cleaning",
    privacyCenter: "Your data (privacy center)",
    practices: "Practices",
    features: "Features",
    createPractice: "Create a practice",
    apiWidget: "Booking API and widget",
    legal: "Legal",
    privacy: "Privacy notice",
    cookies: "Cookies",
    terms: "Terms of service",
    dpa: "Data processing agreement",
    subprocessors: "Sub-processors",
    accessibility: "Accessibility",
    reviewPolicy: "Review policy",
    ranking: "How results are ranked",
    copyright: "© {year} {app}",
    demo: "Demo project: the practices and people shown are fictional.",
  },
  notFound: {
    code: "Error 404",
  },
  home: {
    badge: "Only verified reviews from real visits",
    heroTitle: "The dentist you need, <em>booked in 30 seconds.</em>",
    heroBody:
      "Real-time availability from practices near you. No account, no phone queue. Get a reminder by SMS or email: reply <b>YES</b> to confirm, or move it with one tap.",
    quickLabel: "Popular treatments",
    quick: {
      checkup: "Check-up",
      hygiene: "Cleaning",
      orthodontics: "Aligners and braces",
      pediatric: "Children",
      emergency: "Emergency",
    },
    soonestTitle: "Available soonest",
    soonestBody: "Pick a time and you're done: these times are live.",
    seeAll: "See all dentists",
    how: {
      title: "How it works",
      step: "Step {n}",
      findTitle: "Find real availability",
      findBody: "Compare dentists by treatment, price, verified reviews and the next free time, at every office they work in.",
      bookTitle: "Book without an account",
      bookBody: "Choose a time, add your name and number. You get an instant confirmation with a calendar invite.",
      confirmTitle: "Confirm with a reply",
      confirmBody: "We remind you by SMS or email. Reply YES to confirm or NO to cancel, or reschedule with one tap.",
    },
    citiesTitle: "Dentists by city",
    cityLink: "Dentists in {city}",
    /** listCities counts practices (organisations) with an office in the city. */
    cityCount: p({ one: "{count} practice", other: "{count} practices" }),
    practices: {
      kicker: "For dental practices",
      title: "Fewer no-shows. Every office on one calendar.",
      body: "Multi-office scheduling with chairs, two-way text confirmations, an automatic waitlist that refills cancellations, and an open booking API.",
      features: "See the features",
      demo: "Try the demo dashboard",
      offices: "Several offices, practitioners and chairs, with no double booking across locations",
      rules: "Reminder rules per practice: email 48 hours before, SMS 24 hours before, WhatsApp if you enable it",
      replies: "Patients reply YES or NO, and the calendar updates itself",
      waitlist: "Cancelled times are offered to the waitlist within seconds",
    },
  },
  forClinics: {
    metaTitle: "For dental practices",
    metaDescription:
      "Online booking, a multi-office calendar and reminders patients answer, with privacy built in. Export everything at any time.",
    kicker: "For dental practices",
    title: "Fill your chairs. Stop chasing confirmations.",
    body: "Online booking, a multi-office calendar and reminders patients actually answer, in one place.",
    signup: "Create your practice",
    demo: "Open the demo dashboard",
    featuresTitle: "Features",
    features: {
      offices: {
        title: "Every office, one calendar",
        body: "Practitioners work at different offices on different days. Availability is computed per office, and nobody can be double-booked across locations.",
      },
      chairs: {
        title: "Chairs, buffers and closures",
        body: "Bookings reserve a chair automatically. Clean-up time per treatment, holidays, maintenance and personal time off all block availability.",
      },
      twoWay: {
        title: "Two-way text reminders",
        body: "Reminders ask patients to reply YES or NO, in their own language. Replies confirm or cancel at once; anything else is flagged for the front desk.",
      },
      rules: {
        title: "Reminder rules you control",
        body: "For example: email 48 hours before, SMS 24 hours before, a short SMS 2 hours before. WhatsApp only if you enable it and the patient agrees.",
      },
      waitlist: {
        title: "Cancellations refill themselves",
        body: "When a time frees up it is offered to matching patients on the waitlist within seconds. The first to book gets it, with no phone calls.",
      },
      board: {
        title: "Confirmation board",
        body: "See tomorrow at a glance: confirmed, waiting, and who needs a call, with the reason shown. It only adds help: nobody is refused a booking.",
      },
      reviews: {
        title: "Verified reviews only",
        body: "Only patients with a completed visit can review, and only with their consent. Practices can reply but can't hide reviews.",
      },
      api: {
        title: "Open booking API and widget",
        body: "Embed booking on your website with one script tag, sync with your practice software through the REST API, subscribe to calendar feeds.",
      },
      roles: {
        title: "Roles for your team",
        body: "Owners, admins, front desk and practitioners each see what they need. Every access to a patient record is logged.",
      },
      privacy: {
        title: "Privacy by default",
        body: "Messages and calendar entries don't name the treatment. Patients manage their data and consents in a privacy center, without an account.",
      },
      languages: {
        title: "Eight languages",
        body: "Patients book and receive reminders in Italian, English, German, French, Spanish, Portuguese, Romanian or Polish.",
      },
    },
    flow: {
      title: "How a confirmation works",
      book: "The patient books online (or you book them at the desk) and gets a confirmation with a calendar invite.",
      email: "48 hours before: an email asking them to confirm with one click.",
      text: "24 hours before: an SMS asking them to reply YES to confirm or NO to cancel.",
      reply: "YES turns the appointment green in your calendar. NO cancels it and offers the time to the waitlist.",
      other: "Anything else (\"can I come 30 minutes later?\") lands in your inbox and is flagged on the calendar.",
    },
    sms: {
      sender: "Studio Bianchi",
      reminder:
        "Studio Bianchi: appointment reminder, Wed 15 Oct at 10:30, Via Torino 42, Milano. Reply YES to confirm, NO to cancel. Details: sorriso.example/a/… STOP to opt out",
      reply: "YES",
      thanks: "Thank you! Your appointment on Wed 15 Oct at 10:30 is confirmed. See you soon!",
      caption: "A reminder as the patient receives it: the treatment is never named.",
    },
    noLockIn: "Your data stays yours: export everything at any time, no lock-in.",
    apiDocs: "Read the API docs",
  },
  developers: {
    metaTitle: "Booking API and widget",
    metaDescription:
      "Embed online booking on your practice website, book through the REST API and sync with your practice software.",
    title: "Booking API and widget",
    intro:
      "Everything the {host} website does goes through this API, so your integration can do anything a patient can. JSON over HTTPS, CORS enabled, times in ISO 8601 (UTC).",
    codeSample: "Code sample",
    attribute: "Attribute",
    field: "Field",
    description: "Description",
    widget: {
      title: "1. Embed booking on your website",
      button: "A floating \"Book an appointment\" button that opens the booking form in a dialog:",
      inline: "Or inline, inside an element of your page, here in German and for one practitioner:",
      attributesCaption: "Widget attributes",
      attributes: {
        "data-clinic": "Required. Your practice's address on Sorriso (the slug). Without it the script shows nothing.",
        "data-lang":
          "The language of the form and of the patient's messages. Without it: the language of your page (its lang attribute), then the visitor's browser, then Italian.",
        "data-target":
          "A CSS selector: show the form inside that element instead of a floating button. If no element matches when the script runs, nothing is shown.",
        "data-practitioner": "Open the form for one practitioner (their id).",
        "data-service": "Preselect a treatment (its id).",
        "data-location": "Preselect an office (its id).",
        "data-label": "The text of the floating button. Without it, \"Book an appointment\" in the chosen language.",
        "data-color": "The colour of the floating button, as a CSS colour.",
        "data-events": "Opt in to the sorriso:booked event on your page when a booking is completed.",
        "data-include-id": "With data-events: include the appointment id in the event.",
      },
      languages: "Language values (<code>data-lang</code>, <code>patient.locale</code>):",
      eventsTitle: "Booking events",
      events:
        "With <code>data-events</code>, your page receives a <code>sorriso:booked</code> event when a booking is completed. It carries no personal data, and the appointment id only with <code>data-include-id</code>. Messages are posted only to your page's own origin.",
      eventsWarning:
        "Don't forward this event to advertising or analytics tools (such as Meta or Google tags): it reveals that a visitor booked a dental appointment, which is health data. Under the data processing agreement you may use it only to show your own confirmation.",
      origins:
        "To stop other websites from embedding your booking form, list your website's addresses under Dashboard, Privacy settings, Allowed websites. Elsewhere the widget then shows only a link that opens the booking page in a new tab. The check relies on the address your visitors' browsers send with the frame: the widget asks for it, and if you write your own iframe, don't give it <code>referrerpolicy=\"no-referrer\"</code>.",
    },
    booking: {
      title: "2. Book through the API",
      fieldsCaption: "Booking fields",
      context:
        "Who is responsible for the booking data is decided by the server, never by a field you send: bookings through your API key, your widget or links signed for your practice are yours (Sorriso processes them for you); bookings started on Sorriso's own pages need the patient's consent to Sorriso.",
      errors:
        "Errors have one shape: an <code>error</code> object with a <code>code</code> and a <code>message</code>. A taken time returns 409 with <code>practitioner_busy</code>, <code>no_room</code>, <code>time_off</code>, <code>outside_hours</code> or <code>too_soon</code>; invalid fields return 422 with an <code>issues</code> list, a failed privacy or age rule 422 with its own code and <code>field</code>.",
    },
    fields: {
      locale:
        "The language of the patient's messages: <code>it</code>, <code>en</code>, <code>de</code>, <code>fr</code>, <code>es</code>, <code>pt</code>, <code>ro</code> or <code>pl</code>.",
      phoneCountry:
        "The country calling code of a number typed without a prefix, such as <code>39</code> or <code>49</code>. Numbers starting with + or 00 keep their own.",
      preferredChannel:
        "<code>sms</code>, <code>email</code> or <code>whatsapp</code>. WhatsApp only if the practice enabled it, and with <code>privacy.whatsapp</code> set to true.",
      privacy:
        "Required without an API key. <code>noticeVersion</code> (the privacy notice version shown), <code>locale</code>, and the patient's choices: <code>platformConsent</code>, <code>whatsapp</code>, <code>feedback</code>, <code>marketing</code>. Boxes the patient didn't tick are false.",
      relation:
        "Who the appointment is for: <code>bookedFor</code> is <code>self</code>, <code>minor</code> (with <code>guardian</code>: name, relation, phone or email) or <code>other_adult</code>.",
      practiceRef: "The practice marker from a link your practice published (?ref=). Without it the booking counts as made on Sorriso.",
      fundId: "Optional: the health fund or insurer the patient will use. Kept only if the practice lists that fund.",
    },
    sync: {
      title: "3. Sync with your practice software",
      keys: "Create an API key in Dashboard, Settings, API, choose its scopes and send it as a bearer token. Keys can expire and be revoked at any time.",
      scopesTitle: "Scopes",
    },
    scopes: {
      "appointments:read": "Read appointments and the resources they use.",
      "appointments:write": "Create, move and cancel appointments, record confirmations, no-shows and completions.",
      "patients:read": "Read patients' names and contact details.",
      "patients:write": "Create and update patients.",
      "notes:read": "Read the notes patients and staff wrote on appointments. Grant it only to clinical software.",
      "patients:erase": "Ask for a patient's data to be erased (handled as a privacy request).",
    },
    export: {
      title: "4. Export your data",
      body: "A practice can export all of its data at any time in JSON, CSV and FHIR R4. The formats are described in the <link>export schema</link>.",
    },
    reference: "Reference",
    groups: {
      public: "Public booking (used by the website and the widget)",
      patient: "Patient self-service (token from the patient's link)",
      partner: "Partner API (your practice software)",
      infra: "Infrastructure",
    },
    auth: {
      public: "public",
      token: "token",
      apiKey: "API key",
      secret: "secret",
    },
    endpoints: {
      clinic: "Practice profile, offices, practitioners (with treatments and offices) and bookable treatments.",
      availability:
        "Free times per day. Without practitionerId: \"first available\", spread across practitioners. Returns nextAvailable when the window is empty.",
      book: "Book a time. Checked again in a write transaction: two patients can never get the same time.",
      waitlist: "Join the waitlist for a treatment, optionally a practitioner or office, a date range and a part of the day.",
      appointment: "The appointment and what the patient may still do (canCancel, canReschedule).",
      confirm: "Confirm attendance.",
      cancel: "Cancel (the time is offered to the waitlist). Optional body field: reason.",
      reschedule: "Move to another free time. Body fields: start, and optionally practitionerId and locationId.",
      resources: "Offices, chairs, practitioners (with schedules) and treatments, to map ids.",
      list: "List appointments. Use updatedSince for incremental sync.",
      create: "Create an appointment with front-desk powers (custom duration, outside hours, existing patient id).",
      update: "Reschedule, cancel, mark completed or no-show, or record a confirmation by phone.",
      twilio: "Incoming SMS and WhatsApp replies (signed by Twilio). Answers inline with TwiML.",
      twilioStatus: "Delivery receipts (delivered, failed).",
      cron: "Send due reminders. Call every 1 to 5 minutes with Authorization: Bearer $CRON_SECRET.",
      ics: "A practitioner's subscribable calendar feed (Google, Apple, Outlook).",
    },
  },
} as const;
