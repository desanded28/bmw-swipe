import { and, desc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, auditLog, consents, messages, organizations, patients, timeOff } from "@/db/schema";
import { LOCALES, type Locale } from "@/i18n/config";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { cancelAppointment, createAppointment, type NewPatientInput } from "./booking";
import { isContactVerified } from "./contact";
import { newId } from "./ids";
import { KEYWORDS, normalizeReply, parseIntent, handleInboundMessage, type Intent } from "./inbound";
import { deliver } from "./messaging";
import { withdrawConsent } from "./privacy/consent";
import { patientRebook, sendRebookOffers } from "./rebooking";
import { purgeProviderCopies } from "./reminders";
import { addDays, zonedToUtc } from "./time";

/** Everything written to the log during these tests, to check it never carries contacts. */
const logLines: string[] = [];
const capture = (stream: NodeJS.WriteStream) =>
  vi.spyOn(stream, "write").mockImplementation((chunk: string | Uint8Array) => {
    logLines.push(String(chunk));
    return true;
  });
const spies = [capture(process.stdout), capture(process.stderr)];
afterAll(() => spies.forEach((s) => s.mockRestore()));

describe("parseIntent: every language's own words", () => {
  const table: [Locale, string, Intent][] = [
    ["it", "SI", "confirm"],
    ["it", "Sì, grazie!", "confirm"],
    ["it", "Ci sarò", "confirm"],
    ["it", "NO", "cancel"],
    ["it", "non posso venire, scusate", "cancel"],
    ["it", "Posso spostarlo a giovedì?", "reschedule"],
    ["it", "STOP", "stop"],
    ["it", "ISCRIVI", "start"],
    ["it", "START", "start"],
    ["en", "Yes", "confirm"],
    ["en", "I'll be there", "confirm"],
    ["en", "no", "cancel"],
    ["en", "Can't come, sorry", "cancel"],
    ["en", "Can I reschedule?", "reschedule"],
    ["en", "unsubscribe", "stop"],
    ["en", "start", "start"],
    ["de", "Ja", "confirm"],
    ["de", "Ich bestätige", "confirm"],
    ["de", "bestätige", "confirm"],
    ["de", "Nein", "cancel"],
    ["de", "absagen bitte", "cancel"],
    ["de", "Kann ich den Termin verschieben?", "reschedule"],
    ["de", "STOPP", "stop"],
    ["de", "start", "start"],
    ["fr", "Oui", "confirm"],
    ["fr", "d'accord", "confirm"],
    ["fr", "Non", "cancel"],
    ["fr", "annuler", "cancel"],
    ["fr", "Je voudrais reporter", "reschedule"],
    ["fr", "ARRÊT", "stop"],
    ["fr", "start", "start"],
    ["es", "Sí", "confirm"],
    ["es", "si", "confirm"],
    ["es", "vale", "confirm"],
    ["es", "No", "cancel"],
    ["es", "cancelar", "cancel"],
    ["es", "¿Puedo cambiar la cita?", "reschedule"],
    ["es", "BAJA", "stop"],
    ["es", "start", "start"],
    ["pt", "Sim", "confirm"],
    ["pt", "Não", "cancel"],
    ["pt", "nao", "cancel"],
    ["pt", "cancelar", "cancel"],
    ["pt", "Posso remarcar?", "reschedule"],
    ["pt", "PARAR", "stop"],
    ["pt", "start", "start"],
    ["ro", "Da", "confirm"],
    ["ro", "Nu", "cancel"],
    ["ro", "anulez", "cancel"],
    ["ro", "Pot reprograma?", "reschedule"],
    ["ro", "STOP", "stop"],
    ["ro", "start", "start"],
    ["pl", "Tak", "confirm"],
    ["pl", "Nie", "cancel"],
    ["pl", "odwołuję", "cancel"],
    ["pl", "odwoluje", "cancel"],
    ["pl", "Czy mogę przełożyć wizytę?", "reschedule"],
    ["pl", "STOP", "stop"],
    ["pl", "start", "start"],
  ];
  it.each(table)("%s: %s -> %s", (locale, text, intent) => {
    expect(parseIntent(text, locale)).toBe(intent);
  });

  it("covers the confirm and cancel words the texts ask for", () => {
    const asked: Record<Locale, [string, string]> = {
      it: ["SI", "NO"],
      en: ["YES", "NO"],
      de: ["JA", "NEIN"],
      fr: ["OUI", "NON"],
      es: ["SI", "NO"],
      pt: ["SIM", "NAO"],
      ro: ["DA", "NU"],
      pl: ["TAK", "NIE"],
    };
    for (const [locale, [yes, no]] of Object.entries(asked) as [Locale, [string, string]][]) {
      expect(parseIntent(yes, locale), `${locale} ${yes}`).toBe("confirm");
      expect(parseIntent(no, locale), `${locale} ${no}`).toBe("cancel");
      expect(KEYWORDS[locale].stop.length).toBeGreaterThan(0);
    }
  });

  it("accepts the yes word of every language from a patient of any language (SI, YES, JA, OUI, SIM, DA, TAK)", () => {
    for (const locale of LOCALES) {
      for (const yes of ["SI", "Sì", "YES", "JA", "OUI", "SIM", "DA", "TAK"]) {
        expect(parseIntent(yes, locale), `${locale} ${yes}`).toBe("confirm");
        expect(parseIntent(`${yes.toLowerCase()}!`, locale), `${locale} ${yes}!`).toBe("confirm");
      }
    }
  });

  it("keeps the emoji shortcuts", () => {
    expect(parseIntent("👍", "pl")).toBe("confirm");
    expect(parseIntent("ok 👌")).toBe("confirm");
    expect(parseIntent("❌", "de")).toBe("cancel");
  });

  it("resolves the clashes between languages", () => {
    // Italian "non c'è problema" starts with a no but means yes.
    expect(parseIntent("Non c'è problema", "it")).toBe("confirm");
    expect(parseIntent("nie ma problemu", "pl")).toBe("confirm");
    expect(parseIntent("kein Problem", "de")).toBe("confirm");
    // French "non" is a no; Romanian "da" is a yes.
    expect(parseIntent("non", "fr")).toBe("cancel");
    expect(parseIntent("da", "ro")).toBe("confirm");
  });

  it("understands other languages only as a whole-message keyword", () => {
    // An Italian patient answering in another language they speak.
    expect(parseIntent("TAK", "it")).toBe("confirm");
    expect(parseIntent("oui", "it")).toBe("confirm");
    expect(parseIntent("nein", "it")).toBe("cancel");
    expect(parseIntent("da", "it")).toBe("confirm");
    // ...but never inside free text: Romanian "da" is also an Italian preposition.
    expect(parseIntent("da lunedì sono in ferie", "it")).toBe("unknown");
    expect(parseIntent("Devo portare le lastre?", "it")).toBe("unknown");
    expect(parseIntent("tak, ale później", "it")).toBe("unknown");
    // Without a known patient the default language (Italian) goes first.
    expect(parseIntent("non posso venire, scusate")).toBe("cancel");
  });

  it("strips accents only from Latin script", () => {
    expect(normalizeReply("Sì, CONFERMO!")).toBe("si confermo");
    expect(normalizeReply("Odwołuję")).toBe("odwoluje");
    expect(normalizeReply("Да, буду")).toBe("да буду");
    expect(normalizeReply("Й")).toBe("й");
  });
});

