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
  expiresAt: Date;
  createdAt: Date;
};

const aadFor = (sessionId: string) => `patient_sessions:${sessionId}`;

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
  const sealed = encrypt(`${contact.kind}:${value}`, aadFor(id));
  return { session: { id, contact: { kind: contact.kind, value }, contactHash: hash, expiresAt, createdAt: now }, cookieValue: `${token}.${sealed}` };
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
  let plain: string;
  try {
    plain = decrypt(sealed, aadFor(id));
  } catch {
    return null;
  }
  const sep = plain.indexOf(":");
  const kind = plain.slice(0, sep);
  const value = plain.slice(sep + 1);
  if ((kind !== "phone" && kind !== "email") || kind !== row.contactType) return null;
  if (contactHash(kind, value) !== row.contactHash) return null;
  return { id, contact: { kind, value }, contactHash: row.contactHash, expiresAt: row.expiresAt, createdAt: row.createdAt };
}

/** The cookie as Next's cookies().set() takes it. */
export function patientSessionCookie(cookieValue: string, expiresAt: Date) {
  return {
    name: patientSessionCookieName(),
    value: cookieValue,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor(PATIENT_SESSION_TTL_MS / 1000)),
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
