import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { auditLog, organizations, patients, practitioners } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { sha256Hex } from "@/lib/crypto";
import { BookingError } from "@/lib/booking";
import { newId } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";
import { backfill0001 } from "../../../../scripts/backfill-0001";
import { fail, guard, ok, optional, staff, str, type ActionResult } from "./_shared";
import { newApiKey, revokeApiKey } from "./apikeys";
import { cancelByStaff, clearAttention, saveInternalNote } from "./appointments";
import { rotateIcsToken } from "./ics";
import { issuePatientLink } from "./links";
import { addRoom, saveLocation, updateRoom } from "./locations";
import { simulateReply } from "./messages";
import { updatePatient } from "./patients";
import { savePractitioner } from "./practitioners";
import { runRemindersNow, saveReminderSettings } from "./reminders";
import { replyToReview, setReviewPublished } from "./reviews";
import { saveSchedule } from "./schedules";
import { saveService } from "./services";
import { saveBookingPolicy, saveProfile } from "./settings";
import { addTimeOff, deleteTimeOff } from "./timeoff";
import { removeWaitlistEntry } from "./waitlist";

const state = vi.hoisted(() => ({ session: null as StaffSession | null }));
const revalidatePath = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/log", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/log")>()), logError }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  requireStaff: async () => {
    if (!state.session) throw new Error("no session in test");
    return state.session;
  },
}));

let orgId: string;

async function signIn(role: MembershipRole) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  state.session = {
    sessionId: "s1",
    user: { id: `user-${role}`, name: "Test", email: "t@example.com", isPlatformAdmin: false, locale: null },
    org,
    role,
    orgs: [{ org, role }],
  };
  return state.session;
}

beforeAll(async () => {
  ({ orgId } = await createPractice());
});
beforeEach(() => revalidatePath.mockClear());

