"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { PRICE_TYPES, SERVICE_CATEGORIES, type PriceType, type ServiceCategory } from "@/db/enums";
import { practitionerServices, practitioners, services } from "@/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { blockedWords, checkAdvertisingFields } from "@/lib/compliance/advertising";
import { newId } from "@/lib/ids";
import { fail, guard, ok, optional, str, type ActionResult } from "./_shared";

/**
 * The treatment catalogue (WP7): price types (fixed, starting price or range, quote after a
 * visit), what the price includes, the suggested recall interval (WP8 uses it to pre-fill the
 * clinician's choice) and the sensitive flag (WP3 keeps sensitive names out of messages).
 * Names and descriptions go through the health-advertising check: promotional wording blocks
 * the save, suggestive wording is saved with a warning.
 */

/** The staff member's language. Outside a request (tests, scripts) the default: never fails the action. */
async function staffLocale(): Promise<Locale> {
  try {
    return await getStaffLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** "12,50" or "12.50" euros to cents; "" to null; NaN for anything else. */
function cents(value: string): number | null {
  const raw = value.replace(/\s/g, "").replace(",", ".");
  if (raw === "") return null;
  return /^\d{1,6}(\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : Number.NaN;
}

/** Create (id null) or update a treatment. */
export async function saveService(id: string | null, _prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = getT(await staffLocale(), "catalog");
      const category = str(fd, "category");
      if (!(SERVICE_CATEGORIES as readonly string[]).includes(category)) return fail(t("serviceForm.categoryRequired"));
      const duration = Number(str(fd, "durationMinutes"));
      if (!Number.isInteger(duration) || duration < 5 || duration > 480) return fail(t("serviceForm.durationInvalid"));
      const priceTypeRaw = str(fd, "priceType");
      const priceType: PriceType = (PRICE_TYPES as readonly string[]).includes(priceTypeRaw) ? (priceTypeRaw as PriceType) : "fixed";
      const price = priceType === "quote" ? null : cents(str(fd, "price"));
      if (price != null && Number.isNaN(price)) return fail(t("serviceForm.priceInvalid"));
      const priceMax = priceType === "from" ? cents(str(fd, "priceMax")) : null;
      if (priceMax != null && (Number.isNaN(priceMax) || price == null || priceMax <= price)) return fail(t("serviceForm.priceMaxInvalid"));
      const recallRaw = str(fd, "recallMonths");
      const recallMonths = recallRaw === "" ? null : Number(recallRaw);
      if (recallMonths != null && (!Number.isInteger(recallMonths) || recallMonths < 1 || recallMonths > 60)) return fail(t("serviceForm.recallInvalid"));

      const values = {
        name: str(fd, "name").slice(0, 120),
        category: category as ServiceCategory,
        description: optional(fd, "description")?.slice(0, 1000) ?? null,
        durationMinutes: duration,
        bufferMinutes: Math.max(0, Math.min(120, Number(str(fd, "bufferMinutes")) || 0)),
        priceCents: price,
        priceType,
        priceMaxCents: priceMax,
        priceIncludes: optional(fd, "priceIncludes")?.slice(0, 300) ?? null,
        recallMonths,
        sensitive: fd.get("sensitive") === "on",
        onlineBookable: fd.get("onlineBookable") === "on",
        requiresRoom: fd.get("requiresRoom") === "on",
        active: fd.get("active") === "on",
      };
      if (!values.name) return fail(t("serviceForm.nameRequired"));

      const ads = checkAdvertisingFields({ name: values.name, description: values.description, priceIncludes: values.priceIncludes });
      if (ads.verdict === "block") return fail(t("advertising.blocked", { words: blockedWords(ads.byField) }), "advertising");
      const warned = ads.verdict === "warn";

      if (id) {
        const res = await db
          .update(services)
          .set(values)
          .where(and(eq(services.id, id), eq(services.orgId, s.org.id)))
          .returning({ id: services.id });
        if (!res.length) return fail(t("serviceForm.notFound"), "not_found");
        return ok(warned ? t("serviceForm.savedWithWarnings") : t("serviceForm.saved"));
      }
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${services.sortOrder}), 0)` })
        .from(services)
        .where(eq(services.orgId, s.org.id));
      const newServiceId = newId();
      await db.insert(services).values({ id: newServiceId, orgId: s.org.id, sortOrder: Number(max) + 1, ...values });
      // Practitioners who should offer it are linked on their profile; link all for convenience if only one.
      const team = await db.select({ id: practitioners.id }).from(practitioners).where(eq(practitioners.orgId, s.org.id));
      if (team.length === 1) await db.insert(practitionerServices).values({ practitionerId: team[0].id, serviceId: newServiceId });
      return ok(warned ? t("serviceForm.savedWithWarnings") : t("serviceForm.added"));
    },
    { permission: "catalog.manage" },
  );
}
