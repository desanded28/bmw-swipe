"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { FUND_MODES, type FundMode } from "@/db/enums";
import { funds, orgFunds, services } from "@/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { fail, guard, ok, optional, str, type ActionResult } from "./_shared";

/**
 * The health funds and insurers a practice works with (org_funds), as the practice declares them
 * (WP7): direct billing or reimbursement, all treatments or some. They are shown on the practice
 * page, used by the fund filter in search, and offered in the booking form (appointments.fundId,
 * kept only when the practice lists that fund for that treatment).
 */

/** The staff member's language. Outside a request (tests, scripts) the default: never fails the action. */
async function staffLocale(): Promise<Locale> {
  try {
    return await getStaffLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

const NOTE_MAX = 200;

/** Replace the practice's whole fund list with the form's. */
export async function saveOrgFunds(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = getT(await staffLocale(), "catalog");
      const [allFunds, orgServices] = await Promise.all([
        db.select({ id: funds.id }).from(funds),
        db.select({ id: services.id }).from(services).where(eq(services.orgId, s.org.id)),
      ]);
      const ownServices = new Set(orgServices.map((x) => x.id));
      const rows: (typeof orgFunds.$inferInsert)[] = [];
      for (const { id } of allFunds) {
        if (fd.get(`fund.${id}`) !== "on") continue;
        const modeRaw = str(fd, `mode.${id}`);
        const mode: FundMode = (FUND_MODES as readonly string[]).includes(modeRaw) ? (modeRaw as FundMode) : "indirect";
        let serviceIds: string[] | null = null;
        if (str(fd, `scope.${id}`) === "some") {
          serviceIds = [...new Set(fd.getAll(`services.${id}`).map(String))].filter((sid) => ownServices.has(sid));
          if (!serviceIds.length) return fail(t("funds.selectServices"));
        }
        const note = optional(fd, `note.${id}`);
        if (note && note.length > NOTE_MAX) return fail(t("funds.noteTooLong"));
        rows.push({ orgId: s.org.id, fundId: id, mode, serviceIds, note });
      }
      await db.transaction(async (tx) => {
        await tx.delete(orgFunds).where(eq(orgFunds.orgId, s.org.id));
        if (rows.length) await tx.insert(orgFunds).values(rows);
      });
      return ok(t("funds.saved"));
    },
    { permission: "catalog.manage", audit: "settings.update" },
  );
}
