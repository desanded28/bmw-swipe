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
import { cancelAppointment, confirmAttendance } from "./booking";
import { APP_NAME } from "./config";
import { markContactVerified, recipientFor } from "./contact";
import { newId } from "./ids";
import { logError } from "./log";
import { deliver } from "./messaging";
import { twilioProviderName } from "./messaging/providers";
import { templates } from "./messaging/templates";
import { normalizePhone } from "./phone";
import { audit } from "./audit";
import { ConsentError, recordConsent, withdrawConsent } from "./privacy/consent";
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

/** The practice whose own number (or Messaging Service) received the text. */
async function orgByInboundNumber(to: string | null | undefined, messagingServiceSid: string | null | undefined) {
  const keys = [normalizePhone(to ?? null), to?.trim().replace(/^whatsapp:/i, ""), messagingServiceSid?.trim()].filter(
    (k): k is string => Boolean(k),
  );
  if (!keys.length) return null;
  const [org] = await db.select().from(organizations).where(inArray(organizations.inboundNumber, [...new Set(keys)]));
  return org ?? null;
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
 * 2. the number (or Messaging Service) that received it is a practice's inboundNumber;
 * 3. on the shared sender: the practice that last texted this number;
 * 4. else the only practice with a patient texted at this number. Several and none texted:
 *    nobody, and nothing changes.
 */
async function replyScope(
  input: { orgId?: string; to?: string | null; messagingServiceSid?: string | null },
  phone: string | null,
  now: Date,
) {
  if (input.orgId) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, input.orgId));
    return { org: org ?? null, sharedSender: false };
  }
  const own = await orgByInboundNumber(input.to, input.messagingServiceSid);
  if (own) return { org: own, sharedSender: false };
  if (!phone) return { org: null, sharedSender: true };
  const [lastText] = await db
    .select({ orgId: messages.orgId })
    .from(messages)
    .where(
      and(
        eq(messages.direction, "outbound"),
        eq(messages.to, phone),
        inArray(messages.channel, ["sms", "whatsapp"]),
        isNotNull(messages.orgId),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);
  let orgId = lastText?.orgId ?? null;
  if (!orgId) {
    const orgIds = [...new Set((await patientsTextedAt(phone, null, now)).map((p) => p.orgId))];
    orgId = orgIds.length === 1 ? orgIds[0] : null;
  }
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
 * language. STOP and START change the channel for that practice's patients; when the shared
 * platform sender received them, for every practice's patients at that number (the carrier blocks
 * the sender for that number anyway, so every practice using it loses the channel).
 *
 * replyMode:
 *   "return"  – return the reply text (e.g. to answer inline via TwiML); it is logged as sent.
 *   "deliver" – send the reply through the normal provider (used by the simulator).
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

  // Which visit are they answering? The one this practice most recently texted them about;
  // otherwise the soonest upcoming one.
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
  let upcoming = candidates[0];
  if (candidates.length > 1 && phone) {
    const [lastText] = await db
      .select({ appointmentId: messages.appointmentId })
      .from(messages)
      .where(
        and(
          eq(messages.orgId, orgId!),
          eq(messages.direction, "outbound"),
          eq(messages.to, phone),
          inArray(messages.channel, ["sms", "whatsapp"]),
          inArray(
            messages.appointmentId,
            candidates.map((c) => c.id),
          ),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);
    upcoming = candidates.find((c) => c.id === lastText?.appointmentId) ?? upcoming;
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

  // A reply matched to a visit proves the number reaches the patient (or their guardian). The
  // dashboard simulator (orgId given) is staff pretending, not proof.
  if (details && phone && !input.orgId) {
    await markContactVerified(details.patient.id, { kind: "phone", value: phone }, db, now).catch((err: unknown) =>
      logError("inbound", err, { step: "verify", patientId: details.patient.id }),
    );
  }

  const clinic = org?.name ?? APP_NAME;
  const asciiFallback = org ? resolveSettings(org.settings).reminders.smsAsciiFallback : false;
  let reply: string | null = null;

  if (intent === "stop" || intent === "start") {
    // On the shared sender the choice covers every practice texting this number (see above).
    const affected = phone ? (sharedSender && !input.orgId ? await patientsTextedAt(phone, null, now) : patientRows) : [];
    await recordTextChoice(affected, input.channel, intent === "start", now);
    reply = (intent === "stop" ? templates.reply.stop : templates.reply.start)(locale, clinic, { asciiFallback });
  } else if (!details) {
    reply = templates.reply.none(locale, clinic, { asciiFallback });
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
    switch (intent) {
      case "confirm":
        if (details.appointment.status === "requested") {
          await db
            .update(appointments)
            .set({ needsAttention: true })
            .where(and(eq(appointments.id, details.appointment.id), eq(appointments.orgId, details.org.id)));
        }
        await confirmAttendance(details.appointment.id, input.channel, now);
        await auditReply("appointment.update");
        reply = templates.reply.confirmed(data);
        break;
      case "cancel":
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
        reply = templates.reply.reschedule(data);
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
    const replyRow = {
      orgId,
      appointmentId: details?.appointment.id ?? null,
      patientId: details?.patient.id ?? fallbackPatient?.id ?? null,
    };
    if (input.replyMode === "deliver") {
      // A free-form reply: the patient just wrote, so WhatsApp accepts it without a template.
      await deliver({ ...replyRow, channel: input.channel, to: phone, text: reply, locale });
    } else {
      await db.insert(messages).values({
        id: newId(),
        ...replyRow,
        channel: input.channel,
        direction: "outbound",
        to: phone,
        from: input.to ?? null,
        body: reply,
        status: "sent",
        provider,
      });
    }
  }

  return { intent, reply, appointmentId: details?.appointment.id ?? null, orgId };
}
