import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { patientSessions } from "@/db/schema";
import { APP_URL } from "../config";
import { contactHash, normalizeContact, type ContactKind } from "../contact";
import { decrypt, encrypt, isEncrypted } from "../crypto";
import { newToken, sha256 } from "../ids";
import { clientIpHash } from "../rate-limit";

/**
 * Account-less sessions for the patient privacy center, opened with a one-time code sent to a
 * phone number or email address (src/lib/otp.ts).
 *
 * - The cookie is __Host-sorriso_pc on https (Secure, Path=/, no Domain) and sorriso_pc on plain
 *   http development; HttpOnly, SameSite=Lax, 30 minutes from sign-in, never extended.
 * - patient_sessions stores only the sha256 of the cookie token, an HMAC of the verified contact
 *   and an HMAC of the IP: the database never holds the contact in clear for a session.
 * - The privacy center must look the contact up in patients.phone / email, so the cookie also
 *   carries the contact itself, encrypted with the server key and bound to this session (AES-GCM,
 *   AAD = session id). Reading it back checks it against the stored HMAC, so a cookie can't be
 *   pointed at someone else's contact.
 * - The same sealed part lists the records this session unlocked with the identity challenge
 *   (surname and birth date, privacy-center.ts answerChallenge): a contact shared by two adults
 *   keeps asking for the challenge, so the unlock has to live with the session. Sealed and bound to
 *   the session id, it can't be forged or carried over to another session; it ends with the session.
 *
 * Writes go through the root db: don't call these inside db.transaction().
 */

export const PATIENT_SESSION_TTL_MS = 30 * 60_000;

const SECURE_COOKIE = "__Host-sorriso_pc";
const PLAIN_COOKIE = "sorriso_pc";

/** Both names, for the cookie notice and the third-party/cookie check. */
export const PATIENT_SESSION_COOKIE_NAMES = [SECURE_COOKIE, PLAIN_COOKIE] as const;

/** The cookie's name: the __Host- prefix needs https. */
export function patientSessionCookieName(appUrl: string = APP_URL): string {
  return appUrl.startsWith("https://") ? SECURE_COOKIE : PLAIN_COOKIE;
}

function cookieSecure(): boolean {
  return APP_URL.startsWith("https://") || process.env.NODE_ENV === "production";
}

export type VerifiedContact = { kind: ContactKind; value: string };

export type PatientSession = {
  /** sha256 of the cookie token (patient_sessions.id); also the audit actor id. */
  id: string;
  /** The verified contact, normalised (E.164 phone or lower-case email). */
  contact: VerifiedContact;
  contactHash: string;
  /** Records unlocked in this session by the identity challenge (patient ids). */
  unlocked: readonly string[];
  expiresAt: Date;
  createdAt: Date;
};

const aadFor = (sessionId: string) => `patient_sessions:${sessionId}`;

/** More than any family needs; keeps the cookie small. */
const MAX_UNLOCKED = 40;

type Sealed = { contact: VerifiedContact; unlocked: string[] };

function seal(sessionId: string, contact: VerifiedContact, unlocked: readonly string[]): string {
  return encrypt(JSON.stringify({ k: contact.kind, v: contact.value, u: unlocked.slice(-MAX_UNLOCKED) }), aadFor(sessionId));
}

/** The sealed part's plaintext: JSON, or the first format's bare "kind:value". */
function unseal(plain: string): Sealed | null {
  if (!plain.startsWith("{")) {
    const sep = plain.indexOf(":");
    const kind = plain.slice(0, sep);
    if (kind !== "phone" && kind !== "email") return null;
    return { contact: { kind, value: plain.slice(sep + 1) }, unlocked: [] };
  }
  try {
    const o = JSON.parse(plain) as { k?: unknown; v?: unknown; u?: unknown };
    if ((o.k !== "phone" && o.k !== "email") || typeof o.v !== "string") return null;
    const unlocked = Array.isArray(o.u) ? o.u.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64) : [];
    return { contact: { kind: o.k, value: o.v }, unlocked };
  } catch {
    return null;
  }
}

/**
 * Open a session for a contact just verified with a one-time code. Returns the session and the
 * cookie value; setting the cookie is the caller's job (startPatientSession does both).
 */
export async function createPatientSession(
  contact: VerifiedContact,
  opts: { headers?: Headers; now?: Date } = {},
): Promise<{ session: PatientSession; cookieValue: string }> {
  const now = opts.now ?? new Date();
  const value = normalizeContact(contact.kind, contact.value);
  const hash = value ? contactHash(contact.kind, value) : null;
  if (!value || !hash) throw new TypeError(`createPatientSession: invalid ${contact.kind}`);
  const token = newToken();
  const id = sha256(token);
  const expiresAt = new Date(now.getTime() + PATIENT_SESSION_TTL_MS);
  await db.insert(patientSessions).values({
    id,
    contactHash: hash,
    contactType: contact.kind,
    expiresAt,
    ipHash: clientIpHash(opts.headers),
    createdAt: now,
  });
  const verified: VerifiedContact = { kind: contact.kind, value };
  const sealed = seal(id, verified, []);
  return { session: { id, contact: verified, contactHash: hash, unlocked: [], expiresAt, createdAt: now }, cookieValue: `${token}.${sealed}` };
}