describe("guard", () => {
  it("refuses without the permission and never runs the action", async () => {
    await signIn("reception");
    const fn = vi.fn(async () => ok("ran"));
    const res = await guard(fn, { permission: "settings.manage" });
    expect(res).toEqual({ ok: false, error: "You don't have permission to do that.", code: "forbidden" });
    expect(fn).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("passes the staff session and revalidates the dashboard after a success only", async () => {
    const s = await signIn("owner");
    let seen: StaffSession | null = null;
    expect(
      await guard(
        async (x) => {
          seen = x;
          return ok("Saved.", { id: 1 });
        },
        { permission: "settings.manage" },
      ),
    ).toEqual({ ok: true, message: "Saved.", data: { id: 1 } });
    expect(seen).toBe(s);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");

    revalidatePath.mockClear();
    expect(await guard(async () => fail("Nope.", "bad"))).toEqual({ ok: false, error: "Nope.", code: "bad" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("audits after a success, never after a failure", async () => {
    await signIn("practitioner");
    const entityId = newId();
    const rows = () =>
      db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityId, entityId)));
    const opts = {
      permission: "appointment.write",
      audit: "appointment.link.issue",
      entity: { type: "appointment", id: entityId },
    } as const;

    await guard(async () => fail("Not found."), opts);
    expect(await rows()).toHaveLength(0);

    await guard(async () => ok(), opts);
    const [row, ...rest] = await rows();
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({
      actorType: "user",
      actorId: "user-practitioner",
      action: "appointment.link.issue",
      entityType: "appointment",
    });
  });

  it("turns domain errors into results and lets Next.js control flow through", async () => {
    await signIn("owner");
    expect(await guard(async () => Promise.reject(new BookingError("not_allowed", "Taken.")))).toEqual({
      ok: false,
      error: "Taken.",
      code: "not_allowed",
    });
    const zodFail = await guard(async () => (z.object({ a: z.string().min(1, "Enter a") }).parse({ a: "" }), ok()));
    expect(zodFail).toEqual({ ok: false, error: "Enter a", code: undefined });
    expect(await guard(async () => Promise.reject(new Error("boom")))).toEqual({
      ok: false,
      error: "Something went wrong.",
      code: undefined,
    });
    expect(logError).toHaveBeenCalledWith("dashboard action", expect.objectContaining({ message: "boom" }));
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" });
    await expect(guard(async () => Promise.reject(redirect))).rejects.toBe(redirect);
  });
});

describe("staff, str and optional", () => {
  it("staff(perm) throws a PermissionError the guard maps to forbidden", async () => {
    await signIn("reception");
    await expect(staff("apikeys.manage")).rejects.toMatchObject({ code: "forbidden", permission: "apikeys.manage" });
    await expect(staff("patient.write")).resolves.toMatchObject({ role: "reception" });
  });

  it("reads trimmed form fields", () => {
    const fd = new FormData();
    fd.set("name", "  Anna ");
    fd.set("blank", "   ");
    expect(str(fd, "name")).toBe("Anna");
    expect(str(fd, "missing")).toBe("");
    expect(optional(fd, "blank")).toBeNull();
    expect(optional(fd, "name")).toBe("Anna");
  });
});

/**
 * The split must keep every action's access rule: actions that required owner/admin
 * (requireStaff(MANAGERS)) now check a permission only those roles hold; the others stay open
 * to every staff member.
 */
describe("authorisation after the split", () => {
  // Called with ids that match nothing: each one gets past (or stops at) the permission check
  // and then fails or succeeds harmlessly.
  const none = "missing-id";
  const managerOnly: Record<string, () => Promise<ActionResult>> = {
    savePractitioner: () => savePractitioner(none, null, new FormData()),
    saveSchedule: () => saveSchedule(none, []),
    rotateIcsToken: () => rotateIcsToken(none),
    saveService: () => saveService(none, null, new FormData()),
    saveLocation: () => saveLocation(none, null, new FormData()),
    addRoom: () => addRoom(none, "Chair"),
    updateRoom: () => updateRoom(none, {}),
    saveProfile: () => saveProfile(null, new FormData()),
    saveBookingPolicy: () => saveBookingPolicy(null, new FormData()),
    saveReminderSettings: () =>
      saveReminderSettings({
        rules: [],
        sendBookingConfirmation: true,
        requestReviews: true,
        autoOfferToWaitlist: true,
      }),
    newApiKey: () => newApiKey("test"),
    revokeApiKey: () => revokeApiKey(none),
    replyToReview: () => replyToReview(none, ""),
    setReviewPublished: () => setReviewPublished(none, true),
  };
  const everyone: Record<string, () => Promise<ActionResult>> = {
    cancelByStaff: () => cancelByStaff(none, "", false),
    clearAttention: () => clearAttention(none),
    saveInternalNote: () => saveInternalNote(none, ""),
    issuePatientLink: () => issuePatientLink(none),
    addTimeOff: () => addTimeOff(null, new FormData()),
    deleteTimeOff: () => deleteTimeOff(none),
    removeWaitlistEntry: () => removeWaitlistEntry(none),
    updatePatient: () => updatePatient(none, null, new FormData()),
    runRemindersNow: () => runRemindersNow(),
    simulateReply: () => simulateReply("x", "SI", "sms"),
  };
  const isForbidden = (r: ActionResult) => !r.ok && r.code === "forbidden";

  it.each(["owner", "admin"] as const)("lets %s run the managers' actions", async (role) => {
    await signIn(role);
    for (const [name, run] of Object.entries(managerOnly)) expect(isForbidden(await run()), name).toBe(false);
  });

  it.each(["reception", "practitioner"] as const)("refuses the managers' actions to %s", async (role) => {
    await signIn(role);
    for (const [name, run] of Object.entries(managerOnly)) expect(isForbidden(await run()), name).toBe(true);
  });

  const roles = ["owner", "admin", "reception", "practitioner"] as const;
  it.each(roles)("lets %s run the front-line actions", async (role) => {
    await signIn(role);
    for (const [name, run] of Object.entries(everyone)) expect(isForbidden(await run()), name).toBe(false);
  });
});

describe("what the actions write", () => {
  it("updatePatient keeps any message language, and the current one for anything else", async () => {
    await signIn("owner");
    const id = newId();
    await db.insert(patients).values({ id, orgId, firstName: "Ana", lastName: "Sousa", phone: "+393331112223", locale: "pt" });
    const save = (locale: string) => {
      const fd = new FormData();
      fd.set("firstName", "Ana");
      fd.set("lastName", "Sousa");
      fd.set("phone", "+393331112223");
      fd.set("locale", locale);
      return updatePatient(id, null, fd);
    };
    const localeNow = async () => (await db.select().from(patients).where(eq(patients.id, id)))[0].locale;
    expect(await save("pt")).toMatchObject({ ok: true });
    expect(await localeNow()).toBe("pt");
    await save("de");
    expect(await localeNow()).toBe("de");
    await save("xx");
    expect(await localeNow()).toBe("de");
  });

  it("savePractitioner stores no feed secret: only the non-secret placeholder", async () => {
    await signIn("owner");
    const fd = new FormData();
    fd.set("name", "Dr. Nuova Feed");
    // Creating redirects to the new profile (Next.js control flow, rethrown by guard).
    await savePractitioner(null, null, fd).catch((err: unknown) => {
      if (!String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw err;
    });
    const [row] = await db
      .select()
      .from(practitioners)
      .where(and(eq(practitioners.orgId, orgId), eq(practitioners.name, "Dr. Nuova Feed")));
    expect(row).toMatchObject({ icsToken: `h:${row.id}`, icsTokenHash: null });
  });

  it("re-running the migration backfill never replaces, re-enables or extends an issued feed", async () => {
    await signIn("owner");
    const id = newId();
    // A practitioner created before the placeholder fix: a plaintext token in the old column.
    await db.insert(practitioners).values({ id, orgId, slug: `legacy-${id.toLowerCase()}`, name: "Legacy Feed", specialty: "Dentist", icsToken: newId(24) });
    const res = await rotateIcsToken(id);
    expect(res.ok).toBe(true);
    const token = String((res as { data?: { url?: string } }).data?.url).match(/practitioner\/(.+)\.ics$/)![1];
    const [issued] = await db.select().from(practitioners).where(eq(practitioners.id, id));
    expect(issued.icsToken).toBe(`h:${id}`);

    // The practice turns the feed off; a leftover plaintext token (rows rotated before this fix) is still there.
    await db.update(practitioners).set({ icsEnabled: false, icsToken: newId(24) }).where(eq(practitioners.id, id));
    await backfill0001(db);
    const [row] = await db.select().from(practitioners).where(eq(practitioners.id, id));
    expect(row).toMatchObject({ icsToken: `h:${id}`, icsTokenHash: sha256Hex(token), icsEnabled: false });
    expect(row.icsTokenExpiresAt?.getTime()).toBe(issued.icsTokenExpiresAt?.getTime());
  });
});
