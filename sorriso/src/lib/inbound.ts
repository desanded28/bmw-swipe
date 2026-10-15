import { and, asc, desc, eq, gt, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  messages,
  organizations,
  patients,
  type Channel,
  type ConsentPurpose,
  type Message,
  type Patient,
} from "@/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/config";
import { appointmentLinks, getAppointmentDetails, templateData } from "./appointments";
import { awaitsAdultConsent, cancelAppointment, confirmAttendance } from "./booking";
import { APP_NAME } from "./config";
import { markContactVerified, recipientFor } from "./contact";
import { manageTokenOf } from "./links";
import { newId } from "./ids";
import { logError } from "./log";
import { deliver } from "./messaging";
import { isMessagingServiceSid, platformSenders, practiceSender, senderKey, twilioProviderName } from "./messaging/providers";
import { templates } from "./messaging/templates";
import { normalizePhone } from "./phone";
import { audit } from "./audit";
import { confirmationUrl, declineAdultBookingByReply } from "./privacy/adult-confirmation";
import { ConsentError, recordConsent, withdrawConsent } from "./privacy/consent";
import { linkRebook, rebookUrl } from "./rebooking";
import { resolveSettings } from "./settings";

export type Intent = NonNullable<Message["intent"]>;

// ---------------------------------------------------------------- understanding replies

export type Lexicon = {
  /** First word, or a phrase anywhere: the patient will come. */
  confirm: readonly string[];
  /** First word, or a phrase anywhere: the patient won't come. */
  cancel: readonly string[];
  /** The whole message (at most two words): no more texts. */
  stop: readonly string[];
  /** The whole message (at most two words): texts back on. */
  start: readonly string[];
  /** Any word starting with a "stem*", or a phrase anywhere: a new time, please. */
  reschedule: readonly string[];
};

/**
 * Reply words per language, written as patients type them; matching ignores case, accents
 * (Latin script only), punctuation and extra spaces. The confirm and cancel words that the SMS
 * texts ask for (it SI/NO, en YES/NO, de JA/NEIN, fr OUI/NON, es SI/NO, pt SIM/NAO, ro DA/NU,
 * pl TAK/NIE) must stay in these lists. START and ISCRIVI turn texts back on.
 */
