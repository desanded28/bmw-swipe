import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  appointments,
  consents,
  funds,
  messages,
  noticeVersions,
  orgFunds,
  organizations,
  patients,
  reminders,
  waitlist,
  type Locale,
} from "@/db/schema";
import { LOCALE_MESSAGES } from "@/i18n/messages";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import {
  approveRequest,
  BookingError,
  createAppointment,
  planBookingPrivacy,
  recordBookingChoices,
  upsertPatient,
  type BookingPrivacy,
  type CreateAppointmentInput,
  type NewPatientInput,
} from "./booking";
import { newId } from "./ids";
import { recordConsent } from "./privacy/consent";
import { NOTICE_VERSIONS } from "./privacy/versions";
import { addDays, zonedToUtc } from "./time";
import { joinWaitlist } from "./waitlist";

let p: Awaited<ReturnType<typeof createPractice>>;
/** A second practice with WhatsApp enabled. */
let wa: Awaited<ReturnType<typeof createPractice>>;

// Dr. A works Mon-Fri 09-13 in Milano: hand out a fresh 30-minute slot to every booking.
let slotSeq = 0;
function nextSlot(): Date {
  const n = slotSeq++;
  return zonedToUtc(addDays(MONDAY, Math.floor(n / 8)), 9 * 60 + (n % 8) * 30, TZ);
}
let phoneSeq = 3471000000;
const person = (overrides: Record<string, unknown> = {}) => ({
  firstName: "Giulia",
  lastName: "Bianchi",
  email: `giulia${phoneSeq}@example.com`,
  phone: `+39${phoneSeq++}`,
  locale: "it" as Locale,
  ...overrides,
});
const privacy = (over: Partial<BookingPrivacy["choices"]> = {}, locale: Locale = "de"): BookingPrivacy => ({
  choices: { platformConsent: true, feedback: true, ...over },
  noticeVersion: "2026-10",
  locale,
  source: "booking",
  headers: new Headers({ "x-real-ip": "203.0.113.7" }),
});

function book(practice: typeof p, over: Partial<CreateAppointmentInput> = {}) {
  return createAppointment({
    orgId: practice.orgId,
    serviceId: practice.visit,
    practitionerId: practice.drA,
    locationId: practice.milano,
    startsAt: nextSlot(),
    patient: person(),
    source: "online",
    online: true,
    now: NOW,
    ...over,
  });
}

const consentsOf = (patientId: string) => db.select().from(consents).where(eq(consents.patientId, patientId));
const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (err: unknown) => (err instanceof BookingError ? { code: err.code, reason: err.reason, field: err.field } : err),
  );

beforeAll(async () => {
  p = await createPractice();
  wa = await createPractice();
  await db
    .update(organizations)
    .set({ settings: { ...wa.settings, privacy: { whatsappEnabled: true, marketingEnabled: true } } })
    .where(eq(organizations.id, wa.orgId));
});

