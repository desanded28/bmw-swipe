import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/db";
import { auditLog, memberships, messages, patients, privacyRequests, users } from "@/db/schema";
import { createPractice } from "@/test/fixtures";
import { newId } from "../ids";
import { zonedParts } from "../time";
import {
  addMonthsClamped,
  completePrivacyRequest,
  createPrivacyRequest,
  daysLeft,
  extendPrivacyRequest,
  listPrivacyRequests,
  maxExtensionUntil,
  notifyRequester,
  privacyRequestDueAt,
  sendDeadlineReminders,
  joinContacts,
  requestTextAndContact,
  splitContactSnapshot,
  splitContacts,
  startPrivacyRequest,
} from "./requests";

const TZ = "Europe/Rome";
const DAY = 86_400_000;
const STAFF = { type: "user" as const, id: newId() };
const rome = (d: Date) => {
  const z = zonedParts(d, TZ);
  return `${z.date} ${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
};

let orgId: string;
let patientId: string;
let ownerEmail: string;

beforeAll(async () => {
  orgId = (await createPractice()).orgId;
  patientId = newId();
  await db.insert(patients).values({ id: patientId, orgId, firstName: "Ada", lastName: "Neri", email: "ada.neri@example.org", phone: "+393331112299", locale: "de" });
  await db.insert(users).values({ id: STAFF.id, email: `staff-${STAFF.id}@example.org`, name: "Front desk", passwordHash: "x" });
  const userId = newId();
  ownerEmail = `owner-${userId}@example.org`;
  await db.insert(users).values({ id: userId, email: ownerEmail, name: "Owner", passwordHash: "x" });
  await db.insert(memberships).values({ userId, orgId, role: "owner" });
});

const create = (receivedAt: Date, over: Partial<Parameters<typeof createPrivacyRequest>[1]> = {}) =>
  db.transaction((tx) =>
    createPrivacyRequest(tx, { orgId, patientId, type: "access", channel: "email", requesterLocale: "de", actor: STAFF, now: receivedAt, ...over }),
  );

describe("reply contact (answerContact)", () => {
  it("joins contacts once, in order, and splits them back", () => {
    expect(joinContacts(["a@example.org", "+393331234567"])).toBe("a@example.org · +393331234567");
    expect(joinContacts(["b@example.org"], "a@example.org · b@example.org")).toBe("b@example.org · a@example.org");
    expect(joinContacts([], null)).toBeNull();
    expect(splitContacts("a@example.org · +393331234567")).toEqual(["a@example.org", "+393331234567"]);
    expect(splitContacts(null)).toEqual([]);
  });

  it("reads the column first, and the contact older rows kept in their details after the marker", () => {
    expect(requestTextAndContact({ details: "Vorrei la cancellazione", answerContact: "a@example.org" })).toEqual({ text: "Vorrei la cancellazione", contact: "a@example.org" });
    const legacy = "Vorrei la cancellazione\n\n[contact] a@example.org · +393331234567";
    expect(requestTextAndContact({ details: legacy, answerContact: null })).toEqual({ text: "Vorrei la cancellazione", contact: "a@example.org · +393331234567" });
    expect(splitContactSnapshot("[contact] b@example.org")).toEqual({ text: null, contact: "b@example.org" });
    expect(splitContactSnapshot("Solo testo")).toEqual({ text: "Solo testo", contact: null });
  });

  it("answers a request linked to no patient at its reply contact, in the requester's language", async () => {
    const { id } = await create(new Date("2030-06-01T09:00:00Z"), { patientId: null, answerContact: "lettera@example.org · +393339990000", requesterLocale: "it" });
    const [stored] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, id));
    expect(stored.answerContact).toBe("lettera@example.org · +393339990000");
    const raw = await client.execute({ sql: "select answer_contact from privacy_requests where id = ?", args: [id] });
    expect(String(raw.rows[0].answer_contact)).toMatch(/^v1:/); // encrypted at rest
    const done = await db.transaction((tx) =>
      completePrivacyRequest(tx, { orgId, id, decision: "granted", reason: "Ecco i dati richiesti.", actor: STAFF, now: new Date("2030-06-10T09:00:00Z") }),
    );
    expect(await notifyRequester(done, "requestGranted")).toBe(true);
    const [sent] = await db.select().from(messages).where(eq(messages.to, "lettera@example.org"));
    expect(sent).toMatchObject({ channel: "email", patientId: null, orgId });
    expect(sent.body).toContain("Ecco i dati richiesti.");
    // Without a reply contact there is nobody to send it to.
    const { id: bare } = await create(new Date("2030-06-01T09:00:00Z"), { patientId: null });
    const closed = await db.transaction((tx) => completePrivacyRequest(tx, { orgId, id: bare, decision: "granted", reason: "Fatto.", actor: STAFF }));
    expect(await notifyRequester(closed, "requestGranted")).toBe(false);
  });
});

describe("deadline (Art. 12(3))", () => {
  it("is the same date next calendar month, clamped to the month's end, at the same Italian time", () => {
    expect(rome(privacyRequestDueAt(new Date("2030-01-31T09:00:00Z")))).toBe("2030-02-28 10:00");
    expect(rome(privacyRequestDueAt(new Date("2028-01-31T09:00:00Z")))).toBe("2028-02-29 10:00");
    expect(rome(privacyRequestDueAt(new Date("2030-03-15T09:00:00Z")))).toBe("2030-04-15 10:00"); // across the DST change
    expect(rome(privacyRequestDueAt(new Date("2030-12-31T22:30:00Z")))).toBe("2031-01-31 23:30"); // 31 Dec in Rome
    expect(rome(privacyRequestDueAt(new Date("2030-05-31T09:00:00Z")))).toBe("2030-06-30 11:00");
  });

  it("a request received on 31 January is due on 28 February, stored and audited", async () => {
    const { id, dueAt } = await create(new Date("2030-01-31T09:00:00Z"));
    expect(rome(dueAt)).toBe("2030-02-28 10:00");
    const [row] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, id));
    expect(row.dueAt.getTime()).toBe(dueAt.getTime());
    expect(row.status).toBe("open");
    const [a] = await db.select().from(auditLog).where(and(eq(auditLog.action, "privacy_request.create"), eq(auditLog.entityId, id)));
    expect(a.metadata).toMatchObject({ type: "access", channel: "email" });
  });

  it("runs from receipt when a request is logged later", async () => {
    const now = new Date("2030-03-10T09:00:00Z");
    const { dueAt } = await create(now, { receivedAt: new Date("2030-03-05T09:00:00Z") });
    expect(rome(dueAt)).toBe("2030-04-05 10:00");
  });

  it("counts days left and overdue", () => {
    const r = { dueAt: new Date("2030-02-28T09:00:00Z"), extendedUntil: null };
    expect(daysLeft(r, new Date("2030-02-21T09:00:00Z"))).toBe(7);
    expect(daysLeft(r, new Date("2030-02-28T08:00:00Z"))).toBe(0);
    expect(daysLeft(r, new Date("2030-03-02T09:00:00Z"))).toBe(-2);
  });
});

describe("extension", () => {
  it("allows at most two months beyond the deadline, once, decided within the first month", async () => {
    const received = new Date("2030-01-31T09:00:00Z");
    const { id, dueAt } = await create(received);
    const max = maxExtensionUntil(dueAt);
    expect(rome(max)).toBe("2030-04-28 10:00");
    const step = (until: Date, reason = "Richiesta complessa", now = new Date("2030-02-10T09:00:00Z")) =>
      db.transaction((tx) => extendPrivacyRequest(tx, { orgId, id, until, reason, actor: STAFF, now }));

    await expect(step(new Date(max.getTime() + 60_000))).rejects.toMatchObject({ code: "extension_too_long" });
    await expect(step(addMonthsClamped(dueAt, 3))).rejects.toMatchObject({ code: "extension_too_long" });
    await expect(step(dueAt)).rejects.toMatchObject({ code: "extension_not_later" });
    await expect(step(max, "  ")).rejects.toMatchObject({ code: "reason_required" });
    await expect(step(max, "Troppe richieste", new Date(dueAt.getTime() + 1))).rejects.toMatchObject({ code: "extension_too_late" });

    const row = await step(max);
    expect(row.status).toBe("extended");
    expect(row.extendedUntil?.getTime()).toBe(max.getTime());
    await expect(step(max)).rejects.toMatchObject({ code: "already_extended" });
  });

  it("is sent to the requester with the reason", async () => {
    const { id, dueAt } = await create(new Date("2030-04-01T09:00:00Z"));
    const row = await db.transaction((tx) =>
      extendPrivacyRequest(tx, { orgId, id, until: addMonthsClamped(dueAt, 1), reason: "Archivio cartaceo da consultare", actor: STAFF, now: new Date("2030-04-05T09:00:00Z") }),
    );
    expect(await notifyRequester(row, "requestExtended")).toBe(true);
    const sent = await db.select().from(messages).where(eq(messages.patientId, patientId));
    const last = sent.at(-1)!;
    expect(last.channel).toBe("email");
    expect(last.to).toBe("ada.neri@example.org");
    expect(last.body).toContain("Archivio cartaceo da consultare");
  });
});

describe("handling", () => {
  it("starts, completes with a decision and lists by deadline", async () => {
    const { id } = await create(new Date("2030-05-01T09:00:00Z"), { type: "erasure" });
    const started = await db.transaction((tx) => startPrivacyRequest(tx, { orgId, id, actor: STAFF }));
    expect(started.status).toBe("in_progress");
    expect(started.handledByUserId).toBe(STAFF.id);
    const done = await db.transaction((tx) =>
      completePrivacyRequest(tx, { orgId, id, decision: "refused", reason: "Dati da conservare per legge (cartella clinica).", actor: STAFF, now: new Date("2030-05-10T09:00:00Z") }),
    );
    expect(done).toMatchObject({ status: "rejected", decision: "refused" });
    await expect(
      db.transaction((tx) => completePrivacyRequest(tx, { orgId, id, decision: "granted", reason: "x", actor: STAFF })),
    ).rejects.toMatchObject({ code: "closed" });
    const closed = await listPrivacyRequests(orgId, { status: "closed" });
    expect(closed.map((r) => r.request.id)).toContain(id);
    const other = (await createPractice()).orgId;
    expect(await listPrivacyRequests(other, { status: "all" })).toEqual([]);
  });
});

describe("deadline reminders", () => {
  it("sends the 7-day reminder exactly once, then the 2-day one", async () => {
    const received = new Date("2030-06-01T08:00:00Z");
    const { id, dueAt } = await create(received);
    const ownerMails = async () => (await db.select().from(messages).where(eq(messages.to, ownerEmail))).length;
    const base = await ownerMails();

    await sendDeadlineReminders(new Date(dueAt.getTime() - 8 * DAY));
    expect(await ownerMails()).toBe(base);

    const at7 = new Date(dueAt.getTime() - 7 * DAY + 3_600_000);
    await sendDeadlineReminders(at7);
    expect(await ownerMails()).toBe(base + 1);
    await sendDeadlineReminders(at7);
    await sendDeadlineReminders(new Date(at7.getTime() + DAY));
    expect(await ownerMails()).toBe(base + 1);

    const [row] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, id));
    expect(row.remindersSent).toEqual([`d7:${dueAt.getTime()}`]);

    const at2 = new Date(dueAt.getTime() - DAY);
    await sendDeadlineReminders(at2);
    await sendDeadlineReminders(at2);
    expect(await ownerMails()).toBe(base + 2);
  });

  it("sends nothing for closed or overdue requests", async () => {
    const { id, dueAt } = await create(new Date("2030-07-01T08:00:00Z"));
    await db.transaction((tx) => completePrivacyRequest(tx, { orgId, id, decision: "granted", reason: "Fatto", actor: STAFF }));
    const before = (await db.select().from(messages).where(eq(messages.to, ownerEmail))).length;
    await sendDeadlineReminders(new Date(dueAt.getTime() - DAY));
    await sendDeadlineReminders(new Date(dueAt.getTime() + DAY));
    expect((await db.select().from(messages).where(eq(messages.to, ownerEmail))).length).toBe(before);
  });
});
