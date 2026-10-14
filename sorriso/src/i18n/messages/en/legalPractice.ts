/**
 * English source for the legalPractice namespace. Owned by WP5 (practice GDPR).
 *
 * Practice-facing legal texts: the Art. 28 data processing agreement (DPA), the terms of service,
 * the sub-processor list, the staff instructions, and the vocabulary of the Art. 30 register
 * (purposes, legal bases, categories, retention). ITALIAN IS AUTHORITATIVE for the legal texts:
 * a lawyer or DPO approves the Italian version first and this file is its translation
 * (docs/i18n.md). All of it is a draft until that review (docs/privacy/*.md list what is pending).
 *
 * Multi-paragraph bodies separate paragraphs with a blank line ("\n\n").
 */
import { p } from "../../plural";

export default {
  /**
   * Instructions to people authorised to process patient data (GDPR Art. 29 and 32(4), Art.
   * 2-quaterdecies Codice privacy), accepted by every member on joining (WP6's invite flow) and
   * whenever LEGAL_VERSIONS.staff_instructions changes (WP5's gate). Italian is authoritative.
   */
  staffInstructions: {
    title: "Instructions for staff handling patient data",
    intro:
      "You are authorised to process patients' personal data, including health data, on behalf of the practice. Follow these instructions in every part of your work.",
    confidentiality:
      "Keep everything you learn about patients confidential, during and after your work with the practice. Never discuss patients where others can hear or see.",
    needToKnow:
      "Open only the patients and appointments you need for your task. Your role decides what you can see; don't ask colleagues for access you don't have.",
    freeText:
      "Don't write health information in fields shared outside the practice, such as messages to patients, calendar entries or notes sent to other providers. Clinical details belong in the clinical record.",
    breaches:
      "Report a lost device, a message sent to the wrong person or any other possible breach to the practice owner immediately: the practice has 72 hours to notify the Garante.",
    personalDevices:
      "Don't copy, export or forward patient data to personal devices, personal email or messaging accounts, or any service the practice hasn't approved.",
    calendarSync:
      "If you sync your schedule to a personal calendar, keep the minimal detail setting: times only, without patient names or treatments.",
    accessLog:
      "Every access to patient data is recorded in an audit log that the practice may review to protect patients. The log is not used to monitor your performance.",
    adTools:
      "Never connect the booking widget or the practice's website to advertising or analytics tools in a way that tells them who booked: whether someone booked a dentist is health information.",
    restricted:
      "Some records are restricted at the patient's request. Open one only when you really need to, and give the reason the system asks for: every access is recorded.",
    accept: "I have read these instructions and will follow them",
    version: "Version {version}",
  },

  common: {
    version: "Version {version}",
    effective: "In effect from {date}",
    italianPrevails: "Translation: in case of discrepancy the Italian version prevails.",
    print: "Print or save as PDF",
    contents: "Contents",
    notConfigured: "Not configured",
    onRequest: "On request",
    platformParty: "{name}, {address} (privacy contact: {email})",
    platformPartyShort: "{name} (privacy contact: {email})",
    backToTop: "Back to top",
  },

  // ---------------------------------------------------------------- register vocabulary

  purposes: {
    booking_practice: {
      activity: "Appointment booking (practice channels)",
      purpose:
        "Booking, changing and cancelling appointments requested through the practice's website, booking widget, its own links, phone, front desk, and the integrations it chooses.",
    },
    booking_marketplace: {
      activity: "Bookings started on Sorriso's search pages",
      purpose: "Forwarding the booking to the chosen practice and managing it, with the patient's explicit consent (Sorriso as independent controller).",
    },
    appointment_management: {
      activity: "Agenda and patient records",
      purpose: "Managing the practice's calendar, chairs and practitioners, the patients' appointment history and the practice's administrative notes.",
    },
    reminders: {
      activity: "Confirmations and reminders",
      purpose:
        "Sending booking confirmations, reminders, changes and cancellations by SMS, email or, when the practice enables it and the patient chooses it, WhatsApp; processing the replies.",
    },
    waitlist: {
      activity: "Waiting list",
      purpose: "Offering slots that become free to patients who asked to be told about earlier appointments.",
    },
    recalls: {
      activity: "Check-up recalls",
      purpose: "Reminding patients of a check-up when their dentist has set an interval for them.",
    },
    feedback_requests: {
      activity: "Feedback invitations",
      purpose: "Inviting patients who consented to leave feedback after a visit.",
    },
    reviews: {
      activity: "Published reviews",
      purpose: "Publishing verified patients' reviews on Sorriso with their consent (Sorriso as independent controller).",
    },
    marketing: {
      activity: "News and offers",
      purpose: "Sending news and offers from the practice to patients who opted in.",
    },
    no_show_tracking: {
      activity: "Missed-appointment history",
      purpose: "Counting the missed appointments of the last 24 months to organise the schedule and offer extra help; never to refuse care.",
    },
    adaptive_reminders: {
      activity: "Adaptive reminders",
      purpose:
        "Estimating from the appointment history when an extra reminder helps (profiling without any effect on access to care; the patient can object).",
    },
    anamnesis: {
      activity: "Pre-visit medical history",
      purpose: "Collecting the medical history questionnaire before the visit, signed with a one-time code, for the clinician.",
    },
    partner_api: {
      activity: "Integrations (partner API)",
      purpose: "Exchanging booking data with software the practice connects, such as its management system or call centre.",
    },
    directory: {
      activity: "Practice and practitioner directory",
      purpose: "Publishing the profiles of practices and of practitioners who approved them.",
    },
    ranking: {
      activity: "Search ranking",
      purpose: "Ordering search results with neutral criteria that are explained to users.",
    },
    privacy_center: {
      activity: "Patient privacy center",
      purpose: "Letting patients find their records across practices, download them and exercise their rights.",
    },
    staff_accounts: {
      activity: "Staff accounts",
      purpose: "Managing the accounts of practice staff and their access rights.",
    },
    security_logs: {
      activity: "Access log and security",
      purpose:
        "Recording who accessed or changed patient data, to protect patients and detect misuse. Staff are informed (art. 4 L. 300/1970); the log is not used to monitor performance.",
    },
    privacy_requests: {
      activity: "Data protection requests",
      purpose: "Receiving and answering requests to exercise data protection rights within the legal deadlines.",
    },
  },

  legalBases: {
    art6_1_a: "Consent (Art. 6(1)(a) GDPR)",
    art6_1_b: "Contract or steps before one (Art. 6(1)(b))",
    art6_1_c: "Legal obligation (Art. 6(1)(c))",
    art6_1_f: "Legitimate interest (Art. 6(1)(f))",
    art9_2_a: "Explicit consent to health data (Art. 9(2)(a))",
    art9_2_f: "Establishing or defending legal claims (Art. 9(2)(f))",
    art9_2_h: "Health care under professional secrecy (Art. 9(2)(h) and 9(3))",
  },

  dataCategories: {
    identity: "identification data (name, date of birth)",
    contact: "contact details (phone, email)",
    appointment: "appointment data (date, time, practice, practitioner)",
    health_inferred: "data that may reveal health (receiving dental care, type of treatment)",
    health: "health data (notes, medical history)",
    minor: "data of minors",
    guardian: "data of parents and guardians",
    message_content: "message content",
    consent_record: "consent records",
    review: "reviews",
    professional: "professional data of practitioners",
    account: "account data",
    technical: "technical data (pseudonymised IP address, browser)",
    aggregated_metrics: "aggregated statistics",
  },

  subjects: {
    patients: "patients",
    guardians: "parents and guardians",
    bookers: "people booking for someone else",
    practitioners: "practitioners",
    staff: "practice staff",
    reviewers: "reviewers",
  },

  transferTools: {
    eu: "No transfer: EU/EEA provider",
    dpf: "EU-US Data Privacy Framework (Art. 45 GDPR)",
    scc: "Standard contractual clauses (Art. 46(2)(c) GDPR)",
    dpf_scc: "EU-US Data Privacy Framework, with standard contractual clauses as a fallback",
  },

  units: {
    months: p({ one: "{count} month", other: "{count} months" }),
    days: p({ one: "{count} day", other: "{count} days" }),
    hours: p({ one: "{count} hour", other: "{count} hours" }),
  },

  retention: {
    patientInactiveMonths:
      "Patient record: {period} after the last visit, then restricted or pseudonymised as the practice chooses (longer where the clinical record must be kept).",
    neverSeenPatientMonths: "Records of people who never had an appointment: {period}.",
    messageBodyMonths: "Message text: {period}.",
    messageMetaMonths: "Message log (recipient, date, status): {period}.",
    reminderDays: "Scheduled reminders: {period} after the appointment.",
    waitlistDays: "Waiting-list requests: {period} after their last useful date; closed ones after 30 days.",
    patientNoteDays: "The patient's booking note and cancellation reason: {period} after the visit.",
    auditMonths: "Access log: {period}.",
    providerMessageDays: "Copies held by the messaging provider: {period}.",
    formSubmissionMonths: "Medical history forms, once copied to the clinical record: {period}.",
    consentMonths: "Consent records of patients no longer on file: {period}.",
    privacyRequestMonths: "Closed requests: {period}.",
    marketingLapse: "Consent to news and offers lapses after 24 months without contact.",
    contract: "For as long as the service is provided, then for the limitation period.",
  },

  register: {
    title: "Record of processing activities",
    intro:
      "Art. 30(1) GDPR. Generated from what Sorriso does for the practice and from its current settings; add the activities you carry out outside Sorriso. Keep it up to date and show it to the Garante on request.",
    controller: "Controller",
    vat: "VAT number",
    address: "Registered office",
    contact: "Privacy contact",
    dpo: "Data protection officer",
    none: "—",
    generated: "Generated on {date}",
    columns: {
      activity: "Processing activity",
      purpose: "Purpose",
      legalBasis: "Legal basis",
      subjects: "Data subjects",
      dataCategories: "Categories of personal data",
      recipients: "Recipients",
      transfers: "Transfers outside the EU",
      retention: "Erasure time limits",
      security: "Security measures",
    },
    recipient: "{name} ({service})",
    processor: "Sorriso, as processor under the DPA",
    transfer: "{name}: {tool}",
    noTransfers: "None",
    security: {
      platform:
        "Field-level encryption of notes and messages; role-based access; tamper-evident access log; automated retention; encrypted backups in the EU; staff instructed and bound to confidentiality.",
      mfaRequired: "Two-step sign-in required for all staff.",
      mfaOptional: "Two-step sign-in available but not required.",
      sessions: p({ one: "Sessions expire after {count} hour.", other: "Sessions expire after {count} hours." }),
      discreet: "Messages never name the treatment.",
      detailed: "Messages may name the treatment (the practice's choice).",
    },
  },

  /** Art. 32 measures implemented in Sorriso (register.ts SECURITY_CONTROLS). */
  controls: {
    encryption: {
      title: "Encryption of sensitive fields",
      body: "Notes, message texts, medical history answers and other free text are encrypted in the database with AES-256-GCM, with keys kept outside the database.",
    },
    transport: {
      title: "Encryption in transit",
      body: "All connections use TLS; browsers are instructed to use HTTPS only and pages carry a strict content security policy.",
    },
    access_control: {
      title: "Role-based access",
      body: "Each staff role sees only what it needs: reception has no access to clinical notes; exports, erasure and settings are reserved to owners and administrators.",
    },
    mfa: {
      title: "Two-step sign-in",
      body: "Staff sign in with a password and an authenticator code; sensitive operations ask for the code again.",
    },
    sessions: {
      title: "Session limits",
      body: "Sessions expire after a period the practice sets and after inactivity; staff can revoke them.",
    },
    audit_log: {
      title: "Tamper-evident access log",
      body: "Every access to and change of patient data is recorded in a hash-chained log that the practice can verify and export; chain heads are kept outside the database.",
    },
    pseudonymous_logs: {
      title: "Logs without personal data",
      body: "Application logs mask phone numbers and email addresses; IP addresses are stored only as keyed hashes.",
    },
    rate_limiting: {
      title: "Abuse protection",
      body: "Sign-in, one-time codes and public booking endpoints are rate-limited.",
    },
    links: {
      title: "Expiring patient links",
      body: "Links in messages carry random tokens, stored only as hashes, that expire after the visit.",
    },
    otp: {
      title: "One-time codes",
      body: "Codes are stored only as hashes, expire after 5 minutes and lock after repeated wrong attempts.",
    },
    discreet_messages: {
      title: "Discreet messages",
      body: "By default SMS, WhatsApp, email subjects and calendar entries never name the treatment, the specialty or notes.",
    },
    retention: {
      title: "Automated retention",
      body: "A daily job deletes, redacts or pseudonymises data when its retention period ends.",
    },
    erasure: {
      title: "Erasure and restriction",
      body: "Practices can export, pseudonymise or restrict a patient in one step; restricted records need a reason for every access.",
    },
    backups: {
      title: "Backups",
      body: "Encrypted point-in-time backups are kept in the EU for a limited period and then overwritten.",
    },
    key_rotation: {
      title: "Key management",
      body: "Encryption keys can be rotated without downtime; old keys only decrypt.",
    },
    no_trackers: {
      title: "No third-party trackers",
      body: "Sorriso's pages load no third-party scripts, fonts, pixels or advertising cookies; this is checked automatically.",
    },
    staff_instructions: {
      title: "Instructed staff",
      body: "Every staff member accepts written data protection instructions before working with patient data; acceptances are recorded.",
    },
    breach_procedure: {
      title: "Breach procedure",
      body: "A documented procedure to assess, contain and notify personal data breaches, with notification to the practice within 24 hours.",
    },
  },

  // ---------------------------------------------------------------- sub-processors

  subprocessors: {
    title: "Sub-processors",
    description: "The providers Sorriso uses to process practices' data, where they process it and how transfers are protected.",
    intro:
      "When a practice uses Sorriso, Sorriso processes patient data on the practice's behalf as its processor (Art. 28 GDPR). Sorriso uses the providers below. Each is bound by a data processing agreement with obligations at least as strict as those in Sorriso's DPA.",
    noticeRule:
      "Sorriso tells practices about any new or replaced sub-processor at least 30 days before the change, by email and in the dashboard. A practice may object within that period; if no solution is found, it may end the contract without penalty before the change applies.",
    transfersNote:
      "A provider whose parent company is in the United States may be compelled to give access to data even when its servers are in the EU. Those transfers rely on the EU-US Data Privacy Framework, with standard contractual clauses as a fallback, and are assessed in a transfer impact assessment.",
    columns: {
      name: "Provider",
      entity: "Legal entity",
      service: "Service",
      data: "Data",
      region: "Where",
      transfer: "Transfer safeguard",
      dpa: "Agreement",
    },
    onlyWhatsapp: "Only for practices that enable WhatsApp, and only for patients who choose it.",
    parent: "Parent company: {parent}",
    viewDpa: "Provider's DPA",
    service: {
      hosting: "Application hosting",
      database: "Database",
      sms: "SMS messages",
      whatsapp: "WhatsApp messages",
      email: "Email delivery",
      backups: "Backups",
    },
    data: {
      all_platform_data: "all data stored in Sorriso",
      contact: "contact details",
      message_content: "message content",
      message_metadata: "message metadata",
      technical: "technical data",
    },
    changelog: "Change log",
    change: {
      initial: "First published list.",
      added: "Added {name}.",
      removed: "Removed {name}.",
      changed: "Changed the details of {name}.",
    },
    announced: "Announced {date}",
  },

  // ---------------------------------------------------------------- DPA

  dpa: {
    title: "Data processing agreement",
    description: "The agreement under Art. 28 GDPR between each practice (controller) and Sorriso (processor).",
    intro:
      "This agreement forms part of the terms of service. It applies whenever Sorriso processes personal data on behalf of a practice. The practice accepts it in the dashboard; acceptance is recorded with its version, date and language.",
    parties: {
      title: "1. Parties and roles",
      body: "Controller: the practice that uses Sorriso. Processor: {platform}.\n\nThe Controller decides why and how patient data is processed for the bookings it receives through its own channels: its website and booking widget, its own links, phone and front desk, and the integrations it connects. Sorriso processes that data only as the Controller's processor.",
    },
    subject: {
      title: "2. Subject matter, duration, nature and purpose",
      body: "Subject matter: the online booking, reminder, waiting-list, recall and patient-management service described in the terms of service.\n\nDuration: for as long as the practice's account exists, then until the data is deleted or returned under section 11.\n\nNature and purpose, types of data and categories of data subjects: as described in Annex I, which is generated from the processing Sorriso actually performs.",
    },
    instructions: {
      title: "3. Documented instructions (Art. 28(3)(a))",
      body: "Sorriso processes personal data only on the Controller's documented instructions: this agreement, the terms of service, the Controller's settings in the dashboard and the operations its staff carry out. This includes transfers to third countries, which take place only as described in Annex III.\n\nThe Controller instructs Sorriso to send feedback invitations to patients who consented to them, and to apply the retention periods set in the dashboard.\n\nIf Sorriso is required by EU or Italian law to process data otherwise, it informs the Controller before processing, unless the law forbids it. Sorriso immediately informs the Controller if, in its opinion, an instruction infringes data protection law.",
    },
    confidentiality: {
      title: "4. Confidentiality (Art. 28(3)(b))",
      body: "Sorriso ensures that the people it authorises to process the data are bound by confidentiality, receive data protection instructions, and access the data only as far as their task requires. Sorriso's staff never access patient records except to provide support the Controller asked for, to keep the service secure, or when required by law; such access is logged.",
    },
    security: {
      title: "5. Security (Art. 28(3)(c) and Art. 32)",
      body: "Sorriso implements the technical and organisational measures in Annex II, taking into account the state of the art, the costs, and the risks to patients, in particular because the data may reveal health information. Sorriso reviews these measures regularly and does not lower the overall level of protection.",
    },
    subprocessors: {
      title: "6. Sub-processors (Art. 28(2) and (4))",
      body: "The Controller gives Sorriso a general authorisation to use the sub-processors listed in Annex III and on the public sub-processor page. Sorriso informs the Controller of any intended addition or replacement at least 30 days in advance, by email and in the dashboard. The Controller may object within that period on reasonable data protection grounds; if no solution is found, the Controller may terminate the affected service without penalty before the change applies.\n\nSorriso imposes on each sub-processor, by contract, the same data protection obligations as in this agreement, and remains fully liable to the Controller for their performance.",
    },
    rights: {
      title: "7. Data subjects' rights (Art. 28(3)(e))",
      body: "Sorriso helps the Controller answer requests to exercise rights under Chapter III GDPR with tools in the dashboard: the requests inbox with its deadlines, export in JSON, CSV and FHIR, rectification, restriction, and erasure by pseudonymisation.\n\nIf a request about the Controller's processing reaches Sorriso, Sorriso forwards it to the Controller within 2 business days and does not answer it on the Controller's behalf, except to tell the requester it was forwarded.",
    },
    assistance: {
      title: "8. Assistance with the Controller's obligations (Art. 28(3)(f))",
      body: "Taking into account the nature of the processing and the information available to it, Sorriso assists the Controller with security (Art. 32), breach notification and communication (Art. 33-34), data protection impact assessments and prior consultation (Art. 35-36). Sorriso makes available its own impact assessment of the platform and its transfer impact assessment.",
    },
    breach: {
      title: "9. Personal data breaches",
      body: "Sorriso notifies the Controller without undue delay and in any case within 24 hours of becoming aware of a personal data breach affecting the Controller's data. The notice describes, as far as known, the nature of the breach, the categories and approximate number of patients and records concerned, the likely consequences, and the measures taken or proposed. Sorriso adds information as it becomes available, so that the Controller can notify the Garante within 72 hours and, where required, inform the patients.",
    },
    audits: {
      title: "10. Information and audits (Art. 28(3)(h))",
      body: "Sorriso makes available to the Controller all information necessary to demonstrate compliance with Art. 28: this agreement, the record of processing, the security measures, certifications or audit reports where available, and the access log in the dashboard. Sorriso allows audits and inspections by the Controller or an auditor it appoints, bound by confidentiality, with at least 30 days' notice, during business hours and without disrupting the service; audits are at the Controller's cost unless they reveal a material breach.",
    },
    deletion: {
      title: "11. Return and deletion at the end (Art. 28(3)(g))",
      body: "The Controller can download all its data at any time, in documented formats (JSON, CSV and FHIR R4), without charge. When the Controller closes its account, online booking stops at once, the data stays available for download for 60 days (a 30-day transition and at least 30 days to retrieve it), and is then deleted from Sorriso's systems. Sorriso issues a certificate of deletion listing what was deleted and when. Encrypted backups are overwritten within their retention period and are not restored except to recover from an incident. Sorriso keeps data longer only where EU or Italian law requires it, and then only for that purpose.",
    },
    transfers: {
      title: "12. Transfers outside the EU",
      body: "Data is hosted in the EU. Some sub-processors belong to groups based in the United States; the transfer safeguards for each are listed in Annex III, and their impact has been assessed. Sorriso does not transfer the Controller's data to any other third country without informing the Controller in advance under section 6.",
    },
    ownPurposes: {
      title: "13. Processing for which Sorriso is controller",
      body: "For some activities Sorriso is an independent controller, not the Controller's processor, and it tells patients so in its own privacy notice: bookings started on Sorriso's search pages (with the patient's explicit consent), published reviews, the directory and search ranking, the patient privacy center, and staff accounts. Sorriso does not use the data it processes for the Controller for any other purpose of its own, and never sells it or uses it for advertising.",
    },
    controller: {
      title: "14. The Controller's obligations",
      body: "The Controller ensures that it has a legal basis for the processing, gives patients its privacy notice (Sorriso generates one from the practice's settings), instructs its staff, and keeps its settings, retention periods and register of processing up to date. The Controller does not connect Sorriso's booking widget or pages to advertising or analytics tools in a way that tells them who booked.",
    },
    liability: {
      title: "15. Liability and duration",
      body: "Each party is liable as set out in Art. 82 GDPR and the terms of service. This agreement lasts as long as Sorriso processes personal data for the Controller. If it conflicts with the terms of service on data protection, this agreement prevails.",
    },
    law: {
      title: "16. Applicable law",
      body: "This agreement is governed by Italian law. Disputes fall under the jurisdiction set out in the terms of service.",
    },
    annex1: {
      title: "Annex I — Description of the processing",
      intro: "The processing Sorriso performs as processor, generated from the platform's register of purposes.",
    },
    annex2: {
      title: "Annex II — Technical and organisational measures",
      intro: "The measures in place today. This list is generated from the controls implemented in the platform.",
    },
    annex3: {
      title: "Annex III — Sub-processors",
      intro: "The current list (version {version}). The public page keeps the change log.",
    },
  },

  // ---------------------------------------------------------------- terms of service

  terms: {
    title: "Terms of service for practices",
    description: "The contract between Sorriso and the dental practices that use it.",
    intro:
      "These terms govern the use of Sorriso by dental practices (\"the practice\") and are concluded with {platform}. The practice accepts them in the dashboard; acceptance is recorded with its version, date and language.",
    service: {
      title: "1. The service",
      body: "Sorriso provides online booking for the practice's website and for Sorriso's search pages, a calendar for practitioners, chairs and offices, confirmations and reminders, a waiting list, recalls, patient records for administration, and tools to meet data protection duties. Sorriso is not a healthcare provider and does not give medical advice.",
    },
    account: {
      title: "2. Accounts and staff",
      body: "The practice designates an owner who manages its account and invites staff with a role. The practice is responsible for its staff's use of the service, keeps sign-in credentials confidential, and enables two-step sign-in. Every staff member must accept the data protection instructions before working with patient data.",
    },
    data: {
      title: "3. Data protection",
      body: "For the data of patients who book through the practice's own channels, the practice is the controller and Sorriso its processor: the data processing agreement applies and forms part of these terms. For bookings started on Sorriso's search pages, reviews, the directory and the privacy center, Sorriso is an independent controller, as explained in its privacy notice.",
    },
    obligations: {
      title: "4. The practice's obligations",
      body: "The practice provides accurate information about its services, prices, practitioners and availability; honours the bookings it accepts; uses patient data only for the purposes of care and administration; and does not use Sorriso to send unsolicited communications.",
    },
    marketplace: {
      title: "5. Search, ranking and reviews",
      body: "Practices appear in Sorriso's search only if listed and with practitioners who approved their profile. Ranking uses neutral criteria published on the ranking page; no payment influences the position. Only patients with a completed visit can review, and practices cannot remove reviews: they can reply and report a review, which Sorriso decides with a statement of reasons and one appeal.",
    },
    availability: {
      title: "6. Availability and support",
      body: "Sorriso uses reasonable care to keep the service available and secure and announces planned maintenance in advance. Support is available by email on business days.",
    },
    fees: {
      title: "7. Fees",
      body: "Fees, if any, are those of the plan the practice chose, shown in the dashboard. Sorriso announces price changes at least 30 days in advance. Exports and switching to another provider are free of charge.",
    },
    ip: {
      title: "8. Intellectual property",
      body: "The practice keeps all rights in its content and data. Sorriso keeps all rights in the software. The practice grants Sorriso the right to display its public profile and content for the purposes of the service.",
    },
    suspension: {
      title: "9. Suspension",
      body: "Sorriso may suspend an account only for a serious breach of these terms, a security risk or a legal obligation, telling the practice the reasons in writing beforehand where possible, and at the latest when the suspension takes effect. The practice can contest the decision through the complaints procedure.",
    },
    exit: {
      title: "10. Termination, switching and data retrieval",
      body: "The practice can close its account at any time from the dashboard, with no notice period. Online booking stops at once; the practice keeps access for a 30-day transition and at least 30 further days to retrieve its data in JSON, CSV and FHIR, free of charge, and Sorriso helps it move to another provider. The data is then deleted and a certificate of deletion is issued. Sorriso can end the contract with two months' notice, or immediately for a serious breach.",
    },
    liability: {
      title: "11. Liability",
      body: "Neither party excludes liability for wilful misconduct or gross negligence, or where the law does not allow it. Otherwise, each party's liability is limited to foreseeable direct damage. Sorriso is not liable for the clinical services of the practice.",
    },
    complaints: {
      title: "12. Complaints and mediation",
      body: "The practice can send complaints to Sorriso through the dashboard or by email; Sorriso answers within 15 working days. Sorriso is willing to use mediation to settle disputes out of court, as provided by Regulation (EU) 2019/1150.",
    },
    changes: {
      title: "13. Changes to these terms",
      body: "Sorriso announces changes at least 30 days in advance by email and in the dashboard, unless a law requires a faster change. If the practice does not agree, it may terminate before the change applies, without charge.",
    },
    law: {
      title: "14. Applicable law and courts",
      body: "These terms are governed by Italian law. The courts of Sorriso's registered office have jurisdiction, without prejudice to mandatory rules.",
    },
  },

  // ---------------------------------------------------------------- dashboard acceptance (labels for the legal page)

  docs: {
    dpa: "Data processing agreement",
    terms: "Terms of service",
    subprocessors: "Sub-processors",
    staff_instructions: "Staff instructions",
  },
} as const;