describe("processing context and notice", () => {
  it("stores a marketplace booking's context, notice and consents (Art. 9 only on the marketplace)", async () => {
    const d = await book(p, { processingContext: "marketplace", privacy: privacy() });
    expect(d.appointment.processingContext).toBe("marketplace");
    expect(d.appointment.noticeVersion).toBe(NOTICE_VERSIONS.platform_patient);
    expect(d.appointment.noticeLocale).toBe("de");
    expect(d.appointment.bookedFor).toBe("self");
    const rows = await consentsOf(d.patient.id);
    expect(rows.map((r) => r.purpose).sort()).toEqual(["feedback_request", "platform_booking_art9"]);
    const art9 = rows.find((r) => r.purpose === "platform_booking_art9")!;
    // Sorriso's own consent: no practice on the row.
    expect(art9.orgId).toBeNull();
    // The page was German; until WP9 adds the German consent text, the English one is shown and recorded.
    const shown = LOCALE_MESSAGES.de.consents?.platform_booking_art9?.label ? "de" : "en";
    expect(art9).toMatchObject({ granted: true, appointmentId: d.appointment.id, locale: shown, source: "booking", actorRelation: "self" });
    expect(art9.ipHash).toBeTruthy();
    expect(rows.find((r) => r.purpose === "feedback_request")!.orgId).toBe(p.orgId);
  });

  it("never records the platform consent for a practice booking, even when sent", async () => {
    const d = await book(p, { processingContext: "practice", privacy: privacy({ platformConsent: true, feedback: false }) });
    expect(d.appointment.processingContext).toBe("practice");
    expect(d.appointment.noticeVersion).toBe(NOTICE_VERSIONS.practice_patient);
    expect(await consentsOf(d.patient.id)).toEqual([]);
  });

  it("refuses a marketplace booking without the Art. 9 consent and leaves nothing behind", async () => {
    const email = "no-consent@example.com";
    const err = await rejection(
      book(p, { processingContext: "marketplace", privacy: privacy({ platformConsent: false }), patient: person({ email }) }),
    );
    expect(err).toMatchObject({ code: "invalid", reason: "platform_consent_required", field: "platformConsent" });
    expect(await db.select().from(patients).where(eq(patients.email, email))).toEqual([]);
  });

  it("keeps staff bookings working without privacy input (practice, nothing recorded)", async () => {
    const d = await book(p, { online: false, source: "staff" });
    expect(d.appointment.processingContext).toBe("practice");
    expect(d.appointment.noticeVersion).toBeNull();
    expect(d.appointment.noticeLocale).toBeNull();
    expect(await consentsOf(d.patient.id)).toEqual([]);
  });
});

describe("patient record", () => {
  it("normalises numbers with the form's dial code and derives the opt-ins from the contacts given", async () => {
    const d = await book(p, {
      privacy: privacy(),
      processingContext: "practice",
      patient: { firstName: "Lena", lastName: "Weber", phone: "0151 2345 6789", phoneCountry: "49", smsOptIn: false, emailOptIn: true },
    });
    expect(d.patient.phone).toBe("+4915123456789");
    // Client flags are ignored on patient-facing bookings: SMS on (a phone was given), email off (none given).
    expect(d.patient.smsOptIn).toBe(true);
    expect(d.patient.emailOptIn).toBe(false);
  });

  it("keeps the default dial code without one", async () => {
    const d = await book(p, { patient: { firstName: "Ugo", lastName: "Neri", phone: "333 765 4321" } });
    expect(d.patient.phone).toBe("+393337654321");
  });
});

describe("WhatsApp", () => {
  it("is refused where the practice doesn't offer it, and needs its confirmation where it does", async () => {
    const off = await rejection(book(p, { privacy: privacy(), processingContext: "practice", patient: person({ preferredChannel: "whatsapp" }) }));
    expect(off).toMatchObject({ reason: "whatsapp_unavailable", field: "preferredChannel" });
    const unconfirmed = await rejection(
      book(wa, { privacy: privacy(), processingContext: "practice", patient: person({ preferredChannel: "whatsapp" }) }),
    );
    expect(unconfirmed).toMatchObject({ reason: "whatsapp_consent_required", field: "whatsapp" });
  });

  it("keeps WhatsApp with the patient's confirmation and records it", async () => {
    const d = await book(wa, {
      privacy: privacy({ whatsapp: true, feedback: false }),
      processingContext: "practice",
      patient: person({ preferredChannel: "whatsapp" }),
    });
    expect(d.patient.preferredChannel).toBe("whatsapp");
    expect((await consentsOf(d.patient.id)).map((r) => r.purpose)).toEqual(["whatsapp_channel"]);
  });

  it("downgrades WhatsApp on a patient-facing booking that can't carry the confirmation (partner key)", async () => {
    const d = await book(wa, { source: "api", patient: person({ preferredChannel: "whatsapp" }) });
    expect(d.patient.preferredChannel).toBe("sms");
    expect(await consentsOf(d.patient.id)).toEqual([]);
  });
});