// ---------------------------------------------------------------- routing

let A: Awaited<ReturnType<typeof createPractice>>;
let B: Awaited<ReturnType<typeof createPractice>>;
const A_NUMBER = "+390200000001";
let seq = 3459000000;
let slot = 0;
const nextSlot = () => {
  const n = slot++;
  return zonedToUtc(addDays(MONDAY, Math.floor(n / 8)), 9 * 60 + (n % 8) * 30, TZ);
};
const person = (over: Partial<NewPatientInput> = {}): NewPatientInput => ({
  firstName: "Paola",
  lastName: "Verdi",
  email: null,
  phone: `+39${seq++}`,
  locale: "it",
  ...over,
});
const book = (p: typeof A, patient: NewPatientInput) =>
  createAppointment({
    orgId: p.orgId,
    serviceId: p.visit,
    practitionerId: p.drA,
    locationId: p.milano,
    startsAt: nextSlot(),
    patient,
    source: "staff",
    online: false,
    notifyPatient: true,
    now: NOW,
  });
const row = async (id: string) => (await db.select().from(appointments).where(eq(appointments.id, id)))[0];
const patientRow = async (id: string) => (await db.select().from(patients).where(eq(patients.id, id)))[0];
/** An SMS from the practice to this number, as a reminder would leave one. */
const textFrom = (orgId: string, to: string, appointmentId: string) =>
  deliver({ orgId, appointmentId, channel: "sms", to, text: "Promemoria" });

