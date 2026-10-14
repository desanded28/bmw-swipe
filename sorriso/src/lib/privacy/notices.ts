import type { Locale, NoticeKind } from "@/db/enums";
import type { Organization } from "@/db/schema";
import { APP_NAME } from "../config";
import { sha256Hex } from "../crypto";
import { NOTICE_VERSIONS } from "./versions";

/**
 * Privacy notices (Art. 13 and 14), generated rather than hand-written so they always match the
 * processing register: roles.ts PURPOSES (purposes, legal bases, recipients), SUBPROCESSORS
 * (recipients, transfers and their safeguards), the practice's controller fields and its
 * retention settings (getPrivacy(org).retention). WP4 owns this module.
 *
 * Kinds: practice_patient and minor are the practice's notices and need `org`; platform_patient,
 * cookies, staff and practitioner are Sorriso's own.
 */

/** The practice fields a notice reads: controller identity, DPO, contacts and settings. */
export type NoticeOrg = Pick<
  Organization,
  | "id"
  | "slug"
  | "name"
  | "legalName"
  | "vatNumber"
  | "registeredAddress"
  | "privacyEmail"
  | "dpoName"
  | "dpoEmail"
  | "email"
  | "phone"
  | "settings"
>;

/** One block of the notice; `id` is a stable anchor (#controller, #purposes, #rights...). */
export type NoticeSection = { id: string; title: string; body: string };

export type Notice = {
  /** NOTICE_VERSIONS[kind]: what appointments store as noticeVersion. */
  version: string;
  sections: NoticeSection[];
  /** sha256 of the rendered content; a notice_versions row is recorded whenever it changes. */
  contentHash: string;
};

const PRACTICE_KINDS: readonly NoticeKind[] = ["practice_patient", "minor"];

/**
 * Build a notice in `locale` (Italian is authoritative; other locales are translations).
 * Pure and synchronous, so previews of unsaved settings (WP5) record nothing; recording the
 * notice_versions row when the hash changes is done where the notice is published (WP4).
 *
 * STUB with its final signature (WP4): a single "controller" section, untranslated. WP4
 * generates the full notice: controller and DPO, purposes and legal bases, recipients by
 * category, transfers and safeguards, retention periods, rights (Art. 15-22) and withdrawal,
 * the right to complain to the Garante, whether data is mandatory, no automated decisions.
 */
export function buildNotice(kind: NoticeKind, opts: { org?: NoticeOrg | null; locale: Locale }): Notice {
  const { org, locale } = opts;
  if (PRACTICE_KINDS.includes(kind) && !org) throw new Error(`buildNotice: the ${kind} notice needs the practice`);
  const controller = PRACTICE_KINDS.includes(kind)
    ? (org!.legalName ?? org!.name)
    : (process.env.PLATFORM_LEGAL_NAME ?? APP_NAME);
  const version = NOTICE_VERSIONS[kind];
  const sections: NoticeSection[] = [{ id: "controller", title: "Data controller", body: controller }];
  const contentHash = sha256Hex(JSON.stringify({ kind, locale, version, sections }));
  return { version, sections, contentHash };
}