describe("health funds", () => {
  let fundA: string;
  let fundB: string;
  let fundOther: string;
  beforeAll(async () => {
    [fundA, fundB, fundOther] = [newId(), newId(), newId()];
    await db.insert(funds).values([
      { id: fundA, slug: `fund-a-${fundA}`, name: "Fondo A" },
      { id: fundB, slug: `fund-b-${fundB}`, name: "Fondo B" },
      { id: fundOther, slug: `fund-o-${fundOther}`, name: "Fondo O" },
    ]);
    await db.insert(orgFunds).values([
      { orgId: p.orgId, fundId: fundA, mode: "direct", serviceIds: null },
      { orgId: p.orgId, fundId: fundB, mode: "indirect", serviceIds: [p.cleaning] },
      { orgId: wa.orgId, fundId: fundOther, mode: "direct", serviceIds: null },
    ]);
  });

  it("stores a fund only when this practice lists it for the service", async () => {
    expect((await book(p, { privacy: privacy(), processingContext: "practice", fundId: fundA })).appointment.fundId).toBe(fundA);
    // Listed, but only for cleanings.
    expect((await book(p, { privacy: privacy(), processingContext: "practice", fundId: fundB })).appointment.fundId).toBeNull();
    // Another practice's fund, and an unknown id.
    expect((await book(p, { privacy: privacy(), processingContext: "practice", fundId: fundOther })).appointment.fundId).toBeNull();
    expect((await book(p, { privacy: privacy(), processingContext: "practice", fundId: "nope" })).appointment.fundId).toBeNull();
  });
});

describe("minors and guardians", () => {
  const child = { firstName: "Luca", lastName: "Verdi", birthDate: "2020-05-01" };

  it("stores a minor's booking with the guardian, minorFlag and consents given by the parent", async () => {
    const d = await book(p, {
      processingContext: "marketplace",
      privacy: privacy(),
      patient: { ...child, phone: "0612345678", phoneCountry: "33" },
      relation: {
        bookedFor: "minor",
        guardian: { name: "Paola Verdi", relation: "parent", phone: "06 98 76 54 32", email: "Paola@Example.com" },
      },
    });
    expect(d.appointment.minorFlag).toBe(true);
    expect(d.appointment.bookedFor).toBe("minor");
    expect(d.patient).toMatchObject({
      phone: "+33612345678",
      guardianName: "Paola Verdi",
      guardianRelation: "parent",
      guardianPhone: "+33698765432",
      guardianEmail: "paola@example.com",
    });
    const rows = await consentsOf(d.patient.id);
    expect(rows.map((r) => r.purpose).sort()).toEqual(["feedback_request", "platform_booking_art9"]);
    expect(rows.every((r) => r.actorRelation === "parent")).toBe(true);
  });

  it("books a child when the form asked no relation (a parent booking for them), recording no consent", async () => {
    // The booking form posts no relation until it asks who the appointment is for (WP4).
    const d = await book(p, { processingContext: "practice", privacy: privacy({ feedback: false }), patient: person(child) });
    expect(d.appointment.minorFlag).toBe(true);
    expect(await consentsOf(d.patient.id)).toEqual([]);
  });

  it("still refuses a consent for a child under 14 when no guardian gave it", async () => {
    const err = await rejection(book(p, { processingContext: "practice", privacy: privacy({ feedback: true }), patient: person(child) }));
    expect(err).toMatchObject({ code: "invalid", reason: "guardian_required", field: "bookedFor" });
  });

  it("refuses a child under 14 booking alone when the form says so", async () => {
    const err = await rejection(
      book(p, { processingContext: "practice", privacy: privacy({ feedback: false }), patient: person(child), relation: { bookedFor: "self" } }),
    );
    expect(err).toMatchObject({ code: "invalid", reason: "guardian_required", field: "bookedFor" });
  });

  it("opts a child's new record in to the guardian's contacts, which the messages go to", async () => {
    // The guardian gave only an email, the child only a phone: the confirmation reaches the guardian.
    const byEmail = await book(p, {
      processingContext: "practice",
      privacy: privacy({ feedback: false }),
      patient: { firstName: "Bea", lastName: "Neri", phone: `+39${phoneSeq++}`, birthDate: "2020-01-01" },
      relation: { bookedFor: "minor", guardian: { name: "Maria Neri", relation: "parent", email: "Maria.Neri@example.com" } },
    });
    expect(byEmail.patient).toMatchObject({ emailOptIn: true, smsOptIn: true });
    const toEmail = await db.select().from(messages).where(eq(messages.appointmentId, byEmail.appointment.id));
    expect(toEmail.map((m) => [m.channel, m.to])).toEqual([["email", "maria.neri@example.com"]]);

    // The guardian gave only a phone, the child only an email (SMS chosen, as the form defaults to).
    const guardianPhone = `+39${phoneSeq++}`;
    const byPhone = await book(p, {
      processingContext: "practice",
      privacy: privacy({ feedback: false }),
      patient: { firstName: "Leo", lastName: "Neri", email: "leo.neri@example.com", birthDate: "2020-01-01", preferredChannel: "sms" },
      relation: { bookedFor: "minor", guardian: { name: "Maria Neri", relation: "parent", phone: guardianPhone } },
    });
    expect(byPhone.patient).toMatchObject({ emailOptIn: true, smsOptIn: true });
    const toPhone = await db.select().from(messages).where(eq(messages.appointmentId, byPhone.appointment.id));
    expect(toPhone.map((m) => [m.channel, m.to])).toEqual([["sms", guardianPhone]]);
  });

  it("maps the consent ledger's guardian_required to BookingError('invalid')", async () => {
    const patient = await db.transaction(async (tx) => (await upsertPatient(tx, p.orgId, person(child), "public")).patient);
    const pv = privacy({ platformConsent: false, feedback: true });
    const plan = planBookingPrivacy({
      context: "practice",
      privacy: pv,
      preferredChannel: "sms",
      org: { whatsappEnabled: false, marketingEnabled: false },
    });
    const err = await rejection(
      db.transaction((tx) => recordBookingChoices(tx, { orgId: p.orgId, patientId: patient.id, plan, privacy: pv, now: NOW })),
    );
    expect(err).toMatchObject({ code: "invalid", reason: "guardian_required" });
    expect(await consentsOf(patient.id)).toEqual([]);
  });

  it("flags adults as not minors", async () => {
    const d = await book(p, { privacy: privacy(), processingContext: "practice", patient: person({ birthDate: "1990-05-05" }) });
    expect(d.appointment.minorFlag).toBe(false);
  });
});