beforeAll(async () => {
  A = await createPractice();
  B = await createPractice();
  await db.update(organizations).set({ inboundNumber: A_NUMBER, name: "Studio Alfa" }).where(eq(organizations.id, A.orgId));
  await db.update(organizations).set({ name: "Studio Beta" }).where(eq(organizations.id, B.orgId));
});
afterEach(() => vi.unstubAllEnvs());

describe("replies stay within one practice", () => {
  it("a reply on practice A's own number never changes practice B's appointment", async () => {
    const phone = `+39${seq++}`;
    const a = await book(A, person({ phone }));
    const b = await book(B, person({ phone }));
    // Practice B texted most recently: on the shared sender the reply would be B's.
    await textFrom(A.orgId, phone, a.appointment.id);
    await textFrom(B.orgId, phone, b.appointment.id);

    const res = await handleInboundMessage({ channel: "sms", from: phone, to: A_NUMBER, body: "NO", replyMode: "return", now: NOW });
    expect(res).toMatchObject({ intent: "cancel", orgId: A.orgId, appointmentId: a.appointment.id });
    expect((await row(a.appointment.id)).status).toBe("cancelled");
    expect((await row(b.appointment.id)).status).toBe("scheduled");
    expect(res.reply).toContain("Studio Alfa");
    expect(res.reply).not.toContain("Studio Beta");
  });

  it("on the shared sender, follows the practice that texted the number last", async () => {
    const phone = `+39${seq++}`;
    const a = await book(A, person({ phone }));
    const b = await book(B, person({ phone }));
    await textFrom(A.orgId, phone, a.appointment.id);
    await textFrom(B.orgId, phone, b.appointment.id);
    const res = await handleInboundMessage({ channel: "sms", from: phone, to: "+15550001111", body: "SI", replyMode: "return", now: NOW });
    expect(res).toMatchObject({ orgId: B.orgId, appointmentId: b.appointment.id, intent: "confirm" });
    expect((await row(b.appointment.id)).confirmation).toBe("confirmed");
    expect((await row(a.appointment.id)).confirmation).toBe("pending");
  });

  it("does nothing when the number belongs to patients of several practices and none texted it", async () => {
    const phone = `+39${seq++}`;
    const a = await book(A, person({ phone }));
    const b = await book(B, person({ phone }));
    await db.delete(messages).where(eq(messages.to, phone));
    const res = await handleInboundMessage({ channel: "sms", from: phone, body: "NO", replyMode: "return", now: NOW });
    expect(res).toMatchObject({ orgId: null, appointmentId: null });
    expect((await row(a.appointment.id)).status).toBe("scheduled");
    expect((await row(b.appointment.id)).status).toBe("scheduled");
  });

  it("answers in the patient's language and stores only the understood intent of a cancellation", async () => {
    const d = await book(A, person({ locale: "pl" }));
    const phone = d.patient.phone!;
    const res = await handleInboundMessage({
      channel: "sms",
      from: phone,
      to: A_NUMBER,
      body: "Nie, mam zapalenie zęba i nie mogę",
      replyMode: "return",
      now: NOW,
    });
    expect(res.intent).toBe("cancel");
    const appt = await row(d.appointment.id);
    expect(appt.status).toBe("cancelled");
    expect(appt.cancelReason).toBe("Cancelled by SMS reply");
    // English is the fallback until the Polish texts exist; never the Italian default.
    expect(res.reply).toMatch(/^Studio Alfa: /);
    expect(res.reply).not.toContain("annullat");
  });

  it("a matched reply verifies the number", async () => {
    const d = await book(A, person());
    expect((await patientRow(d.patient.id)).contactVerifiedAt).toBeNull();
    await handleInboundMessage({ channel: "sms", from: d.patient.phone!, to: A_NUMBER, body: "SI", replyMode: "return", now: NOW });
    const p = await patientRow(d.patient.id);
    expect(p.contactVerifiedAt).not.toBeNull();
    expect(p.verifiedContacts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- the shared sender

const SHARED = "+15550009999";
/** An outbound text as deliver() records it: `from` is the number or Messaging Service it left from. */
const sentText = (orgId: string, to: string, appointmentId: string, from: string | null, minutesBeforeNow: number, channel: "sms" | "whatsapp" = "sms") =>
  db.insert(messages).values({
    id: newId(),
    orgId,
    appointmentId,
    channel,
    direction: "outbound",
    to,
    from,
    body: "Promemoria",
    status: "sent",
    provider: "twilio",
    createdAt: new Date(NOW.getTime() - minutesBeforeNow * 60_000),
  });
const inboundRow = async (phone: string) =>
  (
    await db
      .select()
      .from(messages)
      .where(and(eq(messages.direction, "inbound"), eq(messages.from, phone)))
      .orderBy(desc(messages.createdAt))
  )[0];

describe("the shared sender belongs to no practice", () => {
  it("a practice whose inboundNumber holds the shared sender doesn't receive other practices' replies", async () => {
    vi.stubEnv("TWILIO_FROM", SHARED);
    const H = await createPractice();
    // Stored before saveInboundNumber refused platform senders.
    await db.update(organizations).set({ inboundNumber: SHARED }).where(eq(organizations.id, H.orgId));
    const c = await book(B, person());
    const phone = c.patient.phone!;
    await sentText(B.orgId, phone, c.appointment.id, SHARED, 1);
    const res = await handleInboundMessage({
      channel: "sms",
      from: phone,
      to: SHARED,
      body: "Ho ancora dolore dopo l'estrazione, devo venire?",
      replyMode: "return",
      now: NOW,
    });
    expect(res.orgId).toBe(B.orgId);
    expect((await inboundRow(phone)).orgId).toBe(B.orgId);
    expect(res.reply).toContain("Studio Beta");
    await db.update(organizations).set({ inboundNumber: null }).where(eq(organizations.id, H.orgId));
  });

  it("a number of the shared Messaging Service's pool stays shared, whoever claims it", async () => {
    const service = `MG${"5".repeat(32)}`;
    const pooled = "+15550004444";
    vi.stubEnv("TWILIO_MESSAGING_SERVICE_SID", service);
    const H = await createPractice();
    await db.update(organizations).set({ inboundNumber: pooled }).where(eq(organizations.id, H.orgId));
    const c = await book(B, person());
    const phone = c.patient.phone!;
    await sentText(B.orgId, phone, c.appointment.id, service, 1);
    const res = await handleInboundMessage({ channel: "sms", from: phone, to: pooled, messagingServiceSid: service, body: "SI", replyMode: "return", now: NOW });
    expect(res).toMatchObject({ orgId: B.orgId, appointmentId: c.appointment.id, intent: "confirm" });
    await db.update(organizations).set({ inboundNumber: null }).where(eq(organizations.id, H.orgId));
  });

  it("a reply to the shared sender skips a practice that texted the number from its own", async () => {
    const phone = `+39${seq++}`;
    const a = await book(A, person({ phone }));
    const b = await book(B, person({ phone }));
    // B texted from the shared sender first; A texted later, from its own number.
    await sentText(B.orgId, phone, b.appointment.id, SHARED, 60);
    await sentText(A.orgId, phone, a.appointment.id, A_NUMBER, 1);
    // The patient answers B's text: it reaches the shared sender.
    const res = await handleInboundMessage({ channel: "sms", from: phone, to: SHARED, body: "NO", replyMode: "return", now: NOW });
    expect(res).toMatchObject({ orgId: B.orgId, appointmentId: b.appointment.id, intent: "cancel" });
    expect((await row(b.appointment.id)).status).toBe("cancelled");
    expect((await row(a.appointment.id)).status).toBe("scheduled");
    expect((await inboundRow(phone)).orgId).toBe(B.orgId);
  });

  it("a WhatsApp reply follows the last WhatsApp message, not an SMS", async () => {
    const phone = `+39${seq++}`;
    const a = await book(A, person({ phone }));
    const b = await book(B, person({ phone }));
    await sentText(B.orgId, phone, b.appointment.id, SHARED, 60, "whatsapp");
    await sentText(A.orgId, phone, a.appointment.id, A_NUMBER, 1);
    const res = await handleInboundMessage({
      channel: "whatsapp",
      from: `whatsapp:${phone}`,
      to: `whatsapp:${SHARED}`,
      body: "NO",
      replyMode: "return",
      now: NOW,
    });
    expect(res).toMatchObject({ orgId: B.orgId, appointmentId: b.appointment.id });
    expect((await row(b.appointment.id)).status).toBe("cancelled");
    expect((await row(a.appointment.id)).status).toBe("scheduled");
  });

  it("an SMS that A sent from the shared sender before it had a number of its own is still A's", async () => {
    const phone = `+39${seq++}`;
    const a = await book(A, person({ phone }));
    const b = await book(B, person({ phone }));
    await sentText(B.orgId, phone, b.appointment.id, SHARED, 60);
    await sentText(A.orgId, phone, a.appointment.id, SHARED, 30);
    const res = await handleInboundMessage({ channel: "sms", from: phone, to: SHARED, body: "SI", replyMode: "return", now: NOW });
    expect(res).toMatchObject({ orgId: A.orgId, appointmentId: a.appointment.id, intent: "confirm" });
  });

  it("with no text from the shared sender, a lone practice that texts from its own number is not assumed", async () => {
    const d = await book(A, person());
    const phone = d.patient.phone!;
    await db.delete(messages).where(eq(messages.to, phone));
    const res = await handleInboundMessage({ channel: "sms", from: phone, to: SHARED, body: "NO", replyMode: "return", now: NOW });
    expect(res).toMatchObject({ orgId: null, appointmentId: null });
    expect((await row(d.appointment.id)).status).toBe("scheduled");
  });
});

describe("the automatic answer", () => {
  const SM = (n: number) => `SM${n.toString(16).padStart(32, "0")}`;
  const calls: { url: string; method: string; body: string }[] = [];
  const twilio = (phone: string) => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
    vi.stubEnv("TWILIO_FROM", SHARED);
    vi.stubEnv("MESSAGING_ALLOWLIST", phone);
    calls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ url: String(input), method, body: String(init?.body ?? "") });
        return method === "DELETE" ? new Response(null, { status: 204 }) : new Response(JSON.stringify({ sid: SM(77) }), { status: 201 });
      }),
    );
  };
  afterEach(() => vi.unstubAllGlobals());

  it("goes out through the Messages API from the number the patient wrote to, so its copy can be deleted", async () => {
    const d = await book(A, person());
    const phone = d.patient.phone!;
    twilio(phone);
    const res = await handleInboundMessage({ channel: "sms", from: phone, to: A_NUMBER, body: "SI", providerId: SM(76), replyMode: "return", now: NOW });
    expect(res.intent).toBe("confirm");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json");
    const params = new URLSearchParams(calls[0].body);
    expect(params.get("From")).toBe(A_NUMBER);
    expect(params.get("To")).toBe(phone);
    expect(params.get("Body")).toBe(res.reply);
    const [answer] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.to, phone), eq(messages.direction, "outbound"), eq(messages.providerId, SM(77))));
    expect(answer).toMatchObject({ orgId: A.orgId, status: "sent", provider: "twilio", from: A_NUMBER, body: res.reply });

    // After the retention period the cron deletes Twilio's copies: the answer's and the patient's text.
    await purgeProviderCopies(new Date(Date.now() + 120 * 86_400_000));
    const deleted = calls.filter((c) => c.method === "DELETE").map((c) => c.url);
    expect(deleted).toContain(`https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages/${SM(77)}.json`);
    expect(deleted).toContain(`https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages/${SM(76)}.json`);
    const [after] = await db.select().from(messages).where(eq(messages.id, answer.id));
    expect(after.providerDeletedAt).not.toBeNull();
  });

  it("the webhook answers with an empty TwiML response", async () => {
    vi.stubEnv("DEMO_MODE", "1");
    const { POST } = await import("@/app/api/webhooks/twilio/route");
    const res = await POST(
      new Request("http://localhost:3010/api/webhooks/twilio", {
        method: "POST",
        headers: { host: "localhost:3010" },
        body: new URLSearchParams({ From: "+393330000000", To: A_NUMBER, Body: "SI" }),
      }),
    );
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Response></Response>");
    expect(xml).not.toContain("<Message>");
  });
});