export const KEYWORDS: Record<Locale, Lexicon> = {
  it: {
    confirm: [
      "sì", "si", "s", "sii", "ok", "okay", "k", "1", "confermo", "conferma", "confermato", "confermata", "certo",
      "certamente", "presente", "perfetto", "va bene", "ci sarò", "ci sono", "d'accordo",
    ],
    cancel: [
      "no", "n", "2", "annulla", "annullo", "annullare", "disdico", "disdire", "disdetta", "disdici", "cancella",
      "cancello", "impossibile", "non posso", "non riesco", "non vengo", "non ci sarò", "non potrò",
    ],
    stop: ["stop", "stopall", "basta", "disiscrivi", "cancellami"],
    start: ["start", "iscrivi", "riattiva", "unstop"],
    reschedule: [
      "spost*", "rinvi*", "rimand*", "posticip*", "anticip*", "cambi*", "altro giorno", "altro orario",
      "un'altra data",
    ],
  },
  en: {
    confirm: [
      "yes", "y", "yep", "yeah", "yup", "ok", "okay", "k", "1", "confirm", "confirmed", "sure", "fine",
      "will be there", "i'll be there", "see you",
    ],
    cancel: [
      "no", "n", "nope", "2", "cancel", "cancelled", "canceled", "can't come", "cannot come", "can't make it",
      "won't make it", "won't be there", "not coming",
    ],
    stop: ["stop", "stopall", "unsubscribe", "end", "quit"],
    start: ["start", "unstop", "subscribe", "resume"],
    reschedule: [
      "reschedul*", "postpone*", "rebook*", "move", "change", "another day", "another time", "different day",
      "different time",
    ],
  },
  de: {
    confirm: [
      "ja", "jo", "jep", "ok", "okay", "1", "bestätige", "bestätigt", "bestätigen", "ich bestätige", "klar", "passt",
      "gerne", "einverstanden", "ich komme", "bis dann",
    ],
    cancel: [
      "nein", "nee", "2", "absagen", "absage", "abgesagt", "storniere", "stornieren", "storno", "kann nicht",
      "komme nicht", "schaffe es nicht",
    ],
    stop: ["stopp", "stop", "abmelden", "abbestellen"],
    start: ["start", "anmelden"],
    reschedule: ["verschieb*", "verleg*", "umbuch*", "anderer termin", "anderen termin", "neuen termin"],
  },
  fr: {
    confirm: [
      "oui", "ouais", "ok", "okay", "1", "d'accord", "je confirme", "confirme", "confirmé", "parfait", "entendu",
      "je viendrai", "à demain",
    ],
    cancel: [
      "non", "2", "annuler", "annule", "j'annule", "annulé", "je ne peux pas", "ne peux pas", "je ne viendrai pas",
      "pas disponible", "empêché",
    ],
    stop: ["arrêt", "arret", "stop", "désabonner", "désinscrire"],
    start: ["start", "reprendre"],
    reschedule: [
      "report*", "déplac*", "décal*", "changer", "autre jour", "autre date", "autre horaire", "autre créneau",
    ],
  },
  es: {
    confirm: [
      "sí", "si", "vale", "ok", "okay", "1", "confirmo", "confirmado", "claro", "perfecto", "de acuerdo",
      "allí estaré", "ahí estaré", "nos vemos",
    ],
    cancel: [
      "no", "2", "cancelar", "cancelo", "cancela", "anular", "anulo", "no puedo", "no podré", "no voy", "no iré",
    ],
    stop: ["baja", "stop", "parar"],
    start: ["start", "alta"],
    reschedule: ["cambi*", "aplaz*", "reprogram*", "mover", "posponer", "otro día", "otra hora", "otra fecha"],
  },
  pt: {
    confirm: [
      "sim", "ok", "okay", "1", "confirmo", "confirmado", "claro", "combinado", "certo", "lá estarei", "estarei",
      "até amanhã",
    ],
    cancel: [
      "não", "nao", "2", "cancelar", "cancelo", "cancela", "desmarcar", "desmarco", "não posso", "não vou",
      "não consigo",
    ],
    stop: ["parar", "stop", "sair"],
    start: ["start", "ativar"],
    reschedule: ["remarc*", "reagend*", "adiar", "mudar", "alterar", "outro dia", "outra hora", "outra data"],
  },
  ro: {
    confirm: ["da", "ok", "okay", "1", "confirm", "confirmat", "sigur", "bine", "vin", "voi fi acolo", "ne vedem"],
    cancel: ["nu", "2", "anulez", "anulare", "anula", "anulat", "nu pot", "nu vin", "nu ajung"],
    stop: ["stop", "dezabonare", "dezabonez"],
    start: ["start", "abonare"],
    reschedule: ["reprogram*", "amân*", "mutați*", "muta", "mut", "schimb*", "altă zi", "altă oră", "altă dată"],
  },
  pl: {
    confirm: [
      "tak", "ok", "okej", "okay", "1", "potwierdzam", "potwierdzone", "dobrze", "będę", "jasne", "zgoda",
      "do zobaczenia",
    ],
    cancel: [
      "nie", "2", "odwołuję", "odwołać", "odwołaj", "anuluję", "anuluj", "rezygnuję", "nie mogę", "nie przyjdę",
      "nie będę", "nie dam rady",
    ],
    stop: ["stop", "wypisz"],
    start: ["start", "zapisz"],
    reschedule: ["przełoż*", "przesu*", "zmian*", "zmie*", "inny termin", "innym terminie", "inny dzień"],
  },
};

/**
 * Phrases that start with a "no" but mean yes ("no problem"): checked before the cancel words.
 * Italian "non c'è problema" confirms, it doesn't cancel.
 */