describe("public record matching", () => {
  // A record the practice holds: a child entered by staff with the family's phone and email.
  const stored = { firstName: "Matteo", lastName: "Gallo", phone: `+39${phoneSeq++}`, email: "gallo.family@example.com" };
  let storedId: string;
  beforeAll(async () => {
    storedId = (await db.transaction((tx) => upsertPatient(tx, p.orgId, { ...stored, birthDate: "2019-06-01" }, "staff"))).patient.id;
  });

  it("answers from what the requester typed, never from a stored record", async () => {
    // A minor booking without birth date or guardian: the stored child must not turn the answer
    // into guardian_name_required (which would tell a stranger that this child is a patient here).
    const asMinor = (patient: NewPatientInput) =>
      rejection(book(p, { processingContext: "practice", privacy: privacy({ feedback: false }), patient, relation: { bookedFor: "minor" } }));
    const matched = await asMinor({ firstName: stored.firstName, lastName: "X", phone: stored.phone });
    const unknown = await asMinor({ firstName: "Nessuno", lastName: "X", phone: `+39${phoneSeq++}` });
    expect(matched).toMatchObject({ reason: "birthdate_required" });
    expect(matched).toEqual(unknown);
  });

  it("books and joins the waitlist with a stored child's name and contacts like anyone else", async () => {
    // Marketplace bookings record the Art. 9 consent: against the stored child's record that was guardian_required.
    const d = await book(p, { processingContext: "marketplace", privacy: privacy(), patient: { ...stored } });
    expect(d.patient.id).not.toBe(storedId);
    expect(d.patient.birthDate).toBeNull();
    const w = await joinWaitlist({
      orgId: p.orgId,
      serviceId: p.visit,
      earliestDate: MONDAY,
      latestDate: MONDAY,
      partOfDay: "any",
      patient: { firstName: stored.firstName, lastName: stored.lastName, email: stored.email },
      processingContext: "marketplace",
      privacy: { ...privacy(), source: "waitlist" },
      now: NOW,
    });
    expect(w.patientId).not.toBe(storedId);
  });

  it("reuses a record only with the same birth date", async () => {
    const adult = { firstName: "Elisa", lastName: "Fonti", phone: `+39${phoneSeq++}`, birthDate: "1980-02-02" };
    const first = await book(p, { processingContext: "practice", privacy: privacy({ feedback: false }), patient: adult });
    const same = await book(p, { processingContext: "practice", privacy: privacy({ feedback: false }), patient: adult });
    expect(same.patient.id).toBe(first.patient.id);
    const withoutDob = await book(p, { processingContext: "practice", privacy: privacy({ feedback: false }), patient: { ...adult, birthDate: null } });
    expect(withoutDob.patient.id).not.toBe(first.patient.id);
  });
});

