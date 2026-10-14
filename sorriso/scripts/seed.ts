/**
 * Demo data: six practices across Italy, one of them (Studio Dentistico Bianchi)
 * with two offices, chairs, a full calendar, confirmations, SMS replies,
 * reviews and a waitlist. Deterministic (seeded PRNG) so screenshots are stable.
 *
 *   npm run db:reset   # wipe + migrate + seed
 *
 * Demo data must never reach real people: the seed refuses to run in production or against a
 * non-file database unless ALLOW_DEMO_SEED=1, every phone number is in the unassigned +39 000
 * range, emails use example domains, and the demo API key is random and printed once.
 */
import { eq } from "drizzle-orm";
import { db, type DB } from "../src/db";
import {
  apiKeys,
  appointments,
  locations,
  memberships,
  messages,
  organizations,
  patients,
  practitionerServices,
  practitioners,
  reminders,
  reviews,
  rooms,
  schedules,
  services,
  timeOff,
  users,
  waitlist,
  type Appointment,
  type OrgSettings,
  type Patient,
  type ServiceCategory,
} from "../src/db/schema";
import { getAppointmentDetails, templateData } from "../src/lib/appointments";
import { findSlots, loadAvailabilityContext, rangeForDates } from "../src/lib/availability";
import { newId, newToken, sha256, slugify } from "../src/lib/ids";
import { DEMO_OWNER_EMAIL, DEMO_PASSWORD, DEMO_RECEPTION_EMAIL } from "../src/lib/security/demo-accounts";
import { demoSeedRefusal, fakePhone } from "../src/lib/security/seed-guard";
import { issueManageToken } from "../src/lib/links";
import { parseSpokenLanguages } from "./backfill-0001";
import { templates } from "../src/lib/messaging/templates";
import { hashPassword } from "../src/lib/password";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { scheduleReminders } from "../src/lib/reminders";
import { addDays, todayIn, zonedToUtc } from "../src/lib/time";
import { seedCare } from "./seed/care";
import { seedMarketplace } from "./seed/marketplace";
import { seedPrivacy } from "./seed/privacy";

/**
 * What the core seed created, handed to the package seeds (scripts/seed/*.ts) that add their
 * own demo data on top: marketplace (WP7), care (WP8) and privacy (WP5). Ids per practice are
 * keyed by org id, in creation order. [frozen: fields may only be added]
 */
export type SeedContext = {
  db: DB;
  now: Date;
  /** Every seeded practice, the flagship (Studio Dentistico Bianchi) first. */
  orgIds: string[];
  practitionerIds: Record<string, string[]>;
  serviceIds: Record<string, string[]>;
  locationIds: Record<string, string[]>;
  patientIds: Record<string, string[]>;
  /** Every appointment, cancelled ones included. */
  appointmentIds: Record<string, string[]>;
};

// ---------- deterministic randomness ----------
let seed = 20261013;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;

const TZ = "Europe/Rome";
const today = todayIn(TZ);

// ---------- reference data ----------
const FIRST = [
  "Marco", "Giulia", "Alessandro", "Francesca", "Lorenzo", "Chiara", "Matteo", "Sara", "Andrea", "Martina",
  "Davide", "Elena", "Simone", "Valentina", "Federico", "Alessia", "Riccardo", "Laura", "Tommaso", "Giorgia",
  "Gabriele", "Anna", "Edoardo", "Beatrice", "Pietro", "Sofia", "Nicolò", "Camilla", "Filippo", "Ilaria",
  "Stefano", "Paola", "Emma", "Leonardo", "Aurora", "Daniele", "Noemi", "Jacopo", "Greta", "Michele",
];
const LAST = [
  "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco",
  "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti",
  "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone",
];
const REVIEW_COMMENTS = {
  it: [
    "Professionale e molto gentile, mi ha spiegato tutto con calma.",
    "Studio pulitissimo, puntuali e personale cordiale. Consigliato!",
    "Avevo paura del dentista, ma mi sono trovata benissimo.",
    "Ottima esperienza, prenotazione online semplicissima e promemoria utilissimo.",
    "Molto preciso e attento. Prezzi trasparenti.",
    "Igiene fatta con cura, nessun dolore. Tornerò sicuramente.",
    "Disponibile e chiaro nelle spiegazioni, mi ha proposto diverse opzioni.",
    "Un po' di attesa in sala, ma la visita è stata eccellente.",
  ],
  en: [
    "Very professional and kind, explained everything clearly.",
    "Spotless practice, on time and friendly staff. Highly recommended!",
    "Easy online booking and the SMS reminder was really handy.",
    "Great with my kids, they actually enjoyed the visit.",
  ],
};

type ServiceSeed = {
  key: string;
  name: string;
  category: ServiceCategory;
  duration: number;
  buffer?: number;
  price: number | null;
  description: string;
  requiresRoom?: boolean;
};