export const NOT_A_REFUSAL: Record<Locale, readonly string[]> = {
  it: ["non c'è problema", "non ci sono problemi", "nessun problema", "no problem"],
  en: ["no problem", "no prob", "no worries", "not a problem"],
  de: ["kein problem", "keine sorge"],
  fr: ["pas de problème", "pas de souci", "pas de soucis", "aucun problème", "sans problème"],
  es: ["no hay problema", "sin problema", "ningún problema", "no pasa nada"],
  pt: ["sem problema", "nenhum problema", "não há problema", "não tem problema"],
  ro: ["nicio problemă", "nici o problemă", "nu e problemă", "nu este nicio problemă"],
  pl: ["nie ma problemu", "żaden problem", "bez problemu"],
};

/** Examples of replies in each language, for the dashboard's reply simulator. */
export const SAMPLE_REPLIES: Record<Locale, readonly string[]> = {
  it: ["SI", "NO", "Posso spostarlo?", "Arrivo 10 minuti in ritardo"],
  en: ["YES", "NO", "Can I move it?", "Running 10 minutes late"],
  de: ["JA", "NEIN", "Kann ich den Termin verschieben?"],
  fr: ["OUI", "NON", "Je voudrais reporter"],
  es: ["SI", "NO", "¿Puedo cambiar la cita?"],
  pt: ["SIM", "NÃO", "Posso remarcar?"],
  ro: ["DA", "NU", "Pot reprograma?"],
  pl: ["TAK", "NIE", "Czy mogę przełożyć wizytę?"],
};

const NON_LATIN_LETTER = /(?!\p{Script=Latin})\p{L}/u;
const SPECIAL: Record<string, string> = { ł: "l", ŀ: "l", ß: "ss", œ: "oe", æ: "ae", ø: "o", đ: "d", ı: "i" };

/**
 * Lower case, punctuation as spaces, single spaces. Accents are stripped from Latin-script text
 * only ("Sì" -> "si", "odwołuję" -> "odwoluje"); NFD would mangle other scripts.
 */
export function normalizeReply(raw: string): string {
  let s = raw.toLowerCase();
  if (!NON_LATIN_LETTER.test(s)) {
    s = s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[łŀßœæøđı]/g, (c) => SPECIAL[c]);
  }
  return s
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type CompiledLexicon = {
  confirmWords: Set<string>;
  confirmPhrases: string[];
  cancelWords: Set<string>;
  cancelPhrases: string[];
  stop: Set<string>;
  start: Set<string>;
  stems: string[];
  reschedulePhrases: string[];
  notRefusal: string[];
};

function compile(l: Lexicon, notRefusal: readonly string[]): CompiledLexicon {
  const norm = (list: readonly string[]) =>
    list.map((w) => (w.endsWith("*") ? `${normalizeReply(w.slice(0, -1))}*` : normalizeReply(w)));
  const split = (list: readonly string[]) => {
    const n = norm(list);
    return { words: new Set(n.filter((w) => !w.includes(" "))), phrases: n.filter((w) => w.includes(" ")) };
  };
  const confirm = split(l.confirm);
  const cancel = split(l.cancel);
  const reschedule = norm(l.reschedule);
  return {
    confirmWords: confirm.words,
    confirmPhrases: confirm.phrases,
    cancelWords: cancel.words,
    cancelPhrases: cancel.phrases,
    stop: new Set(norm(l.stop)),
    start: new Set(norm(l.start)),
    stems: reschedule.filter((w) => w.endsWith("*")).map((w) => w.slice(0, -1)),
    reschedulePhrases: reschedule.filter((w) => !w.endsWith("*")),
    notRefusal: norm(notRefusal),
  };
}

const COMPILED = Object.fromEntries(LOCALES.map((l) => [l, compile(KEYWORDS[l], NOT_A_REFUSAL[l])])) as Record<
  Locale,
  CompiledLexicon
>;

