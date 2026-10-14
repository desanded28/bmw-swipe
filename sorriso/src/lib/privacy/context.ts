import { timingSafeEqual } from "node:crypto";
import type { Appointment, ProcessingContext } from "@/db/schema";
import { hmac } from "../crypto";

/**
 * Who is controller for a booking is decided on the server, from where the booking started —
 * never from a field the browser sends.
 *
 * - 'practice': staff, a partner API key, the embedded widget, or a link the practice itself
 *   published (it carries signPracticeRef(orgId)). The practice is controller, Sorriso its
 *   processor, and care data rests on Art. 9(2)(h).
 * - 'marketplace': everything else started on Sorriso-hosted pages — search, the clinic and
 *   practitioner pages reached from search or Google. Sorriso brought the patient in, so it is
 *   an independent controller and needs explicit Art. 9(2)(a) consent.
 *
 * When in doubt the answer is 'marketplace': asking for a consent that wasn't needed is
 * harmless; processing health data as a controller without one is not.
 *
 * `source` decides only for values the server sets itself ('staff', and 'api' with a key). The
 * public booking route accepts 'online' | 'widget' from the request body, so 'widget' is a
 * display label: the embed counts only through `embedded` or a valid practice ref.
 */

export type BookingSource = Appointment["source"];

export type ContextInput = {
  /** Where the booking says it came from. Browser-supplied for the public route: never trusted here. */
  source: BookingSource;
  /** Authenticated with a practice's API key. */
  viaApiKey: boolean;
  /**
   * The request came from the embed route (/[locale]/embed/...), as established by the server
   * (the route itself, or a practice ref the embed page signed) — not a body field.
   */
  embedded: boolean;
  /** The practice-signed marker from a practice-published link (?ref=...). */
  practiceRef?: string | null;
  orgId: string;
  /**
   * The context of the booking this one continues (waitlist offer, reschedule): the patient
   * keeps the controller they booked with.
   */
  inherit?: ProcessingContext | null;
};

export function processingContextFor(i: ContextInput): ProcessingContext {
  if (i.source === "staff" || i.viaApiKey) return "practice";
  if (i.inherit) return i.inherit;
  if (i.embedded) return "practice";
  if (verifyPracticeRef(i.orgId, i.practiceRef)) return "practice";
  return "marketplace";
}

/**
 * Is this page request the embed loaded inside a frame (the widget on the practice's website)? Only
 * then is the embed route the practice's channel. The same URL opened top-level — from a search
 * engine, a shared link — is a Sorriso-hosted page like any other: marketplace. Browsers send
 * Sec-Fetch-Dest themselves (a page can't set it); one that sends none counts as top-level, which
 * at worst asks for a consent that wasn't needed.
 */
export function isFramedRequest(h: Pick<Headers, "get">): boolean {
  return h.get("sec-fetch-dest") === "iframe";
}

/**
 * The marker a practice puts on its own booking links (dashboard "your booking link", the
 * widget). Deterministic per practice, so links can be shared and printed; it proves only
 * that the link came from the practice's channel, which is all the context needs.
 */
export function signPracticeRef(orgId: string): string {
  // Labelled input: the 'token' purpose also signs unsubscribe links (links.ts).
  return hmac(`practice-ref:${orgId}`, "token").slice(0, 16);
}

export function verifyPracticeRef(orgId: string, ref: string | null | undefined): boolean {
  if (typeof ref !== "string" || ref.length !== 16) return false;
  const expected = Buffer.from(signPracticeRef(orgId));
  const given = Buffer.from(ref);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
