import type { AppointmentStatus, ConfirmationStatus } from "@/db/schema";

export type ApptDTO = {
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
  patientNote: string | null;
  internalNote: string | null;
  cancelReason: string | null;
  patient: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    noShowCount: number;
    preferredChannel: "sms" | "whatsapp" | "email";
  };
  service: { id: string; name: string; durationMinutes: number };
  practitioner: { id: string; name: string; color: string };
  location: { id: string; name: string; timezone: string };
  room: { id: string; name: string } | null;
};

export type Resources = {
  timezone: string;
  practitioners: { id: string; name: string; color: string; serviceIds: string[] }[];
  locations: { id: string; name: string; timezone: string }[];
  rooms: { id: string; name: string; locationId: string }[];
  services: { id: string; name: string; durationMinutes: number }[];
};