/** Whole-message keywords of every language, for the fallback: word -> the intents it means somewhere. */
const UNION = (() => {
  const map = new Map<string, Set<Intent>>();
  const add = (w: string, intent: Intent) => {
    if (!w || w.endsWith("*")) return;
    const set = map.get(w) ?? new Set<Intent>();
    set.add(intent);
    map.set(w, set);
  };
  for (const l of LOCALES) {
    const lex = KEYWORDS[l];
    for (const intent of ["confirm", "cancel", "stop", "start", "reschedule"] as const) {
      for (const w of lex[intent]) add(normalizeReply(w), intent);
    }
    for (const w of NOT_A_REFUSAL[l]) add(normalizeReply(w), "confirm");
  }
  return map;
})();

/** " a b " contains the phrase "a b" as whole words. */
const hasPhrase = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);

/** Full understanding in one language: first words, phrases and stems. */
function parseIn(locale: Locale, text: string): Intent {
  const c = COMPILED[locale];
  const words = text.split(" ");
  const first = words[0];
  if (words.length <= 2 && (c.stop.has(first) || c.stop.has(text))) return "stop";
  if (words.length <= 2 && (c.start.has(first) || c.start.has(text))) return "start";
  if (c.notRefusal.some((p) => hasPhrase(text, p))) return "confirm";
  const stem = words.some((w) => c.stems.some((s) => w.startsWith(s)));
  if (stem || c.reschedulePhrases.some((p) => hasPhrase(text, p))) return "reschedule";
  if (c.cancelWords.has(first) || c.cancelPhrases.some((p) => hasPhrase(text, p))) return "cancel";
  if (c.confirmWords.has(first) || c.confirmPhrases.some((p) => hasPhrase(text, p))) return "confirm";
  return "unknown";
}

/**
 * Understand a free-text reply. The patient's language first, with its phrases ("non posso
 * venire", "kein Problem"); then, because people answer in the language they think in, every
 * language's keywords, but only when the whole message is a single keyword that means the same
 * in every language that has it ("TAK", "oui", "da"). Free text in another language stays
 * "unknown" and is flagged for the front desk: Romanian "da" is also an Italian preposition.
 */
export function parseIntent(raw: string, locale?: Locale | null): Intent {
  if (/👍|✅|👌|🆗/u.test(raw)) return "confirm";
  if (/👎|❌|🚫/u.test(raw)) return "cancel";
  const text = normalizeReply(raw);
  if (!text) return "unknown";
  const own = parseIn(locale ?? DEFAULT_LOCALE, text);
  if (own !== "unknown") return own;
  const meanings = UNION.get(text);
  return meanings?.size === 1 ? [...meanings][0] : "unknown";
}

// ---------------------------------------------------------------- routing replies

/**
 * The number this patient's texts go to: recipientFor() (the guardian's for a child under 14 with
 * guardian contacts), read as if the patient were not restricted, so a restricted patient's STOP or
 * reply about an earlier message still finds them.
 */
function textedNumber(p: Patient, now: Date): string | null {
  return textRecipient(p, now).phone;
}

function textRecipient(p: Patient, now: Date) {
  return recipientFor({ ...p, restrictedAt: null, erasedAt: null }, now);
}

export type InboundResult = {
  intent: Intent;
  reply: string | null;
  appointmentId: string | null;
  orgId: string | null;
};

/**
 * The practice whose own number (or Messaging Service) received the text; null for the shared
 * platform sender.
 * - The platform's shared senders (platformSenders(): TWILIO_FROM, the shared Messaging Service,
 *   the WhatsApp sender, TWILIO_SHARED_SENDERS) are no practice's, even if an inboundNumber holds one.
 * - When Twilio names the Messaging Service of the receiving number, the service decides: the
 *   shared one means the shared sender (whichever number of its pool got the text), a practice's
 *   one means that practice, whatever another practice claims about the number.
 * - Otherwise the receiving number itself.
 */