describe("STOP and START", () => {
  const ledger = (patientId: string) =>
    db.select().from(consents).where(and(eq(consents.patientId, patientId), eq(consents.purpose, "sms_channel"))).orderBy(desc(consents.createdAt));

  it("STOP withdraws sms_channel in the consent ledger and turns SMS off; START turns them back on", async () => {
    const d = await book(A, person());
    const phone = d.patient.phone!;
    const stop = await handleInboundMessage({ channel: "sms", from: phone, to: A_NUMBER, body: "STOP", replyMode: "return", now: NOW });
    expect(stop.intent).toBe("stop");
    expect(stop.reply).toBe("Studio Alfa: non riceverai più SMS. Rispondi START per riattivarli.");
    const [withdrawal] = await ledger(d.patient.id);
    expect(withdrawal).toMatchObject({ purpose: "sms_channel", granted: false, source: "sms_reply", method: "sms_reply", orgId: A.orgId });
    expect((await patientRow(d.patient.id)).smsOptIn).toBe(false);

    const start = await handleInboundMessage({ channel: "sms", from: phone, to: A_NUMBER, body: "start", replyMode: "return", now: NOW });
    expect(start.intent).toBe("start");
    const [grant] = await ledger(d.patient.id);
    expect(grant).toMatchObject({ purpose: "sms_channel", granted: true, source: "sms_reply" });
    expect((await patientRow(d.patient.id)).smsOptIn).toBe(true);
  });

  it("STOP on a practice's own number covers only that practice's patients", async () => {
    const phone = `+39${seq++}`;
    const a = await book(A, person({ phone }));
    const b = await book(B, person({ phone }));
    await handleInboundMessage({ channel: "sms", from: phone, to: A_NUMBER, body: "STOP", replyMode: "return", now: NOW });
    expect((await patientRow(a.patient.id)).smsOptIn).toBe(false);
    expect((await patientRow(b.patient.id)).smsOptIn).toBe(true);
    expect(await ledger(b.patient.id)).toHaveLength(0);
  });

  it("STOP to the shared sender covers every practice texting that number", async () => {
    const phone = `+39${seq++}`;
    const a = await book(A, person({ phone }));
    const b = await book(B, person({ phone }));
    await textFrom(B.orgId, phone, b.appointment.id);
    await handleInboundMessage({ channel: "sms", from: phone, to: "+15550001111", body: "Stop", replyMode: "return", now: NOW });
    expect((await patientRow(a.patient.id)).smsOptIn).toBe(false);
    expect((await patientRow(b.patient.id)).smsOptIn).toBe(false);
    expect((await ledger(a.patient.id))[0]).toMatchObject({ granted: false, source: "sms_reply" });
  });

  it("START to the shared sender turns texts back on only at the practice it answers", async () => {
    const C = await createPractice();
    const phone = `+39${seq++}`;
    const b = await book(B, person({ phone }));
    const c = await book(C, person({ phone }));
    // The patient withdrew SMS at practice C, on purpose.
    await withdrawConsent(db, { orgId: C.orgId, patientId: c.patient.id, purpose: "sms_channel", locale: "it", method: "web_checkbox", source: "privacy_center" });
    expect((await patientRow(c.patient.id)).smsOptIn).toBe(false);
    // Practice B texts from the shared sender; the patient answers START to B.
    await sentText(B.orgId, phone, b.appointment.id, SHARED, 1);
    const res = await handleInboundMessage({ channel: "sms", from: phone, to: SHARED, body: "START", replyMode: "return", now: NOW });
    expect(res).toMatchObject({ intent: "start", orgId: B.orgId });
    expect((await ledger(b.patient.id))[0]).toMatchObject({ granted: true, source: "sms_reply", orgId: B.orgId });
    expect((await patientRow(b.patient.id)).smsOptIn).toBe(true);
    // C is another controller: its withdrawal stands.
    expect((await patientRow(c.patient.id)).smsOptIn).toBe(false);
    const cLedger = await ledger(c.patient.id);
    expect(cLedger).toHaveLength(1);
    expect(cLedger[0]).toMatchObject({ granted: false, source: "privacy_center" });
  });
});

