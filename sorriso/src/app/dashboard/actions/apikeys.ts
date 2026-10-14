"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { API_SCOPES, type ApiScope } from "@/db/enums";
import { apiKeys } from "@/db/schema";
import { getT } from "@/i18n/server";
import { API_KEY_DEFAULT_MONTHS, API_KEY_MAX_MONTHS, createApiKey } from "@/lib/api";
import { auditStaff } from "@/lib/audit";
import { requireStepUp } from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { emailDate, emailWhen, practiceOwners, sendAuthEmail, staffEmailLocale } from "@/lib/security/emails";
import { normalizeIpRange } from "@/lib/security/ip";
import { securityTexts } from "@/lib/security/staff-locale";
import { fail, guard, ok, type ActionResult } from "./_shared";

/**
 * Partner API keys: scoped, expiring (12 months by default, at most 24), optionally limited to IP
 * addresses or ranges. The secret is returned once (only its hash is stored). Creating one needs a
 * recent re-authentication and emails every owner of the practice.
 */

export type NewApiKeyInput = {
  name: string;
  scopes?: ApiScope[];
  expiresInMonths?: number;
  /** One address or CIDR range per entry (or per line). */
  allowedIps?: string[] | string;
};

const MAX_IPS = 20;

export async function newApiKey(input: string | NewApiKeyInput): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await securityTexts(s);
      const i: NewApiKeyInput = typeof input === "string" ? { name: input } : input;
      await requireStepUp(10, s);

      const scopes = (i.scopes ?? ["appointments:read", "appointments:write", "patients:read"]).filter((x): x is ApiScope =>
        (API_SCOPES as readonly string[]).includes(x),
      );
      if (!scopes.length) return fail(t("api.scopeRequired"), "scope_required");
      const months = Math.round(Number(i.expiresInMonths ?? API_KEY_DEFAULT_MONTHS));
      if (!Number.isFinite(months) || months < 1 || months > API_KEY_MAX_MONTHS) return fail(t("errors.generic"), "invalid_expiry");
      const rawIps = (Array.isArray(i.allowedIps) ? i.allowedIps : String(i.allowedIps ?? "").split(/[\s,;]+/)).map((x) => x.trim()).filter(Boolean);
      if (rawIps.length > MAX_IPS) return fail(t("api.tooManyIps"), "too_many_ips");
      const allowedIps: string[] = [];
      for (const raw of rawIps) {
        const ip = normalizeIpRange(raw);
        if (!ip) return fail(t("api.invalidIp", { value: raw.slice(0, 60) }), "invalid_ip");
        allowedIps.push(ip);
      }

      const name = String(i.name ?? "").trim().slice(0, 80) || t("api.defaultName");
      const key = await createApiKey(s.org.id, { name, scopes, expiresInMonths: months, allowedIps, createdByUserId: s.user.id });
      await auditStaff(s, "apikey.create", { type: "api_key", id: key.id }, {
        metadata: { scopes: key.scopes.join(" "), months, ipRestricted: allowedIps.length > 0 },
      });

      // Every owner hears about it: a key reads patient data outside the dashboard.
      const now = new Date();
      for (const owner of await practiceOwners(s.org.id)) {
        const locale = staffEmailLocale(owner, s.org);
        const ts = getT(locale, "security");
        await sendAuthEmail({
          to: owner.email,
          name: owner.name,
          locale,
          kind: "apiKeyCreated",
          vars: {
            creator: s.user.name,
            name,
            practice: s.org.name,
            when: emailWhen(now, locale, s.org.timezone),
            scopes: key.scopes.map((x) => ts(`api.scopes.${x}`)).join("; "),
            expires: emailDate(key.expiresAt, locale, s.org.timezone),
          },
          url: absoluteUrl("/dashboard/settings/api"),
        });
      }
      return ok(t("api.created"), { secret: key.secret });
    },
    { permission: "apikeys.manage" },
  );
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await securityTexts(s);
      const res = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, String(id)), eq(apiKeys.orgId, s.org.id), isNull(apiKeys.revokedAt)));
      if (!res.rowsAffected) return fail(t("errors.notFound"), "not_found");
      await auditStaff(s, "apikey.revoke", { type: "api_key", id: String(id) });
      return ok(t("api.revoked"));
    },
    { permission: "apikeys.manage" },
  );
}