const SERVICE_LIBRARY: Record<string, ServiceSeed> = {
  firstVisit: {
    key: "firstVisit",
    name: "First dental visit",
    category: "checkup",
    duration: 30,
    price: 5000,
    description: "Full check-up with oral examination, treatment plan and estimate.",
  },
  checkup: {
    key: "checkup",
    name: "Check-up",
    category: "checkup",
    duration: 20,
    price: 4000,
    description: "Routine control visit for existing patients.",
  },
  cleaning: {
    key: "cleaning",
    name: "Professional cleaning",
    category: "hygiene",
    duration: 45,
    buffer: 10,
    price: 9000,
    description: "Scaling, polishing and personalised home-care advice.",
  },
  whitening: {
    key: "whitening",
    name: "Teeth whitening",
    category: "aesthetic",
    duration: 60,
    buffer: 10,
    price: 25000,
    description: "In-office whitening session with protective gel.",
  },
  orthoConsult: {
    key: "orthoConsult",
    name: "Orthodontic consultation",
    category: "orthodontics",
    duration: 30,
    price: 0,
    description: "Braces or clear aligners? Assessment, photos and options.",
  },
  alignerCheck: {
    key: "alignerCheck",
    name: "Clear aligner check",
    category: "orthodontics",
    duration: 20,
    price: 4000,
    description: "Progress check and next set of aligners.",
  },
  implantConsult: {
    key: "implantConsult",
    name: "Implant consultation",
    category: "implants",
    duration: 40,
    price: null,
    description: "Evaluation with panoramic X-ray and personalised estimate.",
  },
  rootCanal: {
    key: "rootCanal",
    name: "Root canal treatment",
    category: "endodontics",
    duration: 75,
    buffer: 15,
    price: 35000,
    description: "Single-tooth endodontic treatment under local anaesthesia.",
  },
  kids: {
    key: "kids",
    name: "Children's visit",
    category: "pediatric",
    duration: 30,
    price: 4500,
    description: "Gentle first visit and prevention for children aged 3–14.",
  },
  emergency: {
    key: "emergency",
    name: "Dental emergency",
    category: "emergency",
    duration: 30,
    price: 8000,
    description: "Toothache, broken tooth or swelling: seen the same day when possible.",
  },
  extraction: {
    key: "extraction",
    name: "Wisdom tooth extraction",
    category: "surgery",
    duration: 60,
    buffer: 15,
    price: 18000,
    description: "Surgical extraction with post-operative check included.",
  },
  crownConsult: {
    key: "crownConsult",
    name: "Crowns & veneers consultation",
    category: "prosthetics",
    duration: 30,
    price: 0,
    description: "Assessment for crowns, bridges or veneers with digital scan.",
  },
};

type Window = [string, string]; // "09:00", "13:00"
type WeekPlan = Partial<Record<number, { location: string; windows: Window[] }[]>>;

type PractitionerSeed = {
  title: string;
  name: string;
  specialty: string;
  color: string;
  bio: string;
  languages?: string;
  services: string[];
  week: WeekPlan;
};

type OrgSeed = {
  slug: string;
  name: string;
  description: string;
  phone: string;
  email: string;
  website?: string;
  brandColor: string;
  settings?: Partial<OrgSettings["booking"]>;
  locations: { key: string; name: string; address: string; city: string; postalCode: string; phone: string; lat: number; lng: number; rooms: number }[];
  services: string[];
  practitioners: PractitionerSeed[];
  density: number; // share of free slots to fill
};

const day = (location: string, ...windows: Window[]) => [{ location, windows }];
const full = (location: string): { location: string; windows: Window[] }[] =>
  day(location, ["09:00", "13:00"], ["14:00", "18:30"]);

