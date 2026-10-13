import type { Organization } from "@/db/schema";
import type { StaffSession } from "../auth";

/**
 * Compliance gates.
 *
 * STUBS with their final signatures (WP5): owners and admins are sent to /dashboard/legal
 * until the current DPA and terms are accepted, members until they accept the current staff
 * instructions; online bookings need the owner's DPA acceptance and a verified practice email,
 * and stop once closure has been requested.
 */

export async function enforceDashboardGates(s: StaffSession): Promise<void> {
  void s;
}

export async function canAcceptOnlineBookings(org: Pick<Organization, "id">): Promise<boolean> {
  void org;
  return true;
}
