import { NO_CARE_FLAGS, type CareFlags } from "@/components/dashboard/slots/contracts";
import type { Permission } from "./permissions";

/**
 * No-show risk and the care flags shown on the calendar (WP8).
 *
 * Risk only adds help (extra reminders, a call list, sorting): it never blocks a booking, hides
 * slots or asks for a deposit.
 */

export type { CareFlags };

/**
 * The care flags of some of the org's appointments, for the calendar and appointment lists
 * (WP2 calls it with the ids it is about to render). Every id in `apptIds` gets an entry; ids of
 * other orgs get NO_CARE_FLAGS. The result is already filtered for the viewer: redFlag stays
 * null without patient.clinical.read (`perms` is permissionsFor(role)).
 *
 * STUB with its final signature (WP8): returns NO_CARE_FLAGS for every id.
 */
export async function loadCareFlags(
  orgId: string,
  apptIds: readonly string[],
  perms: readonly Permission[],
): Promise<Map<string, CareFlags>> {
  void orgId;
  void perms;
  return new Map(apptIds.map((id) => [id, { ...NO_CARE_FLAGS, riskReasons: [] }]));
}
