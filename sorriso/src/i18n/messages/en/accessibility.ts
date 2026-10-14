/**
 * English source for the accessibility namespace: the accessibility statement required by the
 * European Accessibility Act (/{locale}/legal/accessibility). Owned by WP1 (public site).
 *
 * Like the other legal texts, the Italian version is authoritative; this English text is the
 * source for keys and a translation for readers. Draft: to be reviewed by a lawyer before go-live
 * (see docs/accessibility.md).
 */
export default {
  meta: {
    title: "Accessibility statement",
    description: "How accessible the {app} website and booking service are, their known limitations, and how to report a barrier.",
  },
  title: "Accessibility statement",
  translationNotice: "This is a translation. In case of discrepancy, the <link>Italian version</link> prevails.",
  intro:
    "{provider} wants its website and booking service to be usable by everyone, including people who use a screen reader, a keyboard, screen magnification or voice control.",
  legalBasis:
    "This statement is published under the European Accessibility Act (Directive (EU) 2019/882), transposed in Italy by Legislative Decree 82/2022, and Law 4/2004.",
  scope: {
    title: "What this statement covers",
    body: "The public website {host}: search, practice and practitioner pages, the booking and waitlist forms, the appointment page reached from confirmations and reminders, the privacy center, the legal pages, and the booking widget that practices embed on their own websites.",
  },
  status: {
    title: "Conformance status",
    body: "We design and test against the Web Content Accessibility Guidelines (WCAG) 2.2, level AA. The harmonised European standard the law refers to, EN 301 549 v3.2.1, incorporates WCAG 2.1 level AA. The service is partially conformant with WCAG 2.1 level AA: the parts listed under known limitations don't fully conform yet.",
  },
  features: {
    title: "What we do",
    keyboard: "Everything can be used with a keyboard, with a visible focus indicator and a link to skip to the main content.",
    screenReader:
      "Pages are structured with headings and landmarks. Form fields have labels, and errors and status messages are announced by screen readers.",
    steps: "The booking form moves focus to each new step, keeps what you typed when you go back, and explains each error next to its field.",
    contrast: "Text and form controls meet the WCAG AA contrast ratios, and no information is given by colour alone.",
    motion: "Animations are turned off when your device asks for reduced motion.",
    zoom: "Pages work at 200% zoom and on small screens without scrolling sideways.",
    languages:
      "The site is available in eight languages, and every page declares its language so that screen readers pronounce it correctly.",
    help: "The practice's contact details are shown in the same place in the booking form and on your appointment page.",
  },
  limitations: {
    title: "Known limitations",
    practiceContent:
      "Texts written by practices (treatment descriptions, practitioner biographies) are shown in the language the practice wrote them in, which may differ from the language of the page.",
    dates:
      "Date fields use your browser's own date picker, whose accessibility varies between browsers and screen readers. You can always type the date instead.",
    maps: "Maps on practice pages are a visual aid only: the address is always given as text.",
    widget:
      "When the booking widget is embedded on a practice's own website, the accessibility of the surrounding page is the practice's responsibility.",
    messages: "Reminders by SMS are plain text and can't carry formatting; their links open pages covered by this statement.",
    exports: "Data downloads from the privacy center (JSON, CSV) are machine-readable files, not documents meant for reading.",
    workaround: "If any of these stops you from booking, call the practice: its phone number is on its page and in the booking form.",
  },
  preparation: {
    title: "How this statement was prepared",
    body: "This statement was prepared on {date} by self-assessment: automated checks during development and a manual review with the keyboard and with screen readers (NVDA with Firefox on Windows, VoiceOver with Safari on iOS) before each release. It was last reviewed on {reviewed}.",
  },
  feedback: {
    title: "Feedback and contact",
    body: "If you find a barrier, or need information from this website in another format, write to <mail>{email}</mail>. Tell us the address of the page and what happened. We will reply within 30 days.",
    noEmail:
      "If you find a barrier, or need information from this website in another format, contact us using the details in the <link>privacy notice</link>. Tell us the address of the page and what happened. We will reply within 30 days.",
  },
  enforcement: {
    title: "Enforcement procedure",
    body: "If you are not satisfied with our reply, or receive none within 30 days, you can report it to AgID (Agenzia per l'Italia Digitale), the authority that monitors digital accessibility in Italy, using the form at <link>form.agid.gov.it</link>.",
  },
} as const;