describe("the Twilio webhook", () => {
  const post = async (url: string, host: string, form: Record<string, string>) => {
    const { POST } = await import("@/app/api/webhooks/twilio/route");
    return POST(new Request(url, { method: "POST", headers: { host }, body: new URLSearchParams(form) }));
  };
  const form = { From: "+393330000000", To: A_NUMBER, Body: "SI", MessageSid: "SM00000000000000000000000000000001" };

  it("refuses unsigned requests unless in demo mode on localhost", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    vi.stubEnv("DEMO_MODE", "");
    expect((await post("http://localhost:3010/api/webhooks/twilio", "localhost:3010", form)).status).toBe(403);
    vi.stubEnv("DEMO_MODE", "1");
    expect((await post("https://sorriso.test/api/webhooks/twilio", "sorriso.test", form)).status).toBe(403);
    const ok = await post("http://localhost:3010/api/webhooks/twilio", "localhost:3010", form);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain("<Response>");
  });

  it("checks the signature with the token of the region that sends the channel", async () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("TWILIO_REGION", "ie1");
    vi.stubEnv("TWILIO_EDGE", "dublin");
    vi.stubEnv("TWILIO_IE1_AUTH_TOKEN", "ie1-token");
    vi.stubEnv("TWILIO_US1_AUTH_TOKEN", "us1-token");
    const { createHmac } = await import("node:crypto");
    const sign = (token: string, params: Record<string, string>) =>
      createHmac("sha1", token)
        .update(Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], "https://sorriso.test/api/webhooks/twilio"))
        .digest("base64");
    const { POST } = await import("@/app/api/webhooks/twilio/route");
    const send = (params: Record<string, string>, signature: string) =>
      POST(
        new Request("https://sorriso.test/api/webhooks/twilio", {
          method: "POST",
          headers: { "x-twilio-signature": signature },
          body: new URLSearchParams(params),
        }),
      );
    expect((await send(form, sign("us1-token", form))).status).toBe(403);
    expect((await send(form, sign("ie1-token", form))).status).toBe(200);
    const wa = { ...form, From: `whatsapp:${form.From}`, To: `whatsapp:${A_NUMBER}` };
    expect((await send(wa, sign("ie1-token", wa))).status).toBe(403);
    expect((await send(wa, sign("us1-token", wa))).status).toBe(200);
  });
});