const ORGS: OrgSeed[] = [
  {
    slug: "studio-bianchi",
    name: "Studio Dentistico Bianchi",
    description:
      "Family-run dental practice since 1987 with offices in Milano Centro and Monza. Implants, orthodontics with clear aligners, hygiene and children's dentistry under one roof.",
    phone: "+39 000 101 1037",
    email: "info@studiobianchi.example",
    website: "https://studiobianchi.example",
    brandColor: "#0d9488",
    locations: [
      { key: "mi", name: "Milano Centro", address: "Via Torino 42", city: "Milano", postalCode: "20123", phone: "+39 000 101 1037", lat: 45.4612, lng: 9.1847, rooms: 3 },
      { key: "mb", name: "Monza", address: "Via Italia 18", city: "Monza", postalCode: "20900", phone: "+39 000 102 1074", lat: 45.5845, lng: 9.2744, rooms: 2 },
    ],
    services: ["firstVisit", "checkup", "cleaning", "whitening", "orthoConsult", "alignerCheck", "implantConsult", "rootCanal", "kids", "emergency"],
    practitioners: [
      {
        title: "Dr.",
        name: "Luca Bianchi",
        specialty: "Implantologist & general dentist",
        color: "#0d9488",
        bio: "Graduated in Dentistry at Università degli Studi di Milano, with a master's in implantology. Over 20 years of experience in guided implant surgery and full-mouth rehabilitation.",
        services: ["firstVisit", "checkup", "implantConsult", "emergency", "whitening"],
        week: { 1: full("mi"), 2: full("mb"), 3: full("mi"), 4: full("mb"), 5: day("mi", ["09:00", "13:00"]) },
      },
      {
        title: "Dr.",
        name: "Giulia Ferri",
        specialty: "Orthodontist",
        color: "#8b5cf6",
        bio: "Specialist in orthodontics (Università di Pavia). Clear aligners, fixed braces and interceptive orthodontics for children and adults.",
        languages: "Italiano, English, Français",
        services: ["orthoConsult", "alignerCheck", "kids", "firstVisit"],
        week: { 1: full("mi"), 3: full("mi"), 5: day("mb", ["09:00", "13:30"]) },
      },
      {
        title: "",
        name: "Sara Conti",
        specialty: "Dental hygienist",
        color: "#f59e0b",
        bio: "Registered dental hygienist focused on gentle, pain-free cleanings and prevention for the whole family.",
        services: ["cleaning", "whitening"],
        week: {
          1: day("mi", ["08:30", "12:30"]),
          2: day("mb", ["14:00", "19:00"]),
          3: day("mi", ["08:30", "12:30"]),
          4: day("mb", ["14:00", "19:00"]),
          5: day("mi", ["08:30", "12:30"], ["13:30", "17:00"]),
        },
      },
      {
        title: "Dr.",
        name: "Marco Rinaldi",
        specialty: "Endodontist",
        color: "#ef4444",
        bio: "Microscope-assisted root canal treatment and re-treatment. Member of the Italian Society of Endodontics.",
        services: ["rootCanal", "emergency", "checkup"],
        week: { 3: day("mi", ["14:00", "19:00"]), 4: day("mi", ["14:00", "19:00"]), 6: day("mi", ["09:00", "13:00"]) },
      },
    ],
    density: 0.5,
  },
  {
    slug: "roma-smile",
    name: "Roma Smile Clinic",
    description: "Modern clinic in Prati specialised in aesthetic dentistry and children's care. Evening appointments available.",
    phone: "+39 000 106 1222",
    email: "hello@romasmile.example",
    brandColor: "#6366f1",
    settings: { requireApproval: true },
    locations: [
      { key: "rm", name: "Roma Prati", address: "Via Cola di Rienzo 120", city: "Roma", postalCode: "00192", phone: "+39 000 106 1222", lat: 41.9067, lng: 12.4635, rooms: 3 },
    ],
    services: ["firstVisit", "cleaning", "whitening", "kids", "crownConsult", "emergency"],
    practitioners: [
      {
        title: "Dr.",
        name: "Alessandro Moretti",
        specialty: "Aesthetic dentist",
        color: "#6366f1",
        bio: "Veneers, whitening and smile design with digital previews.",
        services: ["firstVisit", "whitening", "crownConsult", "emergency"],
        week: { 1: day("rm", ["10:00", "13:00"], ["14:00", "20:00"]), 2: full("rm"), 3: day("rm", ["10:00", "13:00"], ["14:00", "20:00"]), 4: full("rm") },
      },
      {
        title: "Dr.",
        name: "Chiara Romano",
        specialty: "Pediatric dentist",
        color: "#ec4899",
        bio: "Paediatric dentistry with a playful, fear-free approach. Kids leave with a smile (and a sticker).",
        services: ["kids", "firstVisit"],
        week: { 2: day("rm", ["14:00", "19:00"]), 4: day("rm", ["14:00", "19:00"]), 6: day("rm", ["09:00", "13:00"]) },
      },
      {
        title: "",
        name: "Elena Greco",
        specialty: "Dental hygienist",
        color: "#14b8a6",
        bio: "Hygiene and prevention, including air-flow polishing.",
        services: ["cleaning"],
        week: { 1: full("rm"), 3: full("rm"), 5: full("rm") },
      },
    ],
    density: 0.35,
  },
  {
    slug: "centro-torino",
    name: "Centro Odontoiatrico Torino",
    description: "Oral surgery and orthodontics centre in Crocetta with in-house 3D imaging.",
    phone: "+39 000 100 1000",
    email: "segreteria@centrotorino.example",
    brandColor: "#0ea5e9",
    locations: [
      { key: "to", name: "Torino Crocetta", address: "Corso Re Umberto 75", city: "Torino", postalCode: "10128", phone: "+39 000 100 1000", lat: 45.0581, lng: 7.6741, rooms: 2 },
    ],
    services: ["firstVisit", "extraction", "implantConsult", "orthoConsult", "alignerCheck", "emergency"],
    practitioners: [
      {
        title: "Dr.",
        name: "Paolo Esposito",
        specialty: "Oral surgeon",
        color: "#0ea5e9",
        bio: "Oral surgery, wisdom teeth and bone grafting. Sedation available on request.",
        services: ["firstVisit", "extraction", "implantConsult", "emergency"],
        week: { 1: full("to"), 2: full("to"), 4: full("to") },
      },
      {
        title: "Dr.",
        name: "Francesca Marino",
        specialty: "Orthodontist",
        color: "#a855f7",
        bio: "Clear aligners for teens and adults, lingual braces.",
        services: ["orthoConsult", "alignerCheck"],
        week: { 3: full("to"), 5: full("to") },
      },
    ],
    density: 0.4,
  },
  {
    slug: "studio-ricci",
    name: "Studio Dentistico Ricci",
    description: "Small, personal practice near Piazza Maggiore. One dentist, unhurried visits.",
    phone: "+39 000 103 1111",
    email: "studio@ricci.example",
    brandColor: "#f59e0b",
    locations: [
      { key: "bo", name: "Bologna Centro", address: "Via d'Azeglio 31", city: "Bologna", postalCode: "40123", phone: "+39 000 103 1111", lat: 44.4903, lng: 11.3412, rooms: 1 },
    ],
    services: ["firstVisit", "checkup", "cleaning", "rootCanal", "emergency"],
    practitioners: [
      {
        title: "Dr.",
        name: "Andrea Ricci",
        specialty: "General dentist",
        color: "#f59e0b",
        bio: "General and conservative dentistry, root canals and prevention.",
        services: ["firstVisit", "checkup", "cleaning", "rootCanal", "emergency"],
        week: { 1: full("bo"), 2: full("bo"), 3: full("bo"), 4: full("bo"), 5: day("bo", ["09:00", "13:00"]) },
      },
    ],
    density: 0.6,
  },
  {
    slug: "dental-firenze",
    name: "Dental Firenze",
    description: "Two offices in Florence and Prato. Implants, crowns and full-arch restorations.",
    phone: "+39 000 104 1148",
    email: "info@dentalfirenze.example",
    brandColor: "#e11d48",
    locations: [
      { key: "fi", name: "Firenze Centro", address: "Via de' Cerretani 9", city: "Firenze", postalCode: "50123", phone: "+39 000 104 1148", lat: 43.7731, lng: 11.2526, rooms: 2 },
      { key: "po", name: "Prato", address: "Viale Vittorio Veneto 44", city: "Prato", postalCode: "59100", phone: "+39 000 105 1185", lat: 43.8803, lng: 11.0983, rooms: 1 },
    ],
    services: ["firstVisit", "implantConsult", "crownConsult", "cleaning", "emergency"],
    practitioners: [
      {
        title: "Dr.",
        name: "Valentina Galli",
        specialty: "General dentist",
        color: "#e11d48",
        bio: "General dentistry and hygiene coordination.",
        services: ["firstVisit", "cleaning", "emergency"],
        week: { 1: full("fi"), 2: full("po"), 3: full("fi"), 4: full("po") },
      },
      {
        title: "Dr.",
        name: "Matteo Bruno",
        specialty: "Implantologist",
        color: "#0891b2",
        bio: "Implants and prosthetics with digital workflow (intraoral scanning, same-day crowns).",
        services: ["implantConsult", "crownConsult", "firstVisit"],
        week: { 2: full("fi"), 4: full("fi"), 5: full("po") },
      },
    ],
    density: 0.3,
  },
  {
    slug: "sorrisi-napoli",
    name: "Sorrisi Napoli",
    description: "Practice in Chiaia focused on prevention, hygiene and family dentistry.",
    phone: "+39 000 107 1259",
    email: "ciao@sorrisinapoli.example",
    brandColor: "#16a34a",
    locations: [
      { key: "na", name: "Napoli Chiaia", address: "Via dei Mille 16", city: "Napoli", postalCode: "80121", phone: "+39 000 107 1259", lat: 40.8366, lng: 14.2392, rooms: 2 },
    ],
    services: ["firstVisit", "checkup", "cleaning", "kids", "emergency", "whitening"],
    practitioners: [
      {
        title: "Dr.",
        name: "Giuseppe Russo",
        specialty: "General dentist",
        color: "#16a34a",
        bio: "Family dentistry, prevention and minimally invasive treatments.",
        services: ["firstVisit", "checkup", "kids", "emergency", "whitening"],
        week: { 1: full("na"), 2: full("na"), 3: full("na"), 4: full("na"), 5: full("na") },
      },
      {
        title: "",
        name: "Rosa Esposito",
        specialty: "Dental hygienist",
        color: "#84cc16",
        bio: "Hygiene for adults and children, sealants and fluoride treatments.",
        services: ["cleaning"],
        week: { 2: full("na"), 4: full("na") },
      },
    ],
    density: 0.45,
  },
];

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** The practice number patients reply to, in the unassigned +39 000 range like every seeded number. */
const PRACTICE_INBOUND = fakePhone(212345);