describe("booking for another adult", () => {
  const relation = {
    bookedFor: "other_adult" as const,
    bookedBy: { name: "Marco Gialli", phone: "0170 1234567", email: "Marco@Example.com" },
  };

  it("keeps the booker's contact apart from the patient's and records no consent on the adult's behalf", async () => {
    const d = await book(p, {
      processingContext: "practice",
      privacy: privacy({ feedback: true }),
      patient: { ...person({ firstName: "Anna", birthDate: "1950-01-01" }), phoneCountry: "49" },
      relation,
    });
    expect(d.appointment).toMatchObject({
      bookedFor: "other_adult",
      bookedByName: "Marco Gialli",
      bookedByPhone: "+491701234567",
      bookedByEmail: "marco@example.com",
    });
    expect(d.patient.phone).not.toBe(d.appointment.bookedByPhone);
    expect(d.patient.email).not.toBe(d.appointment.bookedByEmail);
    expect(await consentsOf(d.patient.id)).toEqual([]);
  });

  it("tells the adult booked through the practice's channels, at their own contact (Art. 14)", async () => {
    const q = await createPractice();
    const d = await book(q, { processingContext: "practice", privacy: privacy({ feedback: false }), patient: person({ firstName: "Bruno" }), relation });
    const sent = await db.select().from(messages).where(eq(messages.appointmentId, d.appointment.id));
    const notice = sent.find((m) => m.to === d.patient.phone);
    expect(notice?.body).toContain("Marco Gialli");
    expect(notice?.body).toContain(`/c/`);
    // Nothing goes to the booker's own contacts.
    expect(sent.some((m) => m.to === d.appointment.bookedByPhone || m.to === d.appointment.bookedByEmail)).toBe(false);
  });

  it("is held on the marketplace for the adult's own confirmation: requested, no consent, no reminders, a request to their own contact", async () => {
    const d = await book(p, { processingContext: "marketplace", privacy: privacy({ whatsapp: true, marketing: true }), patient: person({ firstName: "Carla" }), relation });
    expect(d.appointment).toMatchObject({ status: "requested", processingContext: "marketplace", bookedFor: "other_adult", bookedByName: "Marco Gialli" });
    // Nothing the booker ticked is recorded: only the adult can consent.
    expect(await consentsOf(d.patient.id)).toEqual([]);
    // No reminders and no booking receipt while the booking waits for the adult.
    expect(await db.select().from(reminders).where(eq(reminders.appointmentId, d.appointment.id))).toEqual([]);
    const sent = await db.select().from(messages).where(eq(messages.appointmentId, d.appointment.id));
    expect(sent.map((m) => m.to)).toEqual([d.patient.phone]);
    expect(sent[0].body).toContain(`/a/${d.appointment.manageTokenEnc}/privacy/confirm`);

    // The practice can't release it: only the adult's own consent does (confirmAdultBooking).
    expect(await rejection(approveRequest(d.appointment.id, NOW))).toMatchObject({ code: "not_allowed", reason: "awaiting_adult_confirmation" });
    await db.transaction((tx) =>
      recordConsent(tx, {
        orgId: p.orgId,
        patientId: d.patient.id,
        purpose: "platform_booking_art9",
        granted: true,
        locale: "it",
        method: "web_checkbox",
        source: "manage_link",
        actorRelation: "self",
        appointmentId: d.appointment.id,
        now: NOW,
      }),
    );
    expect(await approveRequest(d.appointment.id, NOW)).toBe(true);
  });

  it("refuses a marketplace hold the adult could never confirm: no contact of their own", async () => {
    const shared = `+39${phoneSeq++}`;
    const err = await rejection(
      book(p, {
        processingContext: "marketplace",
        privacy: privacy(),
        patient: person({ firstName: "Dario", email: null, phone: shared }),
        relation: { bookedFor: "other_adult", bookedBy: { name: "Elena Gialli", phone: shared } },
      }),
    );
    expect(err).toMatchObject({ code: "invalid", reason: "other_adult_contact_required", field: "phone" });
    expect(await db.select().from(patients).where(eq(patients.phone, shared))).toEqual([]);
  });

  it("still refuses a marketplace waitlist entry for another adult: the waitlist has no hold", async () => {
    const err = await rejection(
      joinWaitlist({
        orgId: p.orgId,
        serviceId: p.visit,
        earliestDate: MONDAY,
        latestDate: MONDAY,
        partOfDay: "any",
        patient: person({ firstName: "Ettore" }),
        processingContext: "marketplace",
        relation,
        privacy: { ...privacy(), source: "waitlist" },
        now: NOW,
      }),
    );
    expect(err).toMatchObject({ reason: "other_adult_must_book_themselves", field: "bookedFor" });
  });
});

