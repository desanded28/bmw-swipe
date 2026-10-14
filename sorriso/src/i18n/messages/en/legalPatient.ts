/**
 * English source for the legalPatient namespace: the privacy notices built by buildNotice()
 * (src/lib/privacy/notices.ts) for patients (practice and Sorriso), young people, practice staff
 * and practitioners, and the cookie notice. Owned by WP4 (patient GDPR).
 *
 * LEGAL TEXT, ITALIAN AUTHORITATIVE. These are drafts to be reviewed by a DPO or privacy lawyer
 * before go-live (docs/privacy/patient-journey.md). The lawyer writes and approves the Italian
 * version first (it/legalPatient.ts); English and the other locales are translations of it, and
 * every non-Italian page says that the Italian version prevails.
 *
 * Bodies are assembled from whole sentences: one key per sentence or list item, never fragments.
 * Notices are plain text (no markup): the page links URLs and email addresses itself.
 */
export default {
  meta: {
    practiceTitle: "Privacy notice: {practice}",
    practiceDescription: "How {practice} processes the personal data of its patients, and your rights.",
    minorTitle: "Privacy for young people: {practice}",
    minorDescription: "What {practice} does with information about you, in simple words.",
    platformTitle: "Sorriso privacy notice",
    platformDescription: "How Sorriso processes personal data when you search for a dentist, book or write a review, and your rights.",
    staffTitle: "Privacy notice for practice staff",
    staffDescription: "How your data are processed when you use the Sorriso dashboard, and how the access log works.",
    practitionerTitle: "Privacy notice for practitioners",
    practitionerDescription: "How Sorriso processes the data of practitioners listed in its directory.",
    cookiesTitle: "Cookie notice",
    cookiesDescription: "The few technical cookies Sorriso uses, and why there is no cookie banner.",
  },
  page: {
    version: "Version {version}",
    updated: "In force since {date}",
    italianPrevails: "This is a translation. In case of discrepancy the Italian version prevails.",
    italianLink: "Read the Italian version",
    contents: "Contents",
    practiceLink: "Full notice of the practice",
    minorsLink: "Version for young people",
    platformLink: "Sorriso privacy notice",
    cookiesLink: "Cookie notice",
    privacyCenterLink: "Go to the privacy center",
    otherNotices: "Other notices",
    staffLink: "For practice staff",
    practitionerLink: "For practitioners",
    patientLink: "For patients",
    backToTop: "Back to the top",
  },
  sections: {
    summary: "In short",
    controller: "Who is responsible for your data",
    roles: "Sorriso's two roles",
    data: "Which data we process",
    purposes: "Why we process them, and on what legal basis",
    marketplace: "If you booked on Sorriso",
    withdrawal: "If you withdraw your consent",
    recipients: "Who receives your data",
    transfers: "Transfers outside the European Economic Area",
    retention: "How long we keep your data",
    rights: "Your rights",
    complaint: "Complaints",
    mandatory: "Do you have to give us your data?",
    automated: "Automated decisions and profiling",
    minors: "Children and young people",
    monitoring: "The access log",
    profile: "Your public profile",
    cookies: "Cookies",
    changes: "Changes to this notice",
    // Child-friendly notice
    who: "Who looks after your information",
    what: "What information we use",
    why: "Why we use it",
    parents: "Your parents or guardian",
    keep: "How long we keep it",
    youCan: "What you can do",
    help: "If something is wrong",
    full: "The full notice",
    // Cookie notice
    cookieList: "Cookies we use",
    storage: "Storage in your browser",
    thirdParties: "Third parties",
    legalBasis: "Legal basis",
    control: "How to control cookies",
    widget: "The booking widget on practice websites",
  },
  controller: {
    name: "Controller: {name}",
    vat: "VAT number: {vat}",
    address: "Address: {address}",
    contact: "Privacy contact: {email}",
    phone: "Phone: {phone}",
    dpo: "Data protection officer (DPO): {name}, {email}",
    dpoEmail: "Data protection officer (DPO): {email}",
    noDpo: "The practice has not appointed a data protection officer: for any privacy matter write to the contact above.",
    processor:
      "Sorriso provides the booking software as the practice's processor (Art. 28 GDPR): it acts only on the practice's documented instructions and under a data processing agreement.",
    platformDpo: "Sorriso's data protection officer (DPO) can be reached at {email}.",
  },
  /** Legal bases (roles.ts LegalBasis), as noun phrases joined in "Legal basis: {bases}". */
  bases: {
    art6_1_a: "your consent (Art. 6(1)(a) GDPR)",
    art6_1_b: "the service you ask for, or steps you ask for before it (Art. 6(1)(b) GDPR)",
    art6_1_c: "a legal obligation of the controller (Art. 6(1)(c) GDPR)",
    art6_1_f: "the controller's legitimate interests, which you can object to (Art. 6(1)(f) GDPR)",
    art9_2_a: "your explicit consent for data that may concern your health (Art. 9(2)(a) GDPR)",
    art9_2_f: "the establishment, exercise or defence of legal claims (Art. 9(2)(f) GDPR)",
    art9_2_h:
      "health care by professionals bound by professional secrecy (Art. 9(2)(h) and 9(3) GDPR, Art. 2-septies of the Italian Privacy Code)",
  },
  /** One entry per processing purpose (roles.ts PURPOSES), as the people concerned read it. */
  purposes: {
    item: "{title}. {body} Legal basis: {bases}.",
    booking_practice: {
      title: "Booking",
      body: "To receive and record your booking, check availability and confirm the appointment to you.",
    },
    booking_marketplace: {
      title: "Bookings made on Sorriso",
      body: "When you book from Sorriso's search pages: to forward your booking to the practice you chose and to manage reminders and changes. Booking data may reveal information about your health, so Sorriso asks for your explicit consent.",
    },
    appointment_management: {
      title: "Managing your appointments",
      body: "To keep your appointments and your record at the practice, organise the schedule, and let you confirm, move or cancel online.",
    },
    reminders: {
      title: "Confirmations and reminders",
      body: "To send booking confirmations and reminders by SMS, email or, if you choose it, WhatsApp. Messages are discreet: they show no treatment or notes unless the practice has chosen detailed messages and your contact has been verified. You can switch any channel off at any time.",
    },
    waitlist: {
      title: "Waiting list",
      body: "If you join the waiting list: to tell you when an earlier time becomes free.",
    },
    recalls: {
      title: "Check-up recalls",
      body: "To remind you when your dentist has set an interval for your next check-up. Every recall lets you stop them, and you can object at any time.",
    },
    feedback_requests: {
      title: "Feedback invitations",
      body: "Only if you agree: a single invitation to leave feedback after the visit. You can withdraw your consent at any time.",
    },
    reviews: {
      title: "Reviews",
      body: "If you write a review and agree to its publication: to publish it, show that it comes from a real visit, and moderate it. You can delete it at any time from the privacy center.",
    },
    marketing: {
      title: "News and offers",
      body: "Only if you agree: news and offers from the practice. It is never needed to book or to be treated, and your consent lapses after 24 months without contact.",
    },
    no_show_tracking: {
      title: "Missed-appointment history",
      body: "To record the appointments missed in the last 24 months, organise the schedule and offer help such as an extra reminder. It never stops you from booking. You can object at any time.",
    },
    adaptive_reminders: {
      title: "Adaptive reminders",
      body: "To send an extra reminder when, based on your appointment history, an appointment is more likely to be missed. This is profiling (Art. 4(4) GDPR): it only adds help and never limits your booking. You can object at any time and then receive the standard reminders.",
    },
    anamnesis: {
      title: "Medical history form",
      body: "If the practice asks you to fill it in before the visit: to prepare your treatment safely. Your answers are encrypted and seen only by clinicians.",
    },
    partner_api: {
      title: "Connected practice software",
      body: "If the practice connects its own management software to the agenda: to keep the two in step. That software is a recipient chosen by the practice.",
    },
    directory: {
      title: "Directory",
      body: "To show practices and practitioners in Sorriso's search results and on their public pages.",
    },
    ranking: {
      title: "Order of search results",
      body: "To order search results by published criteria: the soonest free time, ratings, reliability, profile completeness and distance. Nobody can pay to rank higher. You can object at any time.",
    },
    privacy_center: {
      title: "Privacy center",
      body: "To find the records that practices on Sorriso hold for a phone number or email address you have verified with a one-time code, so that you can exercise your rights in one place.",
    },
    staff_accounts: {
      title: "Staff accounts",
      body: "To give practice staff personal, secure access to the dashboard: sign-in, two-step verification, sessions and the acceptance of the staff instructions.",
    },
    security_logs: {
      title: "Security and access log",
      body: "To record who opens and changes patient records, protect them against misuse and show patients who accessed their data.",
    },
    privacy_requests: {
      title: "Privacy requests",
      body: "To handle the requests people make about their data, answer them within the legal deadlines and keep proof of it.",
    },
  },
  services: {
    hosting: "hosting of the application",
    database: "database",
    sms: "SMS messages",
    whatsapp: "WhatsApp messages, only for practices that enable them and patients who choose them",
    email: "email",
    backups: "backups",
  },
  transferTools: {
    eu: "no transfer (EU/EEA)",
    dpf: "EU-US Data Privacy Framework (European Commission adequacy decision of 10 July 2023)",
    scc: "standard contractual clauses approved by the European Commission (Art. 46 GDPR)",
    dpf_scc: "EU-US Data Privacy Framework, with the European Commission's standard contractual clauses as a fallback",
  },
  data: {
    intro: "We process:",
    identity: "identification and contact details: name, surname, mobile number, email address, date of birth, and the language and channel you prefer;",
    appointments:
      "appointment details: date, time, treatment, practitioner, office, status and missed appointments. They may reveal information about your health;",
    yourWords: "what you choose to tell us: notes added to a booking, replies to our messages and, if the practice uses it, the medical history form;",
    guardian: "for children: the details of the parent or legal guardian who books and receives the messages;",
    records: "records of your consents and choices, and of the privacy requests you make;",
    technical: "technical data needed for security: keyed hashes (HMAC) of your IP address, never the address itself.",
    source:
      "We receive these data from you, or from the person who booked for you: a parent or guardian, or another adult who booked on your behalf. In that case we also send this notice to your own contact, if we have one (Art. 14 GDPR).",
  },
  platformData: {
    intro: "Sorriso processes, for its own services:",
    booking:
      "when you book from its search pages: your name, contacts, date of birth if given, the practice, treatment, date and time chosen, and the record of your consent;",
    reviews: "when you write a review: the rating, the text, the name shown and the visit it refers to;",
    privacyCenter:
      "when you use the privacy center: a keyed hash of the phone number or email address you verify, the one-time codes sent to it (stored only as hashes) and a session cookie valid for 30 minutes;",
    technical: "for security: keyed hashes (HMAC) of IP addresses and browsers, never the addresses themselves.",
  },
  recipients: {
    intro: "Your data are seen only by those who need them:",
    staff: "the practice's authorised staff (front desk and clinicians), each with the access their role needs;",
    sorriso: "Sorriso, which runs the booking software as the practice's processor;",
    practices: "the practice you book with, which receives your booking and becomes controller of its own copy;",
    providers: "the technical providers listed below (sub-processors), bound by data processing agreements;",
    authorities: "public authorities, only where the law requires it.",
    notSold: "Your data are never sold or used for advertising.",
    provider: "{name} ({entity}): {service}, {region}.",
    providerNoRegion: "{name} ({entity}): {service}.",
    fullList: "The full, current list of sub-processors is at {url}.",
  },
  transfers: {
    intro:
      "Some providers belong to groups based in the United States. Even when their servers are in the EU, this may count as a transfer outside the European Economic Area. These transfers are covered by:",
    item: "{name}: {tool}.",
    assessment: "Sorriso has assessed these transfers (transfer impact assessment). You can ask for a copy of the safeguards by writing to {email}.",
    none: "Your data are not transferred outside the European Economic Area.",
  },
  retention: {
    intro: "We keep data only for as long as they are needed:",
    patientInactiveMonths:
      "your record at the practice: {period} after your last visit, or longer only where the practice must keep clinical documentation by law;",
    neverSeenPatientMonths: "records of people who never came to a visit: {period};",
    patientNoteDays: "notes you add to a booking: {period} after the appointment;",
    messageBodyMonths: "the text of messages: {period}, after which only the date, channel and delivery status remain;",
    messageMetaMonths: "message records (date, channel, delivery status): {period};",
    reminderDays: "reminder schedules: {period} after they are sent;",
    providerMessageDays: "copies kept by the SMS and WhatsApp provider: deleted after {period};",
    waitlistDays: "waiting-list entries: {period} after they close;",
    auditMonths: "the access log: {period};",
    formSubmissionMonths: "medical history forms: {period}, and only once they are in the practice's clinical record;",
    consentMonths: "records of your consents and choices: up to {period}, to be able to prove them;",
    privacyRequestMonths: "privacy requests and their answers: {period} after they are closed;",
    marketingLapse: "consent to news and offers lapses after 24 months without contact.",
    after:
      "At the end of these periods data are deleted or pseudonymised automatically. Pseudonymised appointment records no longer show your name or contacts and are kept only for statistics and the practice's records.",
    platformBookings: "marketplace booking data: for as long as the booking is managed, and no longer than the practice keeps its own copy;",
    platformReviews: "published reviews: until you delete them or they are removed;",
    platformCodes: "one-time codes: deleted {period} after they expire; privacy-center sessions end after 30 minutes;",
  },
  rights: {
    intro: "You have the right to:",
    access: "access your data and receive a copy (Art. 15 GDPR);",
    rectification: "have inaccurate data corrected and incomplete data completed (Art. 16);",
    erasure: "have your data erased when they are no longer needed or you withdraw consent, except what the law requires us to keep (Art. 17);",
    restriction: "restrict processing, for example while a correction is checked (Art. 18);",
    portability: "receive the data you gave us in a structured, machine-readable format, or have them sent to another controller (Art. 20);",
    objection: "object to processing based on legitimate interests, including profiling (Art. 21);",
    withdraw: "withdraw your consent at any time, without affecting the processing carried out before (Art. 7(3));",
    automated: "not be subject to decisions based solely on automated processing (Art. 22).",
    how: "How: online in the privacy center at {url}, where you sign in with a one-time code sent to your phone or email; from the link in your appointment messages; or by writing to {email}.",
    howNoContact:
      "How: online in the privacy center at {url}, where you sign in with a one-time code sent to your phone or email, or from the link in your appointment messages.",
    deadline:
      "We answer within one month. For complex requests this can be extended by two more months, and we tell you why within the first month (Art. 12(3) GDPR). Exercising your rights is free.",
    recipientsInformed: "When we correct or erase your data, or restrict their use, we also tell the recipients we sent them to (Art. 19 GDPR).",
  },
  complaint: {
    body: "If you think your data are processed unlawfully, you can lodge a complaint with the Italian data protection authority, the Garante per la protezione dei dati personali (Piazza Venezia 11, 00187 Roma, www.garanteprivacy.it), or with the authority of the EU country where you live or work (Art. 77 GDPR). You can also go to court (Art. 79 GDPR).",
  },
  mandatory: {
    practice:
      "To book you need to give your name and a mobile number or an email address: without them the practice cannot book or remind you of the appointment. The date of birth is optional, but required when booking for a child. Every consent is optional: saying no never stops you from booking or being treated.",
    platform:
      "Consent to booking through Sorriso is needed only to book from Sorriso's search pages. If you prefer not to give it, you can book directly with the practice, on its own website or by phone.",
  },
  automated: {
    none: "No decision about you is taken solely by automated means (Art. 22 GDPR).",
    profiling:
      "This practice uses adaptive reminders: your appointment history is used to decide whether to send you an extra reminder. This is profiling, but it only adds help and never limits your booking. You can object at any time.",
    platform:
      "Search results are ordered by published criteria, and reviews are checked automatically for health details before publication; a person always decides whether a review is removed. No decision with legal or similarly significant effects is taken solely by automated means.",
  },
  minors: {
    body: "Children under 14 are booked by a parent or legal guardian, who receives the messages and gives any consent (Art. 2-quinquies of the Italian Privacy Code). From 14, young people can book and make these choices themselves. A parent's or guardian's access through the privacy center ends when the child turns 18.",
    link: "A version of this notice written for young people is at {url}.",
  },
  marketplace: {
    body: "If you booked from Sorriso's search pages, Sorriso is also an independent controller for that booking: it forwards it to the practice and manages reminders and changes, with your explicit consent (Art. 9(2)(a) GDPR). Sorriso's notice explains how: {url}.",
    withdraw:
      "If you withdraw that consent, Sorriso stops its own processing, while the practice keeps what it needs to treat you (Art. 9(2)(h) GDPR).",
  },
  withdrawal: {
    platform:
      "If you withdraw your consent to booking through Sorriso, Sorriso stops its own processing of that booking: it no longer keeps it in your marketplace history or sends its own messages and invitations about it. The practice keeps what it needs to treat you, as controller, under Art. 9(2)(h) GDPR, with Sorriso as its processor. Withdrawal does not affect the processing carried out before it.",
  },
  roles: {
    intro: "Sorriso has two roles:",
    controller:
      "independent controller for its own services: bookings started on Sorriso's search pages, the directory of practices and practitioners, published reviews, the order of search results and the privacy center. This notice covers them;",
    processor:
      "processor for the practices (Art. 28 GDPR) for everything that comes through a practice's own channels: its website, booking widget or links, its staff and its software. For those, the practice is the controller and its own notice applies: you find it on the practice's page.",
  },
  changes: {
    body: "We update this notice when our processing changes and keep every earlier version: you can ask for the one in force when you booked. This is version {version}.",
  },
  cookiesLink: {
    body: "Sorriso uses only technical cookies, and no third-party cookies: see the cookie notice at {url}.",
  },
  summary: {
    practice:
      "{practice} uses your details to book and manage your dental appointments, send you confirmations and reminders, and keep your record at the practice. This is needed to provide the care you ask for (Art. 6(1)(b) and 9(2)(h) GDPR). Anything optional, such as feedback invitations or news, needs your separate consent, which you can withdraw at any time.",
    platform:
      "Sorriso helps you find a dental practice and book with it. When you book from Sorriso's search pages, Sorriso forwards your booking to the practice with your consent. When you book through a practice's own website, booking widget or staff, the practice is responsible for your data and Sorriso only runs the software for it.",
    rights:
      "You can see, correct, download or delete your data, restrict or object to their use and withdraw consent at any time: online in the privacy center with a one-time code, or by writing to {email}. You can also complain to the Italian data protection authority (Garante).",
    rightsNoContact:
      "You can see, correct, download or delete your data, restrict or object to their use and withdraw consent at any time, online in the privacy center with a one-time code. You can also complain to the Italian data protection authority (Garante).",
  },
  /** The notice for children and teenagers: short sentences, no legal jargon. */
  minor: {
    summary: "This page explains, in simple words, what {practice} does with information about you when you have a dental appointment.",
    who: "{controller} is responsible for your information. If you have questions, you or your parents can write to {email}.",
    whoNoContact: "{controller} is responsible for your information. If you have questions, you or your parents can ask at the practice.",
    whatIntro: "We use:",
    whatName: "your name and date of birth;",
    whatAppointments: "your appointments: when they are and what they are for;",
    whatContact: "the phone number or email where we send reminders: yours, or your parent's or guardian's;",
    whatMessages: "the messages we send and the replies we get.",
    why: "To book your visits, remind you about them and look after your teeth safely. We never use it for advertising, and we never sell it.",
    parents:
      "If you are under 14, your parent or guardian books for you, gets the reminders and decides about anything optional. From 14 you can book and decide for yourself. When you turn 18, your parents can no longer see your records through the privacy center.",
    keep: "Only as long as needed for your care, and as long as the law says the practice must keep it. After that it is deleted.",
    youCan:
      "You can ask to see your information, to correct it if something is wrong, or to delete it when it is no longer needed. You can do it in the privacy center at {url}, or ask your parent or guardian to help you.",
    help: "If you think your information is not treated properly, you or your parents can complain to the Italian data protection authority (Garante per la protezione dei dati personali, www.garanteprivacy.it).",
    full: "This is a simplified version. The full notice is at {url}.",
  },
  /** Sorriso's notice to practice staff (Art. 13, Art. 4 of Law 300/1970). */
  staff: {
    summary:
      "This notice is for the people who use the Sorriso dashboard in a dental practice: owners, administrators, front desk and practitioners. It explains which data about you are processed, and how the access log works.",
    controllers:
      "Sorriso is the controller of your user account (sign-in, two-step verification, sessions). The practice you work for is the controller of the access log and of everything else you do in its agenda; Sorriso is its processor.",
    dataIntro: "We process:",
    dataAccount: "your name, email address, role and preferred language;",
    dataSecurity:
      "your password (stored only as a hash), your two-step verification secret (encrypted) and recovery codes (hashed);",
    dataSessions: "your sessions and sign-in attempts, with keyed hashes of the IP address and the browser;",
    dataLog: "the access log: which patient records you open or change, when, and with which action;",
    dataLegal: "your acceptance of the staff instructions and of other legal documents.",
    monitoring:
      "The access log is a security measure required for health data (Art. 32 GDPR). It records the date and time, your user, the record and the action, never the content you read. The practice may review it to check that records are opened only for care and administration, and to investigate misuse. Because you are informed of it in this notice and in the staff instructions, information from the log may be used for purposes connected with your employment, within the limits of Art. 4(3) of Law 300/1970 and data protection law.",
    retentionSessions: "sessions: until they expire; sign-in attempts: {period};",
    retentionLog: "the access log: as set by the practice, at least {period};",
    retentionLegal: "acceptances of legal documents: 10 years, the limitation period for proving them;",
    retentionAccount: "your account: until it is closed or you leave the practice.",
    rights:
      "You have the rights of access, rectification, erasure, restriction, portability and objection (Art. 15-21 GDPR). For your account, write to Sorriso at {email}; for the access log, to the practice you work for.",
    rightsNoContact:
      "You have the rights of access, rectification, erasure, restriction, portability and objection (Art. 15-21 GDPR). For your account, write to Sorriso; for the access log, to the practice you work for.",
  },
  /** Sorriso's notice to listed practitioners: profiles, Albo checks, reviews, ranking. */
  practitioner: {
    summary:
      "This notice is for dentists and other practitioners shown in Sorriso's directory. It explains how Sorriso processes your professional data, the checks on your registration and the reviews patients write about you.",
    controllers:
      "Sorriso is the controller of the directory, your public profile, reviews and the order of search results. The practice you work with is the controller of your schedule and of its patients' data; Sorriso is its processor for those.",
    dataIntro: "We process:",
    dataProfile: "your name, title, specialty, biography, spoken languages, the practice and offices where you work and your availability;",
    dataAlbo:
      "your registration with the professional register (Albo degli Odontoiatri or dei Medici Chirurghi), province and number, and the recognised specialisations it lists;",
    dataReviews: "the ratings and reviews patients write about visits with you, your replies and any reports;",
    dataMetrics: "the metrics used to order search results: staff cancellations, profile completeness and views of your profile.",
    profile:
      "Your profile becomes public only after you or the practice approve it, and you can remove yourself from the marketplace at any time. Legally recognised specialisations are shown only after Sorriso has checked them against the public register.",
    reviews:
      "Only patients with a verified visit can review you. You can reply and report a review; every decision on a report comes with a statement of reasons and can be appealed once.",
    retentionProfile: "your profile: until you or the practice remove it from the directory;",
    retentionReviews: "reviews: until the author deletes them or they are removed;",
    retentionMetrics: "ranking metrics: computed on the last 180 days.",
    rights:
      "You have the rights of access, rectification, erasure, restriction, portability and objection (Art. 15-21 GDPR), including the right to object to the ranking. Write to Sorriso at {email}.",
    rightsNoContact:
      "You have the rights of access, rectification, erasure, restriction, portability and objection (Art. 15-21 GDPR), including the right to object to the ranking. Write to Sorriso.",
  },
  /** The cookie notice (Art. 122 Italian Privacy Code, Garante guidelines of 10 June 2021). */
  cookies: {
    summary:
      "Sorriso does not use advertising or tracking cookies, and pages load nothing from other companies' servers while you browse. We use only the few technical cookies the site needs to work. They do not need your consent, which is why there is no cookie banner.",
    item: "{name}: {purpose} Duration: {duration}.",
    staffSession: {
      name: "Staff session ({names})",
      purpose: "keeps practice staff signed in to the dashboard. Set only when staff sign in.",
      duration: "until sign-out, at most 24 hours, and 30 minutes without activity",
    },
    locale: {
      name: "Language ({names})",
      purpose: "remembers the language you picked with the language switcher. Set only when you pick a language.",
      duration: "1 year",
    },
    privacyCenter: {
      name: "Privacy center ({names})",
      purpose: "keeps you signed in to the privacy center after you enter a one-time code.",
      duration: "30 minutes",
    },
    storageIntro: "Apart from these cookies, Sorriso keeps only this in your browser's storage. It never leaves your device and is set only when you use the feature:",
    storageItem: "{key}: {purpose}",
    /** One per BROWSER_STORAGE entry in src/lib/privacy/notices.ts. */
    storageItems: {
      dashboardPrivacyScreen:
        "remembers, on that device, whether practice staff turned on the dashboard's privacy screen, which blurs patient names on the calendar so people at the front desk can't read them. Kept until it is switched off.",
    },
    thirdPartiesIntro:
      "Pages don't load scripts, fonts, images or frames from other companies. Two exceptions happen only when you ask for them:",
    map: "the map on a practice's page appears only after you click to show it. Your browser then loads it from OpenStreetMap (OpenStreetMap Foundation), which receives your IP address under its own privacy policy: https://osmfoundation.org/wiki/Privacy_Policy;",
    links: "links such as directions open other websites, for example Google Maps, in a new tab: those websites apply their own policies.",
    legalBasis:
      "Technical cookies are allowed without consent by Art. 122 of the Italian Privacy Code and by the Garante's guidelines on cookies and other tracking tools of 10 June 2021. This notice tells you about them.",
    control:
      "You can delete cookies in your browser settings at any time. Without the technical cookies, signing in and remembering your language won't work.",
    widget:
      "The booking widget shown on a practice's website sets no cookies of its own. The practice's website may use other cookies: see its own cookie notice.",
  },
} as const;