describe("what a reply is about", () => {
  it("an OK to 'we need to move your appointment' keeps the rebooking offer open and points to it", async () => {
    const d = await book(A, person());
    const a = d.appointment;
    await db.insert(timeOff).values({ id: newId(), orgId: A.orgId, practitionerId: A.drA, startsAt: new Date(a.startsAt.getTime() - 3_600_000), endsAt: a.endsAt });
    const offers = await sendRebookOffers(A.orgId, [a.id], { type: "user", id: null }, NOW);
    expect(offers.sent).toEqual([a.id]);

    const res = await handleInboundMessage({ channel: "sms", from: d.patient.phone!, to: A_NUMBER, body: "Ok", replyMode: "return", now: NOW });
    expect(res).toMatchObject({ intent: "confirm", appointmentId: a.id });
    const after = await row(a.id);
    expect(after.confirmation).toBe("pending");
    expect(after.needsAttention).toBe(true);
    expect((await patientRebook(after, NOW)).open).toBe(true);
    // The answer points to the rebooking page, never "you're confirmed".
    expect(res.reply).toContain("/rebook");
    expect(res.reply).not.toContain("confermat");
  });

  it("YES to a booking held for another adult's own confirmation confirms nothing; NO declines the hold", async () => {
    const d = await book(A, person());
    const a = d.appointment;
    await db
      .update(appointments)
      .set({ processingContext: "marketplace", bookedFor: "other_adult", status: "requested", bookedByName: "Julien" })
      .where(eq(appointments.id, a.id));
    await textFrom(A.orgId, d.patient.phone!, a.id);

    const yes = await handleInboundMessage({ channel: "sms", from: d.patient.phone!, to: A_NUMBER, body: "SI", replyMode: "return", now: NOW });
    expect(yes.intent).toBe("confirm");
    expect(await row(a.id)).toMatchObject({ status: "requested", confirmation: "pending" });
    expect(yes.reply).toContain("/privacy/confirm");
    expect(yes.reply).not.toContain("Presenza confermata");

    const no = await handleInboundMessage({ channel: "sms", from: d.patient.phone!, to: A_NUMBER, body: "NO", replyMode: "return", now: NOW });
    expect(no.intent).toBe("cancel");
    const after = await row(a.id);
    // Declined as on the confirmation page: neither the patient's nor the practice's cancellation.
    expect(after).toMatchObject({ status: "cancelled", cancelledBy: null, confirmation: "declined", confirmedVia: "adult_declined" });
    const actions = (await db.select({ action: auditLog.action }).from(auditLog).where(eq(auditLog.entityId, a.id))).map((r) => r.action);
    expect(actions).toContain("adult_confirmation.decline");
  });

  it("YES to a request the practice still has to accept says so, and flags it for the front desk", async () => {
    const d = await book(A, person());
    await db.update(appointments).set({ status: "requested" }).where(eq(appointments.id, d.appointment.id));
    await textFrom(A.orgId, d.patient.phone!, d.appointment.id);
    const res = await handleInboundMessage({ channel: "sms", from: d.patient.phone!, to: A_NUMBER, body: "SI", replyMode: "return", now: NOW });
    expect(await row(d.appointment.id)).toMatchObject({ status: "requested", confirmation: "pending", needsAttention: true });
    expect(res.reply).toContain("accettata");
    expect(res.reply).not.toContain("Presenza confermata");
  });

  it("a 'wrong number' answer, a STOP or a text nobody asked for doesn't verify the number", async () => {
    const d = await book(A, person());
    const phone = d.patient.phone!;
    await textFrom(A.orgId, phone, d.appointment.id);
    await handleInboundMessage({ channel: "sms", from: phone, to: A_NUMBER, body: "Chi è? Numero sbagliato", replyMode: "return", now: NOW });
    expect(isContactVerified(await patientRow(d.patient.id), "phone", phone)).toBe(false);
    await handleInboundMessage({ channel: "sms", from: phone, to: A_NUMBER, body: "STOP", replyMode: "return", now: NOW });
    expect(isContactVerified(await patientRow(d.patient.id), "phone", phone)).toBe(false);

    // Never texted by the practice: a YES is no proof either.
    const quiet = await book(A, person());
    await db.delete(messages).where(eq(messages.to, quiet.patient.phone!));
    await handleInboundMessage({ channel: "sms", from: quiet.patient.phone!, to: A_NUMBER, body: "SI", replyMode: "return", now: NOW });
    expect(isContactVerified(await patientRow(quiet.patient.id), "phone", quiet.patient.phone!)).toBe(false);
  });

  it("a reply to a waiting-list offer doesn't confirm the patient's next visit", async () => {
    const d = await book(A, person());
    const phone = d.patient.phone!;
    await textFrom(A.orgId, phone, d.appointment.id);
    // Later: "a slot opened…" (about no appointment).
    await deliver({ orgId: A.orgId, appointmentId: null, channel: "sms", to: phone, text: "Si è liberato un posto" });
    const res = await handleInboundMessage({ channel: "sms", from: phone, to: A_NUMBER, body: "Sì", replyMode: "return", now: NOW });
    expect(res.appointmentId).toBeNull();
    expect((await row(d.appointment.id)).confirmation).toBe("pending");
    expect(res.reply).toContain("Studio Alfa");
    expect(res.reply).not.toContain("confermat");
  });

  it("a NO to a cancellation notice doesn't cancel the patient's other visit", async () => {
    const phone = `+39${seq++}`;
    const first = await book(A, person({ phone }));
    const second = await book(A, person({ phone }));
    await textFrom(A.orgId, phone, second.appointment.id);
    await cancelAppointment(first.appointment.id, { by: "staff", notifyPatient: false, now: NOW });
    await textFrom(A.orgId, phone, first.appointment.id);
    const res = await handleInboundMessage({ channel: "sms", from: phone, to: A_NUMBER, body: "NO", replyMode: "return", now: NOW });
    expect(res.appointmentId).toBeNull();
    expect((await row(second.appointment.id)).status).toBe("scheduled");
  });
});

describe("logs", () => {
  it("never carry a phone number or an email", () => {
    const text = logLines.join("");
    expect(text).not.toMatch(/\+\d{8,15}/);
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
  });
});