async function orgByInboundNumber(to: string | null | undefined, messagingServiceSid: string | null | undefined) {
  const shared = platformSenders();
  const raw = messagingServiceSid?.trim() ?? "";
  const service = isMessagingServiceSid(raw) ? senderKey(raw) : null;
  if (service) {
    if (shared.has(service)) return null;
    const [org] = await db
      .select()
      .from(organizations)
      .where(inArray(organizations.inboundNumber, [...new Set([service, raw])]));
    if (org) return org;
  }
  const number = senderKey(to);
  if (!number || shared.has(number)) return null;
  const [org] = await db.select().from(organizations).where(eq(organizations.inboundNumber, number));
  return org ?? null;
}

/** The practices among `orgIds` that text from a sender of their own (orgId -> senderKey of it). */
async function ownSenders(orgIds: string[]): Promise<Map<string, string>> {
  if (!orgIds.length) return new Map();
  const rows = await db
    .select({ id: organizations.id, inboundNumber: organizations.inboundNumber })
    .from(organizations)
    .where(and(inArray(organizations.id, orgIds), isNotNull(organizations.inboundNumber)));
  const out = new Map<string, string>();
  for (const o of rows) {
    const key = senderKey(practiceSender(o.inboundNumber));
    if (key) out.set(o.id, key);
  }
  return out;
}

/**
 * Did this outbound text leave from the shared sender? A WhatsApp message always did (there is one
 * platform-wide WhatsApp sender). An SMS did, unless its practice has a sender of its own and the
 * SMS left from it, or from a sender we don't know (deliver() records the number or Messaging
 * Service each SMS left from in messages.from).
 */
function leftFromSharedSender(
  m: { orgId: string | null; from: string | null },
  channel: Exclude<Channel, "email">,
  own: Map<string, string>,
): boolean {
  if (channel === "whatsapp") return true;
  const ownKey = m.orgId ? own.get(m.orgId) : undefined;
  if (!ownKey) return true;
  const from = senderKey(m.from);
  return from !== null && from !== ownKey;
}

/** Patients of `orgId` (every practice when null) whose texts go to `phone`. */
async function patientsTextedAt(phone: string, orgId: string | null, now: Date): Promise<Patient[]> {
  const rows = await db
    .select()
    .from(patients)
    .where(and(or(eq(patients.phone, phone), eq(patients.guardianPhone, phone)), orgId ? eq(patients.orgId, orgId) : undefined));
  return rows.filter((p) => textedNumber(p, now) === phone);
}

/**
 * Which practice a reply is for, and whether it reached the shared platform sender:
 * 1. the dashboard simulator names it;
 * 2. the number (or Messaging Service) that received it is a practice's inboundNumber
 *    (orgByInboundNumber);
 * 3. on the shared sender: the practice that last texted this number, on this channel, from the
 *    shared sender. A practice that texts from its own number is answered there, never here;
 * 4. else the only practice with a patient texted at this number, if it uses the shared sender.
 *    Several, or none: nobody, and nothing changes.
 */
