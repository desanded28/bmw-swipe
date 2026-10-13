import type { PrivacySettings } from "@/db/schema";
import { LEGAL_VERSIONS } from "./versions";

/**
 * Sorriso's sub-processors (Art. 28(2) and (4)): the single source for /legal/subprocessors,
 * the DPA annex, the patient notices and the Art. 30 registers.
 *
 * Transfers: a provider with a US parent is a transfer even when its servers are in the EU,
 * because the parent can be compelled to give access (and its support staff may access data).
 * Those entries are 'dpf+scc' — EU-US Data Privacy Framework certification with the DPA's
 * standard contractual clauses as fallback (the DPF appeal C-703/25 P is pending) — and are
 * covered by the transfer impact assessment in docs/privacy/tia.md. Never describe them as
 * "data stays in the EU": say where the data is hosted and which transfer tool applies.
 * Before go-live, check each parent's certification on dataprivacyframework.gov; if one is not
 * certified, its entry becomes 'scc'.
 *
 * Changing this list is a new LEGAL_VERSIONS.subprocessors, notified to practices 30 days in
 * advance with the right to object.
 */

export type SubprocessorId = "vercel" | "turso" | "twilio" | "meta_whatsapp" | "smtp" | "backups";

export type TransferTool = "eu" | "dpf" | "scc" | "dpf+scc";

/** What a sub-processor handles, for notices and the DPA annex (labels live in the legal namespaces). */
export type SubprocessorDataCategory =
  | "all_platform_data"
  | "contact"
  | "message_content"
  | "message_metadata"
  | "technical";

export type Subprocessor = {
  id: SubprocessorId;
  name: string;
  legalEntity: string;
  /** The ultimate parent and its country, when outside the EEA: the reason for the transfer tool. */
  parent: string | null;
  /** i18n key suffix for the service description (e.g. legalPractice.subprocessors.service.<id>). */
  service: string;
  dataCategories: SubprocessorDataCategory[];
  /** Where data is hosted or processed. */
  region: string;
  transfer: TransferTool;
  /** Covered by the transfer impact assessment. */
  tia: boolean;
  /** Public DPA, or null when the signed copy is available on request only. */
  dpaUrl: string | null;
  /** Used only when the practice switches the feature on. */
  onlyWhen?: "whatsapp_enabled";
};

const env = (name: string) => process.env[name]?.trim() || null;

function smtpTransfer(): TransferTool {
  const v = env("SMTP_PROVIDER_TRANSFER");
  return v === "eu" || v === "dpf" || v === "scc" || v === "dpf+scc" ? v : "dpf+scc";
}

/**
 * The SMTP provider is chosen per deployment, so it is described through the environment.
 * Without SMTP_PROVIDER_TRANSFER=eu (an EU-owned provider), it is treated as a transfer.
 */
function smtpEntry(): Subprocessor {
  const transfer = smtpTransfer();
  return {
    id: "smtp",
    name: env("SMTP_PROVIDER_NAME") ?? "SMTP provider",
    legalEntity: env("SMTP_PROVIDER_ENTITY") ?? env("SMTP_PROVIDER_NAME") ?? "SMTP provider",
    parent: env("SMTP_PROVIDER_PARENT"),
    service: "email",
    dataCategories: ["contact", "message_content", "message_metadata"],
    region: env("SMTP_PROVIDER_REGION") ?? "EU",
    transfer,
    tia: transfer !== "eu",
    dpaUrl: env("SMTP_PROVIDER_DPA_URL"),
  };
}

export function getSubprocessors(): Subprocessor[] {
  return [
    {
      id: "vercel",
      name: "Vercel",
      legalEntity: "Vercel Inc.",
      parent: "Vercel Inc. (US)",
      service: "hosting",
      dataCategories: ["all_platform_data", "technical"],
      region: "EU — Frankfurt (fra1)",
      transfer: "dpf+scc",
      tia: true,
      dpaUrl: "https://vercel.com/legal/dpa",
    },
    {
      id: "turso",
      name: "Turso",
      legalEntity: "ChiselStrike Inc. (Turso)",
      parent: "ChiselStrike Inc. (US)",
      service: "database",
      dataCategories: ["all_platform_data"],
      region: "EU — Frankfurt",
      transfer: "dpf+scc",
      tia: true,
      dpaUrl: null,
    },
    {
      id: "twilio",
      name: "Twilio",
      legalEntity: "Twilio Ireland Limited",
      parent: "Twilio Inc. (US)",
      service: "sms",
      dataCategories: ["contact", "message_content", "message_metadata"],
      region: "EU — Ireland (IE1 data residency for SMS)",
      transfer: "dpf+scc",
      tia: true,
      dpaUrl: "https://www.twilio.com/en-us/legal/data-protection-addendum",
    },
    {
      id: "meta_whatsapp",
      name: "WhatsApp (Meta), through Twilio",
      legalEntity: "WhatsApp Ireland Limited",
      parent: "Meta Platforms Inc. (US)",
      service: "whatsapp",
      dataCategories: ["contact", "message_content", "message_metadata"],
      region: "United States",
      transfer: "dpf+scc",
      tia: true,
      dpaUrl: "https://www.whatsapp.com/legal/business-data-processing-terms",
      onlyWhen: "whatsapp_enabled",
    },
    smtpEntry(),
    {
      id: "backups",
      name: "Turso (point-in-time backups)",
      legalEntity: "ChiselStrike Inc. (Turso)",
      parent: "ChiselStrike Inc. (US)",
      service: "backups",
      dataCategories: ["all_platform_data"],
      region: "EU — same region as the database",
      transfer: "dpf+scc",
      tia: true,
      dpaUrl: null,
    },
  ];
}

/** Read once per process: the SMTP entry depends on the environment. */
export const SUBPROCESSORS: readonly Subprocessor[] = getSubprocessors();

export const SUBPROCESSORS_VERSION = LEGAL_VERSIONS.subprocessors;

/** The sub-processors that actually receive this practice's data, given its settings. */
export function activeSubprocessors(privacy: Pick<PrivacySettings, "whatsappEnabled">): Subprocessor[] {
  return SUBPROCESSORS.filter((s) => s.onlyWhen !== "whatsapp_enabled" || privacy.whatsappEnabled);
}

export function subprocessor(id: SubprocessorId): Subprocessor {
  return SUBPROCESSORS.find((s) => s.id === id)!;
}