describe("notice versions", () => {
  it("a patient-facing booking records the notices it showed, in the form's language; a staff booking none", async () => {
    const q = await createPractice();
    const shown = (locale: Locale) =>
      db.select().from(noticeVersions).where(and(eq(noticeVersions.orgId, q.orgId), eq(noticeVersions.kind, "practice_patient"), eq(noticeVersions.locale, locale)));
    await book(q, { online: false, source: "staff", privacy: undefined });
    expect(await db.select().from(noticeVersions).where(eq(noticeVersions.orgId, q.orgId))).toEqual([]);
    await book(q, { processingContext: "practice", privacy: privacy({ feedback: false }, "fr") });
    expect(await shown("fr")).toHaveLength(1);
  });
});

describe("joinWaitlist", () => {
  it("stores the context, relation and notice version and records the choices against the entry", async () => {
    const { id, patientId } = await joinWaitlist({
      orgId: p.orgId,
      serviceId: p.visit,
      earliestDate: MONDAY,
      latestDate: MONDAY,
      partOfDay: "any",
      patient: { firstName: "Rita", lastName: "Blu", phone: "0612345678", phoneCountry: "33" },
      processingContext: "marketplace",
      privacy: { ...privacy(), source: "waitlist" },
      now: NOW,
    });
    const [entry] = await db.select().from(waitlist).where(eq(waitlist.id, id));
    expect(entry).toMatchObject({ processingContext: "marketplace", bookedFor: "self", noticeVersion: NOTICE_VERSIONS.platform_patient });
    const [patient] = await db.select().from(patients).where(eq(patients.id, patientId));
    expect(patient.phone).toBe("+33612345678");
    const rows = await consentsOf(patientId);
    expect(rows.map((r) => r.purpose).sort()).toEqual(["feedback_request", "platform_booking_art9"]);
    expect(rows.every((r) => r.waitlistId === id && r.source === "waitlist")).toBe(true);
  });

  it("refuses without the Art. 9 consent on the marketplace", async () => {
    const err = await rejection(
      joinWaitlist({
        orgId: p.orgId,
        serviceId: p.visit,
        earliestDate: MONDAY,
        latestDate: MONDAY,
        partOfDay: "any",
        patient: person(),
        processingContext: "marketplace",
        privacy: { ...privacy({ platformConsent: false }), source: "waitlist" },
        now: NOW,
      }),
    );
    expect(err).toMatchObject({ reason: "platform_consent_required" });
  });
});

it("never leaves an appointment for a refused booking", async () => {
  const before = (await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.orgId, p.orgId))).length;
  await rejection(book(p, { processingContext: "marketplace", privacy: privacy({ platformConsent: false }) }));
  const after = (await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.orgId, p.orgId))).length;
  expect(after).toBe(before);
});