/** The session behind a cookie value, or null when it is unknown, expired, or tampered with. */
export async function resolvePatientSession(cookieValue: string | null | undefined, now: Date = new Date()): Promise<PatientSession | null> {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  const token = cookieValue.slice(0, dot);
  const sealed = cookieValue.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || !isEncrypted(sealed)) return null;
  const id = sha256(token);
  const [row] = await db
    .select()
    .from(patientSessions)
    .where(and(eq(patientSessions.id, id), gt(patientSessions.expiresAt, now)));
  if (!row) return null;
  let opened: Sealed | null;
  try {
    opened = unseal(decrypt(sealed, aadFor(id)));
  } catch {
    return null;
  }
  if (!opened) return null;
  const { contact, unlocked } = opened;
  if (contact.kind !== row.contactType || contactHash(contact.kind, contact.value) !== row.contactHash) return null;
  return { id, contact, contactHash: row.contactHash, unlocked, expiresAt: row.expiresAt, createdAt: row.createdAt };
}

/**
 * The cookie value of the same session with one more record unlocked (same token, so the same
 * session row and expiry). Null when the cookie is not a live session.
 */
export async function cookieWithUnlocked(
  cookieValue: string | null | undefined,
  patientId: string,
  now: Date = new Date(),
): Promise<{ session: PatientSession; cookieValue: string } | null> {
  const session = await resolvePatientSession(cookieValue, now);
  if (!session || !cookieValue) return null;
  if (session.unlocked.includes(patientId)) return { session, cookieValue };
  const unlocked = [...session.unlocked, patientId].slice(-MAX_UNLOCKED);
  const token = cookieValue.slice(0, cookieValue.indexOf("."));
  return { session: { ...session, unlocked }, cookieValue: `${token}.${seal(session.id, session.contact, unlocked)}` };
}

/**
 * The cookie as Next's cookies().set() takes it. Pass `now` when re-setting the cookie of a running
 * session: its max-age is then what is left of the 30 minutes, never a fresh 30.
 */
export function patientSessionCookie(cookieValue: string, expiresAt: Date, now?: Date) {
  const left = now ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000) : Math.floor(PATIENT_SESSION_TTL_MS / 1000);
  return {
    name: patientSessionCookieName(),
    value: cookieValue,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    expires: expiresAt,
    maxAge: Math.max(0, Math.min(left, Math.floor(PATIENT_SESSION_TTL_MS / 1000))),
  };
}

/** The current request's privacy-center session (server components, actions, route handlers). */
export async function getPatientSession(now: Date = new Date()): Promise<PatientSession | null> {
  const jar = await cookies();
  for (const name of PATIENT_SESSION_COOKIE_NAMES) {
    const session = await resolvePatientSession(jar.get(name)?.value, now);
    if (session) return session;
  }
  return null;
}

/**
 * Remember, for the rest of the current session, that it unlocked this record with the identity
 * challenge (server actions only: it re-sets the cookie). Returns false without a live session.
 */
export async function rememberUnlocked(patientId: string, now: Date = new Date()): Promise<boolean> {
  const jar = await cookies();
  for (const name of PATIENT_SESSION_COOKIE_NAMES) {
    const next = await cookieWithUnlocked(jar.get(name)?.value, patientId, now);
    if (!next) continue;
    jar.set({ ...patientSessionCookie(next.cookieValue, next.session.expiresAt, now), name });
    return true;
  }
  return false;
}

/** Open a session and set its cookie (server actions and route handlers only). */
export async function startPatientSession(contact: VerifiedContact, opts: { headers?: Headers; now?: Date } = {}): Promise<PatientSession> {
  const { session, cookieValue } = await createPatientSession(contact, opts);
  (await cookies()).set(patientSessionCookie(cookieValue, session.expiresAt));
  return session;
}

/** Sign out: delete the session row and the cookie. */
export async function endPatientSession(session: Pick<PatientSession, "id"> | null): Promise<void> {
  if (session) await db.delete(patientSessions).where(eq(patientSessions.id, session.id));
  const jar = await cookies();
  // Expire it with the same attributes it was set with: browsers ignore a __Host- cookie without Secure.
  for (const name of PATIENT_SESSION_COOKIE_NAMES) {
    if (jar.get(name)) jar.set({ ...patientSessionCookie("", new Date(0)), name, maxAge: 0 });
  }
}

/**
 * Move the current session to another contact just proven with a code (the patient corrected the
 * very contact they signed in with): the old row goes, a new session and cookie replace it.
 */
export async function replacePatientSession(
  old: Pick<PatientSession, "id">,
  contact: VerifiedContact,
  opts: { headers?: Headers; now?: Date } = {},
): Promise<PatientSession> {
  await db.delete(patientSessions).where(eq(patientSessions.id, old.id));
  return startPatientSession(contact, opts);
}
