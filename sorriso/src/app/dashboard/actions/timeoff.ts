"use server";

import { and, eq } from "drizzle-orm";
import type { CareResult, ClashItem } from "@/components/care/types";
import { db } from "@/db";
import { locations, practitioners, rooms, timeOff } from "@/db/schema";
import { getStaffLocale } from "@/i18n/server";
import { getT } from "@/i18n/t";
import { newId } from "@/lib/ids";
import { logError } from "@/lib/log";
import { PermissionError } from "@/lib/permissions";
import {
  afterClosureRemoved,
  cancelForClosure,
  clashingAppointments,
  closureClashCounts,
  listClosureClashes,
  sendRebookOffers,
} from "@/lib/rebooking";
import { hhmmToMinutes, zonedToUtc } from "@/lib/time";
import { fail, guard, ok, optional, staff, str, type ActionResult } from "./_shared";

/**
 * Time off and closures, and the rebooking assistant for the visits a closure displaces (WP8).
 * appointment.write is held by every role, so any staff member may block time, as before.
 */

async function tc() {
  return getT(await getStaffLocale(), "care");
}

/**
 * Block a practitioner, an office, a chair or the whole practice for a period. The result's data
 * is { timeOffId, clashes, appointmentIds }: the upcoming visits the block covers, for
 * "Rebook N patients".
 */
export async function addTimeOff(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      const scope = str(fd, "scope"); // practitioner:<id> | location:<id> | room:<id> | org
      const [kind, targetId] = scope.split(":");
      const fromDate = str(fd, "fromDate");
      const toDate = str(fd, "toDate") || fromDate;
      const allDay = fd.get("allDay") === "on";
      const fromMin = allDay ? 0 : hhmmToMinutes(str(fd, "fromTime"));
      const toMin = allDay ? 24 * 60 : hhmmToMinutes(str(fd, "toTime"));
      if (!fromDate || fromMin == null || toMin == null) return fail(t("timeOff.errors.dates"));
      const tz = s.org.timezone;
      const startsAt = zonedToUtc(fromDate, fromMin, tz);
      const endsAt = zonedToUtc(toDate, toMin, tz);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return fail(t("timeOff.errors.dates"));
      if (endsAt <= startsAt) return fail(t("timeOff.errors.order"));

      const row = { id: newId(), orgId: s.org.id, startsAt, endsAt, reason: optional(fd, "reason") } as typeof timeOff.$inferInsert;
      if (kind === "practitioner") {
        const [p] = await db
          .select({ id: practitioners.id })
          .from(practitioners)
          .where(and(eq(practitioners.id, targetId), eq(practitioners.orgId, s.org.id)));
        if (!p) return fail(t("timeOff.errors.practitioner"));
        row.practitionerId = targetId;
      } else if (kind === "location") {
        const [l] = await db
          .select({ id: locations.id })
          .from(locations)
          .where(and(eq(locations.id, targetId), eq(locations.orgId, s.org.id)));
        if (!l) return fail(t("timeOff.errors.office"));
        row.locationId = targetId;
      } else if (kind === "room") {
        const [r] = await db
          .select({ id: rooms.id, locationId: rooms.locationId })
          .from(rooms)
          .innerJoin(locations, eq(locations.id, rooms.locationId))
          .where(and(eq(rooms.id, targetId), eq(locations.orgId, s.org.id)));
        if (!r) return fail(t("timeOff.errors.chair"));
        row.roomId = targetId;
        row.locationId = r.locationId;
      } else if (kind !== "org") return fail(t("timeOff.errors.scope"));

      await db.insert(timeOff).values(row);
      // Upcoming visits the block now covers: the form offers to rebook them.
      const appointmentIds = await clashingAppointments(s.org.id, {
        practitionerId: row.practitionerId ?? null,
        locationId: row.locationId ?? null,
        roomId: row.roomId ?? null,
        startsAt,
        endsAt,
      });
      const clashes = appointmentIds.length;
      return ok(clashes ? t("timeOff.blockedClashes", { count: clashes }) : t("timeOff.blocked"), { timeOffId: row.id, clashes, appointmentIds });
    },
    { permission: "appointment.write" },
  );
}

/** Remove a block. Visits it covered (and no other closure does) get their reminders back. */
export async function deleteTimeOff(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      const [removed] = await db
        .delete(timeOff)
        .where(and(eq(timeOff.id, id), eq(timeOff.orgId, s.org.id)))
        .returning();
      if (removed) await afterClosureRemoved(s.org.id, removed).catch((err) => logError("care", err, { step: "closure-removed" }));
      return ok(t("timeOff.removed"));
    },
    { permission: "appointment.write" },
  );
}

/** The upcoming visits one closure covers, for the "Rebook N patients" drawer. */
export async function loadClosureClashes(timeOffId: string): Promise<CareResult<ClashItem[]>> {
  try {
    const s = await staff("appointment.write");
    const rows = await listClosureClashes(s.org.id, timeOffId);
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        start: r.start.toISOString(),
        timezone: r.timezone,
        patientName: r.patientName,
        practitionerName: r.practitionerName,
        locationName: r.locationName,
        needsAttention: r.needsAttention,
        callRequested: r.callRequested,
        reachable: r.reachable,
      })),
    };
  } catch (err) {
    const t = await tc();
    if (err instanceof PermissionError) return { ok: false, error: t("actions.forbidden"), code: "forbidden" };
    if (err && typeof err === "object" && "digest" in err) throw err;
    logError("care action", err);
    return { ok: false, error: t("actions.failed") };
  }
}

/** Offer new times to the patients of these visits (only visits a closure covers get one). */
export async function sendRebookOffersAction(appointmentIds: string[]): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      if (!appointmentIds.length) return fail(t("drawer.nothingSelected"));
      const res = await sendRebookOffers(s.org.id, appointmentIds.slice(0, 200), { type: "user", id: s.user.id });
      const parts = [
        res.sent.length ? t("drawer.sent", { count: res.sent.length }) : null,
        res.unreachable.length ? t("drawer.notReached", { count: res.unreachable.length }) : null,
      ].filter(Boolean);
      if (!parts.length) return fail(t("drawer.empty"));
      return ok(parts.join(" "), res);
    },
    { permission: "appointment.write" },
  );
}

/** Cancel these visits because the practice is closed (cancelled by staff, reason practice_unavailable). */
export async function cancelForClosureAction(appointmentIds: string[]): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tc();
      if (!appointmentIds.length) return fail(t("drawer.nothingSelected"));
      const done = await cancelForClosure(s.org.id, appointmentIds.slice(0, 200), { type: "user", id: s.user.id });
      return done.length ? ok(t("drawer.cancelled", { count: done.length }), { cancelled: done }) : fail(t("drawer.empty"));
    },
    { permission: "appointment.write" },
  );
}

/** For the closures list: how many upcoming visits each of these closures covers. */
export async function loadClosureClashCounts(timeOffIds: string[]): Promise<CareResult<Record<string, number>>> {
  try {
    const s = await staff("appointment.write");
    const counts = await closureClashCounts(s.org.id, timeOffIds.slice(0, 200));
    return { ok: true, data: Object.fromEntries(counts) };
  } catch (err) {
    const t = await tc();
    if (err instanceof PermissionError) return { ok: false, error: t("actions.forbidden"), code: "forbidden" };
    if (err && typeof err === "object" && "digest" in err) throw err;
    logError("care action", err);
    return { ok: false, error: t("actions.failed") };
  }
}