async function replyScope(
  input: { orgId?: string; channel: Exclude<Channel, "email">; to?: string | null; messagingServiceSid?: string | null },
  phone: string | null,
  now: Date,
) {
  if (input.orgId) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, input.orgId));
    return { org: org ?? null, sharedSender: false };
  }
  const receiver = await orgByInboundNumber(input.to, input.messagingServiceSid);
  if (receiver) return { org: receiver, sharedSender: false };
  if (!phone) return { org: null, sharedSender: true };
  const recent = await db
    .select({ orgId: messages.orgId, from: messages.from })
    .from(messages)
    .where(
      and(
        eq(messages.direction, "outbound"),
        eq(messages.to, phone),
        eq(messages.channel, input.channel),
        isNotNull(messages.orgId),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(50);
  const textedHere = [...new Set((await patientsTextedAt(phone, null, now)).map((p) => p.orgId))];
  const own = await ownSenders([...new Set([...recent.map((m) => m.orgId!), ...textedHere])]);
  let orgId = recent.find((m) => leftFromSharedSender(m, input.channel, own))?.orgId ?? null;
  if (!orgId && textedHere.length === 1 && (input.channel === "whatsapp" || !own.has(textedHere[0]))) orgId = textedHere[0];
  const [org] = orgId ? await db.select().from(organizations).where(eq(organizations.id, orgId)) : [];
  return { org: org ?? null, sharedSender: true };
}

/** The channel's consent purpose: STOP on SMS stops SMS, on WhatsApp stops WhatsApp. */
const channelPurpose = (channel: Exclude<Channel, "email">): ConsentPurpose =>
  channel === "whatsapp" ? "whatsapp_channel" : "sms_channel";

/**
 * Record STOP (a withdrawal) or START (a grant) in the consent ledger for these patients; the
 * ledger keeps patients.smsOptIn in step. A guardian's reply is recorded as the guardian's act.
 */
async function recordTextChoice(rows: Patient[], channel: Exclude<Channel, "email">, granted: boolean, now: Date) {
  if (!rows.length) return;
  await db.transaction(async (tx) => {
    for (const p of rows) {
      const viaGuardian = textRecipient(p, now).viaGuardian;
      const entry = {
        orgId: p.orgId,
        patientId: p.id,
        purpose: channelPurpose(channel),
        locale: p.locale,
        method: "sms_reply",
        source: "sms_reply",
        actorRelation: viaGuardian ? (p.guardianRelation ?? "parent") : "self",
        now,
      } as const;
      try {
        if (granted) await recordConsent(tx, { ...entry, granted: true });
        else await withdrawConsent(tx, entry);
      } catch (err) {
        // A WhatsApp START from a child under 14 can't grant consent alone: nothing to record.
        if (!(err instanceof ConsentError)) throw err;
      }
    }
  });
}

/**
 * Handle an inbound SMS / WhatsApp message from a patient.
 *
 * Practice boundaries: the reply is matched to one practice (replyScope) and only that
 * practice's patients and appointments are considered, so a reply can never change another
 * practice's appointment. The answer goes out in that practice's name and in the patient's
 * language. STOP withdraws the channel for that practice's patients; when the shared platform
 * sender received it, for every practice's patients at that number (the carrier blocks the sender
 * for that number anyway, so every practice using it loses the channel). START grants it again
 * only at the matched practice: each practice is a separate controller, and a START sent in answer
 * to one practice is no choice about another, where the patient may have withdrawn on purpose.
 *
 * The answer is sent through the provider's API (deliver()), from the number or Messaging Service
 * the patient wrote to, never as an inline TwiML reply: Twilio's copy then has a message SID we
 * store, and the reminders cron deletes it after privacy.retention.providerMessageDays like any
 * other copy. It is also returned.
 *
 * replyMode:
 *   "return"  – the Twilio webhook: the inbound text is logged under the Twilio provider with its
 *               MessageSid (so its copy is deleted later too).
 *   "deliver" – the dashboard simulator: the inbound text is logged as "simulator".
 */
export async function handleInboundMessage(input: {
  channel: Exclude<Channel, "email">;
  from: string;
  to?: string | null;
  /** Twilio's MessagingServiceSid, when the receiving number belongs to a Messaging Service. */
  messagingServiceSid?: string | null;
  body: string;
  providerId?: string | null;
  replyMode: "return" | "deliver";
  /** Only consider this practice's patients (the dashboard simulator). */
  orgId?: string;
  now?: Date;
}): Promise<InboundResult> {
  const now = input.now ?? new Date();
  const phone = normalizePhone(input.from);
  const { org, sharedSender } = await replyScope(input, phone, now);
  const orgId = org?.id ?? null;

  // The records we text at this number in this practice: a child under 14's messages go to the
  // guardian (recipientFor), so the guardian's reply is about the child, and the child's own
  // number, which we don't text, is not. With a parent who is also a patient, both records match;
  // the outbound message below decides which visit the reply is about, and STOP covers both.
  const patientRows = phone && orgId ? await patientsTextedAt(phone, orgId, now) : [];
  const patientIds = patientRows.map((p) => p.id);

  // Which visit are they answering? The one this practice's latest text to this number was about.
  // A latest text about no visit (a waiting-list offer, a recall) or about one that is no longer
  // upcoming (a cancellation notice, a past visit) means the reply is about none of the others:
  // it gets the general answer and changes nothing. Only a number this practice never texted
  // falls back to the soonest upcoming visit.
  const candidates = patientIds.length
    ? await db
        .select({ id: appointments.id, startsAt: appointments.startsAt })
        .from(appointments)
        .where(
          and(
            eq(appointments.orgId, orgId!),
            inArray(appointments.patientId, patientIds),
            inArray(appointments.status, ["scheduled", "requested"]),
            gt(appointments.startsAt, new Date(now.getTime() - 30 * 60_000)),
          ),
        )
        .orderBy(asc(appointments.startsAt))
    : [];
  let upcoming: (typeof candidates)[number] | undefined = candidates[0];
  /** The reply answers our latest text about `upcoming` (not a guess): it may prove the number. */
  let answersText = false;
  /** Our latest text to this number was about none of the upcoming visits. */
  let offTopic = false;
  if (candidates.length && phone) {
    const [lastText] = await db
      .select({ appointmentId: messages.appointmentId })
      .from(messages)
      .where(
        and(
          eq(messages.orgId, orgId!),
          eq(messages.direction, "outbound"),
          eq(messages.to, phone),
          inArray(messages.channel, ["sms", "whatsapp"]),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (lastText) {
      upcoming = candidates.find((c) => c.id === lastText.appointmentId);
      answersText = Boolean(upcoming);
      offTopic = !upcoming;
    }
  }

  const found = upcoming ? await getAppointmentDetails({ id: upcoming.id }) : null;
  // Belt and braces: never act on another practice's appointment.
  const details = found && found.org.id === orgId ? found : null;
  const fallbackPatient = patientRows[0];
  const locale: Locale = details?.patient.locale ?? fallbackPatient?.locale ?? DEFAULT_LOCALE;
  const intent = parseIntent(input.body, locale);
  const provider = input.replyMode === "return" ? twilioProviderName(input.channel) : "simulator";

  await db.insert(messages).values({
    id: newId(),
    orgId,
    appointmentId: details?.appointment.id ?? null,
    patientId: details?.patient.id ?? fallbackPatient?.id ?? null,
    channel: input.channel,
    direction: "inbound",
    to: input.to ?? "",
    from: phone ?? input.from,
    body: input.body,
    status: "received",
    provider,
    providerId: input.providerId ?? null,
    intent,
  });

  // An understood answer (confirm, cancel, reschedule) to our latest text about this visit proves
  // the number reaches the patient (or their guardian). Anything else proves nothing: "wrong
  // number", STOP, or a text nobody asked for. Neither does the number of whoever booked for
  // another adult, nor the dashboard simulator (orgId given: staff pretending).
  const understood = intent === "confirm" || intent === "cancel" || intent === "reschedule";
  const bookerPhone = details?.appointment.bookedByPhone ? normalizePhone(details.appointment.bookedByPhone) : null;
  if (details && phone && !input.orgId && answersText && understood && phone !== bookerPhone) {
    await markContactVerified(details.patient.id, { kind: "phone", value: phone }, db, now).catch((err: unknown) =>
      logError("inbound", err, { step: "verify", patientId: details.patient.id }),
    );
  }

  const clinic = org?.name ?? APP_NAME;
  const asciiFallback = org ? resolveSettings(org.settings).reminders.smsAsciiFallback : false;
  let reply: string | null = null;

  if (intent === "stop" || intent === "start") {
    // STOP on the shared sender covers every practice texting this number; START only the
    // practice it was matched to (see above).
    const everyPractice = intent === "stop" && sharedSender && !input.orgId && phone;
    const affected = everyPractice ? await patientsTextedAt(phone, null, now) : patientRows;
    await recordTextChoice(affected, input.channel, intent === "start", now);
    reply = (intent === "stop" ? templates.reply.stop : templates.reply.start)(locale, clinic, { asciiFallback });
  } else if (!details) {
    reply = (offTopic ? templates.reply.general : templates.reply.none)(locale, clinic, { asciiFallback });
  } else {
    const data = templateData(details, now);
    // The patient changed the appointment by text: on the practice's access log (the simulator's
    // action audits its own call).
    const auditReply = (action: "appointment.update" | "appointment.cancel") =>
      input.orgId
        ? Promise.resolve()
        : audit({
            orgId: details.org.id,
            actor: { type: "webhook", id: null },
            action,
            entity: { type: "appointment", id: details.appointment.id },
            metadata: { via: input.channel, intent },
            at: now,
          });
    const a = details.appointment;
    // A marketplace booking for another adult, held until they confirm it themselves with a code
    // (src/lib/privacy/adult-confirmation.ts): a text can decline it, never confirm it.
    const held = a.status === "requested" && (await awaitsAdultConsent(db, a));
    // The practice closed and offered new times for this visit (src/lib/rebooking.ts).
    const rebook = await linkRebook(details, now);
    const token = manageTokenOf(a);
    const moveUrl = rebook.open && token ? rebookUrl(token) : null;
    switch (intent) {
      case "confirm":
        if (held) {
          reply = templates.reply.confirmThroughLink(data, confirmationUrl(details, locale) ?? data.manageUrl);
        } else if (a.status === "requested") {
          // A request the practice reviews: noted for the front desk, nothing is confirmed yet.
          await db
            .update(appointments)
            .set({ needsAttention: true, updatedAt: now })
            .where(and(eq(appointments.id, a.id), eq(appointments.orgId, details.org.id)));
          await auditReply("appointment.update");
          reply = templates.reply.awaitingApproval(data);
        } else if (moveUrl) {
          // "OK" to "we need to move your appointment" is no confirmation of a time the practice
          // can't keep: the offer stays open and the answer points to it.
          reply = templates.reply.reschedule(data, moveUrl);
        } else {
          await confirmAttendance(a.id, input.channel, now);
          await auditReply("appointment.update");
          reply = templates.reply.confirmed(data);
        }
        break;
      case "cancel":
        if (held) {
          // The adult said no: declined as on the confirmation page, not their own late cancellation.
          await declineAdultBookingByReply(a, { via: input.channel, now });
          reply = templates.reply.cancelled(data, appointmentLinks(details).rebookUrl);
          break;
        }
        // Only the understood intent is stored, never the patient's words (they may mention health).
        await cancelAppointment(details.appointment.id, {
          by: "patient",
          reason: input.channel === "whatsapp" ? "Cancelled by WhatsApp reply" : "Cancelled by SMS reply",
          via: input.channel,
          notifyPatient: false,
          now,
        });
        await auditReply("appointment.cancel");
        reply = templates.reply.cancelled(data, appointmentLinks(details).rebookUrl);
        break;
      case "reschedule":
        reply = moveUrl ? templates.reply.reschedule(data, moveUrl) : templates.reply.reschedule(data);
        break;
      default:
        await db
          .update(appointments)
          .set({ needsAttention: true, updatedAt: now })
          .where(and(eq(appointments.id, details.appointment.id), eq(appointments.orgId, details.org.id)));
        await auditReply("appointment.update");
        reply = templates.reply.unknown(data);
    }
  }

  if (reply && phone) {
    // A free-form answer (the patient just wrote, so WhatsApp accepts it without a template),
    // through the API so that Twilio's copy gets a SID we store and later delete. An SMS goes out
    // from the Messaging Service or number the patient wrote to (the simulator has none: the
    // practice's usual sender).
    const service = input.messagingServiceSid?.trim() ?? "";
    const sender = input.channel === "sms" ? (isMessagingServiceSid(service) ? service : normalizePhone(input.to ?? null)) : null;
    await deliver({
      orgId,
      appointmentId: details?.appointment.id ?? null,
      patientId: details?.patient.id ?? fallbackPatient?.id ?? null,
      channel: input.channel,
      to: phone,
      text: reply,
      locale,
      sender,
    });
  }

  return { intent, reply, appointmentId: details?.appointment.id ?? null, orgId };
}
