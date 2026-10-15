import type { AppointmentStatus, Channel, ConfirmationStatus, MessageIntent, ProcessingContext, RiskLevel } from "@/db/enums";
import type { AnamnesisStatus, CareAppointment } from "./slots/contracts";

/**
 * What the calendar and the appointment lists receive for every appointment (listAppointments in
 * src/lib/dashboard.ts). Data minimisation: no free text (patient note, staff note, cancellation
 * reason), no contact details and no link token. The drawer loads the rest on demand through
 * getAppointmentDetail(), which checks the viewer's permissions and is audited.
 */
export type ApptListDTO = {
  id: string;
  start: string;
  end: string;
  /** end + cleanup buffer */
  blockedUntil: string;
  status: AppointmentStatus;
  confirmation: ConfirmationStatus;
  confirmedVia: string | null;
  needsAttention: boolean;
  source: string;
  isNewPatient: boolean;
  processingContext: ProcessingContext;
  /** The appointment has a patient note or a staff note (false for viewers without appointment.notes.read). */
  hasNotes: boolean;
  /** The patient was a minor on the day of the visit. */
  minorFlag: boolean;
  /** No-show risk (WP8's loadCareFlags, already filtered for the viewer); null when not shown. */
  riskLevel: RiskLevel | null;
  /** Reason keys in the care namespace (care.risk.*). */
  riskReasons: string[];
  /** Anamnesis status (WP8); null when care features are off. */
  anamnesis: AnamnesisStatus | null;
  /** Clinical red flag; null unless the viewer has patient.clinical.read. */
  redFlag: boolean | null;
  /** The patient's data is restricted (Art. 18) or erased. */
  restricted: boolean;
  /**
   * A Sorriso booking for another adult, held until that adult confirms with their own code:
   * the practice can't approve it (see awaitsAdultConsent in src/lib/booking.ts).
   */
  awaitingAdultConfirmation: boolean;
  patient: {
    id: string;
    /** The display name, or the localised "Restricted patient" placeholder (see `masked`). */
    name: string;
    /** The name was replaced by the placeholder: the viewer may not see who this is. */
    masked: boolean;
    noShowCount: number;
    preferredChannel: Channel;
  };
  service: { id: string; name: string; durationMinutes: number };
  practitioner: { id: string; name: string; color: string };
  location: { id: string; name: string; timezone: string };
  room: { id: string; name: string } | null;
};

/** @deprecated the list shape is ApptListDTO; the drawer's shape is ApptDetailDTO. */
export type ApptDTO = ApptListDTO;

/** One message of the appointment's thread, as the drawer shows it (no addresses, no HTML). */
export type ThreadMessage = {
  id: string;
  channel: Channel;
  direction: "outbound" | "inbound";
  status: string;
  intent: MessageIntent | null;
  createdAt: string;
  subject: string | null;
  body: string;
  /** The patient's message language (patients.locale): the text is marked with it (WCAG 3.1.2). */
  locale?: string | null;
};

/**
 * How much of a restricted record the viewer may see:
 *   open         not restricted, or a reason was given recently (audited as patient.restricted_access);
 *   needs_reason the viewer has patient.restricted.read but must give a reason first;
 *   placeholder  the viewer may not open it at all.
 */
export type RestrictedAccess = "open" | "needs_reason" | "placeholder";

/**
 * The drawer's view of one appointment (getAppointmentDetail). Fields the viewer may not see are
 * null, and `access` says why, so the drawer can explain instead of showing empty boxes.
 */
export type ApptDetailDTO = ApptListDTO & {
  access: {
    restricted: RestrictedAccess;
    /** patient.contact.read */
    contacts: boolean;
    /** appointment.notes.read */
    notes: boolean;
    /** appointment.notes.write */
    writeNotes: boolean;
    /** messages.read */
    messages: boolean;
    /** appointment.write */
    write: boolean;
    /** recalls.manage: the care panel's actions */
    manageCare: boolean;
  };
  contacts: {
    phone: string | null;
    email: string | null;
    /** wa.me click-to-chat link: only when the practice turned on privacy.staffWaLinks (off by default). */
    whatsappUrl: string | null;
    /** Parent or legal guardian of a minor. */
    guardian: { name: string | null; relation: string | null; phone: string | null; email: string | null } | null;
  } | null;
  patientNote: string | null;
  internalNote: string | null;
  cancelReason: string | null;
  /** null without messages.read. */
  messages: ThreadMessage[] | null;
  /**
   * The patient was offered new times for this visit because of a closure (WP8's rebooking) and
   * the offer is still open: "Mark handled" would withdraw it. False without appointment.write.
   */
  rebookOfferSent: boolean;
  /**
   * A request booked on Sorriso for another adult, held until that adult confirms it through
   * their own link (WP4's adult confirmation): the practice can't approve it before then.
   */
  awaitingAdultConfirmation: boolean;
};

export type DetailResult = { ok: true; data: ApptDetailDTO } | { ok: false; error: string; code?: string };

/** getAppointmentPhone(): only the patient's mobile number (a list row's "Call" button). */
export type PhoneResult = { ok: true; phone: string | null } | { ok: false; error: string; code?: string };

export type Resources = {
  timezone: string;
  practitioners: { id: string; name: string; color: string; serviceIds: string[] }[];
  locations: { id: string; name: string; timezone: string }[];
  rooms: { id: string; name: string; locationId: string }[];
  services: { id: string; name: string; durationMinutes: number }[];
};

/** The slot panels' view of an appointment (WP8's CalendarEventBadges and AppointmentCarePanel). */
export function toCareAppointment(a: ApptListDTO): CareAppointment {
  return {
    id: a.id,
    status: a.status,
    start: a.start,
    end: a.end,
    patientId: a.patient.id,
    serviceId: a.service.id,
    practitionerId: a.practitioner.id,
    isNewPatient: a.isNewPatient,
    minorFlag: a.minorFlag,
    riskLevel: a.riskLevel,
    riskReasons: a.riskReasons,
    anamnesis: a.anamnesis,
    redFlag: a.redFlag,
  };
}

const RISK_RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/** Sort key for a risk level: high first, unknown last. */
export function riskRank(level: RiskLevel | null): number {
  return level ? RISK_RANK[level] : 3;
}
