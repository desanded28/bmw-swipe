import { and, desc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, consents, messages, organizations, patients } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { createPractice, MONDAY, NOW, TZ } from "@/test/fixtures";
import { createAppointment, type NewPatientInput } from "./booking";
import { KEYWORDS, normalizeReply, parseIntent, handleInboundMessage, type Intent } from "./inbound";
import { deliver } from "./messaging";
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

describe("logs", () => {
  it("never carry a phone number or an email", () => {
    const text = logLines.join("");
    expect(text).not.toMatch(/\+\d{8,15}/);
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
  });
});