let phoneCounter = 1000;
function makePatient(orgId: string): typeof patients.$inferInsert {
  const firstName = pick(FIRST);
  const lastName = pick(LAST);
  const english = chance(0.12);
  const channel = chance(0.25) ? "whatsapp" : chance(0.1) ? "email" : "sms";
  phoneCounter += Math.floor(rand() * 900) + 17;
  return {
    id: newId(),
    orgId,
    firstName,
    lastName,
    email: `${slugify(firstName)}.${slugify(lastName)}${Math.floor(rand() * 90 + 10)}@example.com`,
    phone: fakePhone(phoneCounter),
    birthDate: `${1950 + Math.floor(rand() * 60)}-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`,
    locale: english ? "en" : "it",
    preferredChannel: channel,
    emailOptIn: true,
    smsOptIn: true,
  };
}

async function main() {
  const refusal = demoSeedRefusal(process.env);
  if (refusal) {
    console.error(`Refusing to seed demo data: ${refusal}. Set ALLOW_DEMO_SEED=1 if this really is a demo database.`);
    process.exit(1);
  }
  const now = new Date();
  console.log(`Seeding demo data around ${today}…`);

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  // Reserved .example addresses: sign-in alerts and resets a public demo sends can't reach anyone.
  const owner = { id: newId(), email: DEMO_OWNER_EMAIL, name: "Elisa Bianchi", passwordHash };
  const reception = { id: newId(), email: DEMO_RECEPTION_EMAIL, name: "Paola Verdi", passwordHash };
  await db.insert(users).values([owner, reception]);

  const seedCtx: SeedContext = {
    db,
    now,
    orgIds: [],
    practitionerIds: {},
    serviceIds: {},
    locationIds: {},
    patientIds: {},
    appointmentIds: {},
  };

  for (const [orgIndex, o] of ORGS.entries()) {
    const orgId = newId();
    seedCtx.orgIds.push(orgId);
    const settings: OrgSettings = {
      ...DEFAULT_SETTINGS,
      booking: { ...DEFAULT_SETTINGS.booking, ...(o.settings ?? {}) },
      // Demo practices: WhatsApp on so the flow can be tried; MFA optional (shown as a warning).
      privacy: { ...DEFAULT_SETTINGS.privacy, whatsappEnabled: true, requireMfa: false },
    };
    await db.insert(organizations).values({
      id: orgId,
      slug: o.slug,
      name: o.name,
      description: o.description,
      phone: o.phone,
      email: o.email,
      website: o.website ?? null,
      brandColor: o.brandColor,
      timezone: TZ,
      settings,
      isDemo: true,
      emailVerifiedAt: now,
      legalName: `${o.name} S.r.l.`,
      privacyEmail: o.email,
    });

    if (orgIndex === 0) {
      await db.insert(memberships).values([
        { userId: owner.id, orgId, role: "owner" },
        { userId: reception.id, orgId, role: "reception" },
      ]);
    } else if (o.slug === "roma-smile") {
      await db.insert(memberships).values({ userId: owner.id, orgId, role: "admin" });
    }

    const locIds: Record<string, string> = {};
    for (const l of o.locations) {
      const id = newId();
      locIds[l.key] = id;
      await db.insert(locations).values({
        id,
        orgId,
        name: l.name,
        address: l.address,
        city: l.city,
        postalCode: l.postalCode,
        phone: l.phone,
        lat: l.lat,
        lng: l.lng,
        timezone: TZ,
      });
      await db
        .insert(rooms)
        .values(Array.from({ length: l.rooms }, (_, i) => ({ id: newId(), locationId: id, name: `Chair ${i + 1}` })));
    }

    const svcIds: Record<string, string> = {};
    for (const [i, key] of o.services.entries()) {
      const s = SERVICE_LIBRARY[key];
      const id = newId();
      svcIds[key] = id;
      await db.insert(services).values({
        id,
        orgId,
        name: s.name,
        category: s.category,
        description: s.description,
        durationMinutes: s.duration,
        bufferMinutes: s.buffer ?? 0,
        priceCents: s.price,
        sortOrder: i,
      });
    }

    const practitionerIds: string[] = [];
    for (const p of o.practitioners) {
      const id = newId();
      practitionerIds.push(id);
      await db.insert(practitioners).values({
        id,
        orgId,
        slug: slugify(p.name),
        title: p.title,
        name: p.name,
        specialty: p.specialty,
        bio: p.bio,
        languages: p.languages ?? "Italiano, English",
        spokenLanguages: parseSpokenLanguages(p.languages ?? "Italiano, English"),
        color: p.color,
        icsToken: `h:${id}`,
        icsTokenHash: sha256(newToken()),
        publicProfile: true,
        profileApprovedAt: now,
      });
      await db
        .insert(practitionerServices)
        .values(p.services.filter((k) => svcIds[k]).map((k) => ({ practitionerId: id, serviceId: svcIds[k] })));
      const scheduleRows = Object.entries(p.week).flatMap(([weekday, blocks]) =>
        (blocks ?? []).flatMap((b) =>
          b.windows.map(([start, end]) => ({
            id: newId(),
            practitionerId: id,
            locationId: locIds[b.location],
            weekday: Number(weekday),
            startMinute: toMin(start),
            endMinute: toMin(end),
          })),
        ),
      );
      if (scheduleRows.length) await db.insert(schedules).values(scheduleRows);
    }

    // Patients
    const patientRows = Array.from({ length: orgIndex === 0 ? 70 : 25 }, () => makePatient(orgId));
    await db.insert(patients).values(patientRows);
    const patientList = patientRows as Patient[];
    seedCtx.locationIds[orgId] = Object.values(locIds);
    seedCtx.serviceIds[orgId] = Object.values(svcIds);
    seedCtx.practitionerIds[orgId] = practitionerIds;
    seedCtx.patientIds[orgId] = patientList.map((p) => p.id);
    seedCtx.appointmentIds[orgId] = [];

    // Time off examples for the flagship practice
    if (orgIndex === 0) {
      const ferri = practitionerIds[1];
      const conf = addDays(today, 15);
      await db.insert(timeOff).values([
        {
          id: newId(),
          orgId,
          practitionerId: ferri,
          startsAt: zonedToUtc(conf, 0, TZ),
          endsAt: zonedToUtc(addDays(conf, 3), 0, TZ),
          reason: "Orthodontics congress (Rome)",
        },
        {
          id: newId(),
          orgId,
          locationId: locIds.mb,
          startsAt: zonedToUtc(addDays(today, 9), 14 * 60, TZ),
          endsAt: zonedToUtc(addDays(today, 9), 19 * 60, TZ),
          reason: "Monza office: equipment maintenance",
        },
      ]);
    }

    // ---------- calendar: fill slots from 21 days ago to 21 days ahead ----------
    const from = addDays(today, -21);
    const days = 42;
    const created: Appointment[] = [];
    for (const key of o.services) {
      const serviceId = svcIds[key];
      const ctx = await loadAvailabilityContext({ orgId, serviceId, ...rangeForDates(from, days, TZ) });
      if (!ctx) continue;
      // Each service gets a share of the density so the calendar has a realistic mix.
      const share = o.density / Math.max(1, o.services.length / 2.2);
      const slots = findSlots(ctx, { fromDate: from, days, enforcePolicy: false, stepMinutes: 15, now });
      for (const slot of slots) {
        if (!chance(share / 3)) continue;
        // Re-check against appointments created in this loop for other services.
        const busy = created.some(
          (a) =>
            (a.practitionerId === slot.practitionerId || (slot.roomId && a.roomId === slot.roomId)) &&
            a.startsAt.getTime() < slot.end.getTime() + ctx.service.bufferMinutes * 60_000 &&
            slot.start.getTime() < a.blockedUntil.getTime(),
        );
        if (busy) continue;
        const patient = pick(patientList);
        const past = slot.end.getTime() < now.getTime();
        const status: Appointment["status"] = past
          ? chance(0.86)
            ? "completed"
            : chance(0.5)
              ? "no_show"
              : "cancelled"
          : chance(0.06)
            ? "cancelled"
            : o.settings?.requireApproval && chance(0.15)
              ? "requested"
              : "scheduled";
        const hoursAhead = (slot.start.getTime() - now.getTime()) / 3_600_000;
        const confirmed =
          status === "completed" || (status === "scheduled" && (hoursAhead < 48 ? chance(0.7) : chance(0.2)));
        const confirmedVia = confirmed ? pick(["sms", "sms", "whatsapp", "email", "web", "staff"]) : null;
        const createdAt = new Date(slot.start.getTime() - (2 + Math.floor(rand() * 20)) * 86_400_000);
        const id = newId();
        const link = issueManageToken();
        const row: Appointment = {
          id,
          orgId,
          locationId: slot.locationId,
          practitionerId: slot.practitionerId,
          roomId: slot.roomId,
          serviceId,
          patientId: patient.id,
          startsAt: slot.start,
          endsAt: slot.end,
          blockedUntil: new Date(slot.end.getTime() + ctx.service.bufferMinutes * 60_000),
          status,
          confirmation: status === "cancelled" ? "declined" : confirmed ? "confirmed" : "pending",
          confirmedAt: confirmed ? new Date(Math.min(now.getTime(), slot.start.getTime() - 20 * 3_600_000)) : null,
          confirmedVia,
          source: pick(["online", "online", "online", "staff", "staff", "widget"]),
          isNewPatient: key === "firstVisit",
          patientNote: chance(0.15) ? pick(["Sensitive tooth on the lower left.", "Prefer morning appointments.", "Ho un po' di ansia dal dentista.", "Second opinion on an implant estimate."]) : null,
          internalNote: null,
          manageToken: `h:${id}`,
          manageTokenHash: link.hash,
          manageTokenEnc: link.token,
          processingContext: "practice",
          bookedFor: "self",
          bookedByName: null,
          bookedByPhone: null,
          bookedByEmail: null,
          noticeVersion: null,
          noticeLocale: null,
          minorFlag: false,
          riskLevel: null,
          riskReasons: [],
          riskComputedAt: null,
          fundId: null,
          rebookOfferStartsAt: null,
          rebookCallStartsAt: null,
          cancelledAt: status === "cancelled" ? new Date(slot.start.getTime() - 30 * 3_600_000) : null,
          cancelledBy: status === "cancelled" ? (chance(0.8) ? "patient" : "staff") : null,
          cancelReason: status === "cancelled" ? pick(["Replied NO via SMS", "Work commitment", "Feeling unwell", null]) : null,
          rescheduledFromId: null,
          needsAttention: false,
          createdAt,
          updatedAt: createdAt,
        };
        if (status !== "cancelled") {
          created.push(row);
          ctx.appointments.push(row);
        }
        await db.insert(appointments).values(row);
        seedCtx.appointmentIds[orgId].push(id);
        if (status === "no_show") {
          patient.noShowCount += 1;
        }
      }
    }
    for (const p of patientList.filter((p) => p.noShowCount > 0)) {
      await db.update(patients).set({ noShowCount: p.noShowCount }).where(eq(patients.id, p.id));
    }

    // Reminders for upcoming visits + message history for the last 48h
    const upcoming = created.filter((a) => a.status === "scheduled" && a.startsAt > now);
    for (const a of upcoming) {
      await scheduleReminders(db, a, settings, now);
      const hoursAhead = (a.startsAt.getTime() - now.getTime()) / 3_600_000;
      if (hoursAhead > 48) continue;
      const details = await getAppointmentDetails({ id: a.id });
      if (!details) continue;
      const data = templateData(details);
      const sentAt = new Date(a.startsAt.getTime() - 48 * 3_600_000);
      const email = templates.reminderEmail(data, true);
      const msgId = newId();
      await db.insert(messages).values({
        id: msgId,
        orgId,
        appointmentId: a.id,
        patientId: a.patientId,
        channel: "email",
        direction: "outbound",
        to: details.patient.email!,
        subject: email.subject,
        body: email.text,
        html: email.html,
        status: "sent",
        provider: "smtp",
        createdAt: sentAt,
      });
      await db.insert(reminders).values({
        id: newId(),
        appointmentId: a.id,
        kind: "reminder",
        channel: "email",
        askConfirmation: true,
        sendAt: sentAt,
        status: "sent",
        sentAt,
        attempts: 1,
        messageId: msgId,
      });
      if (hoursAhead < 24 && details.patient.preferredChannel !== "email") {
        const channel = details.patient.preferredChannel === "whatsapp" ? "whatsapp" : "sms";
        const smsAt = new Date(a.startsAt.getTime() - 24 * 3_600_000);
        await db.insert(messages).values({
          id: newId(),
          orgId,
          appointmentId: a.id,
          patientId: a.patientId,
          channel,
          direction: "outbound",
          to: details.patient.phone!,
          body: templates.reminderSms(data, a.confirmation === "pending" || chance(0.5)),
          status: "delivered",
          provider: "twilio",
          createdAt: smsAt,
        });
        if (a.confirmation === "confirmed" && (a.confirmedVia === "sms" || a.confirmedVia === "whatsapp")) {
          const replyAt = new Date(smsAt.getTime() + (3 + Math.floor(rand() * 90)) * 60_000);
          await db.insert(messages).values([
            {
              id: newId(),
              orgId,
              appointmentId: a.id,
              patientId: a.patientId,
              channel,
              direction: "inbound",
              to: PRACTICE_INBOUND,
              from: details.patient.phone,
              body: pick(details.patient.locale === "en" ? ["Yes", "YES", "yes thanks 👍"] : ["SI", "Si grazie", "sì", "Confermo, grazie!"]),
              status: "received",
              provider: "twilio",
              intent: "confirm",
              createdAt: replyAt,
            },
            {
              id: newId(),
              orgId,
              appointmentId: a.id,
              patientId: a.patientId,
              channel,
              direction: "outbound",
              to: details.patient.phone!,
              body: templates.reply.confirmed(data),
              status: "delivered",
              provider: "twilio",
              createdAt: new Date(replyAt.getTime() + 2000),
            },
          ]);
        }
      }
    }

    // A couple of replies that need a human (flagship only)
    if (orgIndex === 0) {
      const pending = upcoming.filter((a) => a.confirmation === "pending").slice(0, 2);
      const texts = ["Posso venire mezz'ora più tardi?", "Devo portare le lastre di prima?"];
      for (const [i, a] of pending.entries()) {
        const p = patientList.find((x) => x.id === a.patientId)!;
        await db.update(appointments).set({ needsAttention: true }).where(eq(appointments.id, a.id));
        await db.insert(messages).values({
          id: newId(),
          orgId,
          appointmentId: a.id,
          patientId: a.patientId,
          channel: "sms",
          direction: "inbound",
          to: PRACTICE_INBOUND,
          from: p.phone,
          body: texts[i],
          status: "received",
          provider: "twilio",
          intent: "unknown",
          createdAt: new Date(now.getTime() - (i + 1) * 47 * 60_000),
        });
      }

      // Waitlist entries
      const wlPatients = patientList.slice(-4);
      await db.insert(waitlist).values([
        {
          id: newId(),
          orgId,
          patientId: wlPatients[0].id,
          serviceId: svcIds.cleaning,
          earliestDate: today,
          latestDate: addDays(today, 10),
          partOfDay: "morning",
          note: "Can come at short notice, works nearby.",
        },
        {
          id: newId(),
          orgId,
          patientId: wlPatients[1].id,
          serviceId: svcIds.orthoConsult,
          practitionerId: practitionerIds[1],
          earliestDate: today,
          latestDate: addDays(today, 14),
          partOfDay: "any",
        },
        {
          id: newId(),
          orgId,
          patientId: wlPatients[2].id,
          serviceId: svcIds.implantConsult,
          locationId: locIds.mb,
          earliestDate: addDays(today, 2),
          latestDate: addDays(today, 20),
          partOfDay: "afternoon",
        },
      ]);

      // Demo API key: random, stored as a hash, printed once here and never again.
      const secret = `sk_${newToken()}`;
      await db.insert(apiKeys).values({
        id: newId(),
        orgId,
        name: "Demo integration",
        prefix: secret.slice(0, 10),
        keyHash: sha256(secret),
        expiresAt: new Date(now.getTime() + 365 * 86_400_000),
        createdByUserId: owner.id,
      });
      console.log(`  demo API key for ${o.name} (shown once): ${secret}`);
    }

    // Verified reviews from completed visits
    const completed = created.filter((a) => a.status === "completed");
    const reviewRows = completed
      .filter(() => chance(orgIndex === 0 ? 0.3 : 0.45))
      .map((a) => {
        const p = patientList.find((x) => x.id === a.patientId)!;
        const rating = chance(0.75) ? 5 : chance(0.7) ? 4 : 3;
        return {
          id: newId(),
          orgId,
          practitionerId: a.practitionerId,
          appointmentId: a.id,
          rating,
          comment: chance(0.85) ? pick(REVIEW_COMMENTS[p.locale === "it" ? "it" : "en"]) : null,
          authorName: `${p.firstName} ${p.lastName[0]}.`,
          status: "published" as const,
          authorDisplay: "first_initial" as const,
          publishedAt: new Date(a.endsAt.getTime() + 5 * 3_600_000),
          createdAt: new Date(a.endsAt.getTime() + 5 * 3_600_000),
          reply: chance(0.2) ? "Grazie mille per la fiducia, a presto!" : null,
        };
      });
    if (reviewRows.length) await db.insert(reviews).values(reviewRows);

    console.log(
      `  ${o.name}: ${o.locations.length} office(s), ${o.practitioners.length} practitioners, ${created.length} appointments, ${reviewRows.length} reviews`,
    );
  }

  // Package seeds: each adds its own demo data on top of the core seed.
  await seedMarketplace(seedCtx);
  await seedCare(seedCtx);
  await seedPrivacy(seedCtx);

  console.log(`\nDemo logins (password: ${DEMO_PASSWORD})`);
  console.log(`  ${DEMO_OWNER_EMAIL}       owner of Studio Dentistico Bianchi, admin of Roma Smile Clinic`);
  console.log(`  ${DEMO_RECEPTION_EMAIL}  front desk at Studio Dentistico Bianchi`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
