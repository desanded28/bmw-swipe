import { and, eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { ReviewList } from "@/components/ReviewList";
import { db } from "@/db";
import { appointments, auditLog, consents, messages, patients, practitioners, reviewReports, reviews, users } from "@/db/schema";
import { I18nProvider } from "@/i18n/provider";
import { getMessages } from "@/i18n/t";
import { createPractice, NOW } from "@/test/fixtures";
import { getAppointmentDetails } from "./appointments";
import { getPublicReviews } from "./directory";
import { newId } from "./ids";
import { issueManageToken } from "./links";
import { createPatientSession } from "./privacy/patient-session";
import { recordStepUpVerification, reviewActing } from "./privacy/privacy-center";
import {
  appealAsAuthor,
  askAuthor,
  authorModerationView,
  decideHeldReview,
  decideReport,
  listPatientReviews,
  practiceReviews,
  recordAuthorResponse,
  replyAsPractice,
  reportAsPractice,
  reviewLinkToken,
  submitPublicNotice,
  reviewLinkActing,
  submitReview,
  updateReview,
  verifyReviewLinkToken,
  withdrawReview,
} from "./reviews";

type ProviderProps = Parameters<typeof I18nProvider>[0];

let p: Awaited<ReturnType<typeof createPractice>>;
const owner = { user: { id: "" }, org: { id: "" } };
const adminA = { id: "" };
const adminB = { id: "" };

async function user(name: string) {
  const id = newId();
  await db.insert(users).values({ id, email: `${id}@example.com`, name, passwordHash: "x" });
  return id;
}

/** A completed visit two days ago, with its patient link. */
async function visit(opts: { birthDate?: string; guardian?: boolean; bookedFor?: "self" | "minor" | "other_adult" } = {}) {
  const patientId = newId();
  await db.insert(patients).values({
    id: patientId,
    orgId: p.orgId,
    firstName: "Giulia",
    lastName: "Rossi",
    email: `${patientId}@example.com`,
    phone: "+393331112233",
    birthDate: opts.birthDate ?? "1980-05-01",
    locale: "en",
    ...(opts.guardian ? { guardianName: "Marta Rossi", guardianRelation: "parent" as const, guardianEmail: "marta@example.com" } : {}),
  });
  const id = newId();
  const { token, hash } = issueManageToken();
  const endsAt = new Date(Date.now() - 2 * 86_400_000);
  await db.insert(appointments).values({
    id,
    orgId: p.orgId,
    locationId: p.milano,
    practitionerId: p.drA,
    serviceId: p.visit,
    patientId,
    startsAt: new Date(endsAt.getTime() - 30 * 60_000),
    endsAt,
    blockedUntil: endsAt,
    status: "completed",
    source: "online",
    manageToken: `h:${id}`,
    manageTokenHash: hash,
    manageTokenEnc: token,
    ...(opts.bookedFor ? { bookedFor: opts.bookedFor } : {}),
    ...(opts.bookedFor === "other_adult" ? { bookedByName: "Paolo Verdi", bookedByEmail: "paolo.booker@example.com" } : {}),
  });
  return { token, appointmentId: id, patientId };
}

const base = { rating: 5, comment: "Kind and on time, the practice is spotless.", display: "pseudonym" as const, locale: "en" as const };

async function publishedReview(comment = base.comment) {
  const v = await visit();
  const res = await submitReview(v.token, { ...base, comment, consent: true });
  if (!res.ok) throw new Error(res.code);
  return { ...v, reviewId: res.reviewId };
}

const rowOf = async (id: string) => (await db.select().from(reviews).where(eq(reviews.id, id)))[0];

beforeAll(async () => {
  p = await createPractice();
  await db.update(practitioners).set({ publicProfile: true, profileApprovedAt: NOW }).where(eq(practitioners.orgId, p.orgId));
  owner.user.id = await user("Owner");
  owner.org.id = p.orgId;
  adminA.id = await user("Moderator A");
  adminB.id = await user("Moderator B");
});

describe("submitting a review", () => {
  it("fails without the publication consent and writes nothing", async () => {
    const v = await visit();
    expect(await submitReview(v.token, { ...base, consent: false })).toEqual({ ok: false, code: "consent_required" });
    expect(await db.select().from(reviews).where(eq(reviews.appointmentId, v.appointmentId))).toEqual([]);
    expect(await db.select().from(consents).where(eq(consents.patientId, v.patientId))).toEqual([]);
  });

  it("with consent: publishes, records review_publication in the ledger, and shows the author as 'Verified patient'", async () => {
    const v = await visit();
    const res = await submitReview(v.token, { ...base, consent: true });
    expect(res).toMatchObject({ ok: true, status: "published" });
    const row = await rowOf((res as { reviewId: string }).reviewId);
    expect(row).toMatchObject({ status: "published", published: true, authorDisplay: "pseudonym", locale: "en", flags: [] });
    expect(row.publishedAt).toBeInstanceOf(Date);
    const [consent] = await db.select().from(consents).where(eq(consents.patientId, v.patientId));
    expect(consent).toMatchObject({
      purpose: "review_publication",
      granted: true,
      orgId: null, // Sorriso's own consent (platform controller)
      textKey: "consents.review_publication.label",
      method: "web_checkbox",
      source: "review",
      appointmentId: v.appointmentId,
    });
    expect(row.consentId).toBe(consent.id);

    const publicRows = await getPublicReviews(p.orgId);
    const mine = publicRows.find((r) => r.id === row.id)!;
    expect(mine.authorName).toBeNull();
    const html = renderToStaticMarkup(
      createElement(I18nProvider, { locale: "en", messages: getMessages("en", ["reviews", "a11y"]) } as ProviderProps, createElement(ReviewList, { reviews: [mine] })),
    );
    expect(html).toContain("Verified patient");
    expect(html).not.toContain("Giulia");
    // Never a treatment name next to a review.
    expect(Object.keys(mine).some((k) => /service/i.test(k))).toBe(false);
    expect(html).not.toContain("Visit<");
  });

  it("shows first name and initial only when the author chooses it", async () => {
    const v = await visit();
    const res = await submitReview(v.token, { ...base, display: "first_initial", consent: true });
    const row = await rowOf((res as { reviewId: string }).reviewId);
    expect(row).toMatchObject({ authorDisplay: "first_initial", authorName: "Giulia R." });
  });

  it.each([
    ["a phone number", "Great, call me on 333 123 4567 for details"],
    ["'implant failed'", "My implant failed after a month"],
  ])("holds a comment with %s for moderation: not public, stored encrypted", async (_, comment) => {
    const v = await visit();
    const res = await submitReview(v.token, { ...base, comment, consent: true });
    expect(res).toMatchObject({ ok: true, status: "under_review" });
    const id = (res as { reviewId: string }).reviewId;
    const row = await rowOf(id);
    expect(row.status).toBe("under_review");
    expect(row.published).toBe(false);
    expect(row.flags.length).toBeGreaterThan(0);
    expect(row.comment!.startsWith("v1:")).toBe(true);
    expect((await getPublicReviews(p.orgId)).map((r) => r.id)).not.toContain(id);
    // The author still sees their own text.
    const [mine] = await listPatientReviews([v.patientId]);
    expect(mine.comment).toBe(comment);
  });

  it("refuses a second review of the same visit, an invalid rating and a visit not completed", async () => {
    const v = await visit();
    await submitReview(v.token, { ...base, consent: true });
    expect(await submitReview(v.token, { ...base, consent: true })).toEqual({ ok: false, code: "already_reviewed" });
    const w = await visit();
    expect(await submitReview(w.token, { ...base, rating: 6, consent: true })).toEqual({ ok: false, code: "rating_invalid" });
    await db.update(appointments).set({ status: "scheduled" }).where(eq(appointments.id, w.appointmentId));
    expect(await submitReview(w.token, { ...base, consent: true })).toEqual({ ok: false, code: "not_completed" });
    expect(await submitReview("not-a-token", { ...base, consent: true })).toEqual({ ok: false, code: "link_invalid" });
  });

  it("for a child under 14 the parent consents; without a guardian on file the review is refused; children stay pseudonymous", async () => {
    const child = await visit({ birthDate: "2020-01-01", guardian: true });
    const res = await submitReview(child.token, { ...base, display: "first_initial", consent: true });
    expect(res).toMatchObject({ ok: true });
    const [consent] = await db.select().from(consents).where(eq(consents.patientId, child.patientId));
    expect(consent.actorRelation).toBe("parent");
    expect((await rowOf((res as { reviewId: string }).reviewId)).authorDisplay).toBe("pseudonym");

    const alone = await visit({ birthDate: "2020-01-01" });
    expect(await submitReview(alone.token, { ...base, consent: true })).toEqual({ ok: false, code: "guardian_required" });
    expect(await db.select().from(reviews).where(eq(reviews.appointmentId, alone.appointmentId))).toEqual([]);
  });
});

describe("a visit someone else booked: only the patient reviews it", () => {
  const yearsAgo = (n: number) => `${new Date().getUTCFullYear() - n}-01-15`;

  it("another adult's booking: the link alone can't write, edit or delete; the patient can after the code, as themselves", async () => {
    const v = await visit({ bookedFor: "other_adult" });
    expect(await submitReview(v.token, { ...base, consent: true })).toEqual({ ok: false, code: "not_patient" });
    expect(await db.select().from(reviews).where(eq(reviews.appointmentId, v.appointmentId))).toEqual([]);
    expect(await db.select().from(consents).where(eq(consents.patientId, v.patientId))).toEqual([]);

    const d = (await getAppointmentDetails({ token: v.token }))!;
    expect(reviewLinkActing(d)).toBeNull();
    expect(await reviewActing(d, null)).toBeNull();
    // The booker signed in to the privacy center with their own contact: not the patient's record.
    const booker = (await createPatientSession({ kind: "email", value: "paolo.booker@example.com" })).session;
    expect(await reviewActing(d, booker)).toBeNull();

    // The patient, after the one-time code to their own contact (verifyCodeAction: the session,
    // and the contact recorded as verified for them).
    const contact = { kind: "email" as const, value: `${v.patientId}@example.com` };
    const own = (await createPatientSession(contact)).session;
    expect(await recordStepUpVerification(own, { patientId: v.patientId, contact })).toBe(true);
    const acting = await reviewActing(d, own);
    expect(acting).toEqual({ actor: { type: "patient_session", id: own.id }, actorRelation: "self" });
    const res = await submitReview(v.token, { ...base, consent: true, acting });
    expect(res).toMatchObject({ ok: true, status: "published" });
    const [consent] = await db.select().from(consents).where(eq(consents.patientId, v.patientId));
    expect(consent).toMatchObject({ purpose: "review_publication", granted: true, actorRelation: "self" });
    const [log] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "consent.record"), eq(auditLog.entityId, v.patientId)));
    expect(log).toMatchObject({ actorType: "patient_session", actorId: own.id });

    // Editing needs the patient too.
    expect(await updateReview(v.token, { ...base, rating: 2 })).toEqual({ ok: false, code: "not_patient" });
    expect(await updateReview(v.token, { ...base, rating: 2, acting })).toMatchObject({ ok: true });
  });

  it("a minor now 14 or older reviews their own visit: the parent who booked can't through the link", async () => {
    const teen = await visit({ bookedFor: "minor", birthDate: yearsAgo(15), guardian: true });
    expect(await submitReview(teen.token, { ...base, consent: true })).toEqual({ ok: false, code: "not_patient" });
    // The parent's own contact (the guardian's, on file) doesn't open the review for a patient of 14 or more.
    const parent = (await createPatientSession({ kind: "email", value: "marta@example.com" })).session;
    expect(await reviewActing((await getAppointmentDetails({ token: teen.token }))!, parent)).toBeNull();

    // A child under 14: the parent's link acts, as the parent.
    const child = await visit({ bookedFor: "minor", birthDate: yearsAgo(9), guardian: true });
    expect(reviewLinkActing((await getAppointmentDetails({ token: child.token }))!)).toMatchObject({ actorRelation: "parent" });
    expect(await submitReview(child.token, { ...base, consent: true })).toMatchObject({ ok: true });
  });
});

describe("the author edits and withdraws", () => {
  it("re-checks edits: health details hold it, a clean text publishes it", async () => {
    const r = await publishedReview();
    expect(await updateReview(r.token, { ...base, comment: "Now I'm pregnant and they were careful" })).toMatchObject({ ok: true, status: "under_review" });
    expect(await updateReview(r.token, { ...base, comment: "Careful and kind." })).toMatchObject({ ok: true, status: "published" });
    expect((await rowOf(r.reviewId)).editedAt).toBeInstanceOf(Date);
  });

  it("withdraws: status withdrawn, text cleared, consent withdrawn in the ledger, audited", async () => {
    const r = await publishedReview();
    await withdrawReview(r.reviewId, { type: "patient_session", id: null });
    const row = await rowOf(r.reviewId);
    expect(row).toMatchObject({ status: "withdrawn", published: false, comment: null });
    const ledger = await db.select().from(consents).where(and(eq(consents.patientId, r.patientId), eq(consents.purpose, "review_publication")));
    expect(ledger.map((c) => c.granted).sort()).toEqual([false, true]);
    expect(ledger.find((c) => !c.granted)?.source).toBe("privacy_center");
    const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, r.reviewId), eq(auditLog.action, "review.withdraw")));
    expect(entry).toMatchObject({ orgId: p.orgId, actorType: "patient_session" });
    expect(await updateReview(r.token, base)).toEqual({ ok: false, code: "closed" });
    await withdrawReview(r.reviewId, { type: "patient_link", id: null }); // idempotent
  });
});

describe("the practice", () => {
  it("replies only to published reviews and only after confirming; audited as review.reply", async () => {
    const r = await publishedReview();
    expect(await replyAsPractice(owner, { reviewId: r.reviewId, reply: "Thank you!", confirmed: false })).toEqual({ ok: false, code: "confirm_required" });
    expect(await replyAsPractice(owner, { reviewId: r.reviewId, reply: "Thank you!", confirmed: true })).toEqual({ ok: true, removed: false });
    expect((await rowOf(r.reviewId)).reply).toBe("Thank you!");
    expect(await db.select().from(auditLog).where(and(eq(auditLog.entityId, r.reviewId), eq(auditLog.action, "review.reply")))).toHaveLength(1);
    expect(await replyAsPractice({ ...owner, org: { id: "other-org" } }, { reviewId: r.reviewId, reply: "x", confirmed: true })).toEqual({ ok: false, code: "not_found" });
  });

  it("reports (the review is hidden until moderated), can't report twice, appeals once, then it is final", async () => {
    const r = await publishedReview();
    const first = await reportAsPractice(owner, { reviewId: r.reviewId, ground: "defamation", details: "This visit never happened like that." });
    expect(first).toMatchObject({ ok: true, appeal: false });
    expect((await rowOf(r.reviewId)).status).toBe("under_review");
    expect(await reportAsPractice(owner, { reviewId: r.reviewId, ground: "other", details: "Again please" })).toEqual({ ok: false, code: "already" });
    const [report] = await db.select().from(reviewReports).where(eq(reviewReports.reviewId, r.reviewId));
    expect(report.details!.startsWith("v1:")).toBe(true); // the practice's text may mention health details: encrypted

    expect(await decideReport(adminA, { reportId: report.id, decision: "keep", reason: "too short" })).toEqual({ ok: false, code: "reason_required" });
    const reason = "The review describes the patient's own experience of punctuality; no defamatory statement of fact.";
    expect(await decideReport(adminA, { reportId: report.id, decision: "keep", reason })).toEqual({ ok: true });
    expect((await rowOf(r.reviewId)).status).toBe("published");
    const [moderated] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, r.reviewId), eq(auditLog.action, "review.moderate")));
    expect(moderated).toMatchObject({ actorType: "platform_admin", actorId: adminA.id, reason });
    // The author was told (captured: no provider configured in tests).
    expect((await db.select().from(messages).where(eq(messages.patientId, r.patientId))).length).toBeGreaterThan(0);

    const appeal = await reportAsPractice(owner, { reviewId: r.reviewId, ground: "defamation", details: "We disagree with the decision." });
    expect(appeal).toMatchObject({ ok: true, appeal: true });
    expect((await rowOf(r.reviewId)).status).toBe("published"); // stays as decided during the appeal
    const appealId = (appeal as { reportId: string }).reportId;
    expect(await decideReport(adminA, { reportId: appealId, decision: "remove", reason })).toEqual({ ok: false, code: "not_allowed" });
    expect(await decideReport(adminB, { reportId: appealId, decision: "remove", reason: "On appeal: the review states as fact an event the records contradict." })).toEqual({ ok: true });
    expect((await rowOf(r.reviewId)).status).toBe("removed");
    expect(await reportAsPractice(owner, { reviewId: r.reviewId, ground: "other", details: "One more time" })).toEqual({ ok: false, code: "final" });
  });

  it("sees reviews pseudonymous, and no text of a review that was never public", async () => {
    await publishedReview();
    const held = await visit();
    await submitReview(held.token, { ...base, comment: "I have diabetes and they were careful", consent: true });
    const rows = await practiceReviews(p.orgId);
    expect(rows.every((r) => r.authorDisplay === "first_initial" || r.authorName === null)).toBe(true);
    const heldRow = rows.find((r) => r.status === "under_review" && r.report === null && r.flags.includes("health.condition"));
    expect(heldRow?.comment).toBeNull();
  });

  it("doesn't see a held edit of a once-published review, nor a removed text; sees the text its report hides", async () => {
    const row = async (id: string) => (await practiceReviews(p.orgId)).find((r) => r.id === id)!;
    // Published, then edited by the author into a held text: publishedAt stays, the text is new.
    const edited = await publishedReview();
    const secret = "My implant failed after a month, call 333 123 4567";
    expect(await updateReview(edited.token, { ...base, comment: secret })).toMatchObject({ ok: true, status: "under_review" });
    expect((await rowOf(edited.reviewId)).publishedAt).toBeInstanceOf(Date);
    expect(await row(edited.reviewId)).toMatchObject({ status: "under_review", comment: null });

    // Reported by the practice: the published text it is hiding stays readable for it...
    const reported = await publishedReview("They kept me waiting for an hour.");
    const rep = await reportAsPractice(owner, { reviewId: reported.reviewId, ground: "defamation", details: "We have the waiting-room log." });
    expect((await row(reported.reviewId)).comment).toBe("They kept me waiting for an hour.");
    // ...until a moderator removes it: the removed text is stored encrypted and not shown any more.
    const reportId = (rep as { reportId: string }).reportId;
    expect(await decideReport(adminA, { reportId, decision: "remove", reason: "States as fact a waiting time the records contradict." })).toEqual({ ok: true });
    expect((await rowOf(reported.reviewId)).comment!.startsWith("v1:")).toBe(true);
    expect(await row(reported.reviewId)).toMatchObject({ status: "removed", comment: null, canAppeal: false });
  });

  it("refuses a reply with health or contact details (server-side flagger) and records warn-level rules", async () => {
    const r = await publishedReview();
    for (const reply of ["Your implant failed because you smoke.", "Call us on 333 123 4567", "Write to dr.rossi@example.com"]) {
      expect(await replyAsPractice(owner, { reviewId: r.reviewId, reply, confirmed: true })).toEqual({ ok: false, code: "health_terms" });
    }
    expect((await rowOf(r.reviewId)).reply).toBeNull();
    expect(await db.select().from(auditLog).where(and(eq(auditLog.entityId, r.reviewId), eq(auditLog.action, "review.reply")))).toEqual([]);

    expect(await replyAsPractice(owner, { reviewId: r.reviewId, reply: "Glad the check-up was not painful.", confirmed: true })).toEqual({ ok: true, removed: false });
    const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, r.reviewId), eq(auditLog.action, "review.reply")));
    expect(entry.metadata).toMatchObject({ removed: false, flags: "health.symptom" });
  });
});

describe("the practice's appeal is only against decisions on its own reports", () => {
  const reason = "The review describes the author's own experience; nothing unlawful in it.";
  const practiceMail = async () => db.select().from(messages).where(eq(messages.to, `${owner.user.id}@example.com`));

  it("a review the automatic check held and a moderator published: the practice's report is a fresh one, and it is told the outcome", async () => {
    const v = await visit();
    const res = await submitReview(v.token, { ...base, comment: "No complications, very good", consent: true });
    const id = (res as { reviewId: string }).reviewId;
    expect(await decideHeldReview(adminA, { reviewId: id, decision: "keep", reason })).toEqual({ ok: true });
    expect((await practiceReviews(p.orgId)).find((r) => r.id === id)).toMatchObject({ status: "published", canAppeal: false, report: null });

    const mailsBefore = (await practiceMail()).length;
    const first = await reportAsPractice(owner, { reviewId: id, ground: "defamation", details: "This never happened." });
    expect(first).toMatchObject({ ok: true, appeal: false });
    expect((await rowOf(id)).status).toBe("under_review");
    const reportId = (first as { reportId: string }).reportId;
    expect(await decideReport(adminA, { reportId, decision: "keep", reason })).toEqual({ ok: true });
    expect((await practiceMail()).length).toBe(mailsBefore + 1);
    // Now the practice can appeal (the decision on its own report kept the review).
    expect((await practiceReviews(p.orgId)).find((r) => r.id === id)).toMatchObject({ canAppeal: true, report: { id: reportId, byPractice: true, decision: "keep", decisionReason: reason } });
    expect(await reportAsPractice(owner, { reviewId: id, ground: "defamation", details: "We disagree." })).toMatchObject({ ok: true, appeal: true });
  });

  it("a notice from the public: doesn't block the practice's report while open, and its decision isn't the practice's to appeal", async () => {
    const r = await publishedReview();
    const notice = { ground: "offensive" as const, explanation: "Rude.", name: "Bea", email: "bea.notifier@example.com", locale: "en" as const };
    const n1 = await submitPublicNotice({ reviewId: r.reviewId, ...notice });
    // While the notice is open the practice can still report (and its report hides the review).
    const rep = await reportAsPractice(owner, { reviewId: r.reviewId, ground: "defamation", details: "False statements." });
    expect(rep).toMatchObject({ ok: true, appeal: false });
    expect((await rowOf(r.reviewId)).status).toBe("under_review");
    expect(await decideReport(adminA, { reportId: (rep as { reportId: string }).reportId, decision: "keep", reason })).toEqual({ ok: true });
    expect(await decideReport(adminA, { reportId: (n1 as { reportId: string }).reportId, decision: "keep", reason })).toEqual({ ok: true });

    // A second review: only a notice, decided "keep". The practice's next report is fresh, not an appeal of the notice.
    const other = await publishedReview();
    const n2 = await submitPublicNotice({ reviewId: other.reviewId, ...notice });
    expect(await decideReport(adminA, { reportId: (n2 as { reportId: string }).reportId, decision: "keep", reason })).toEqual({ ok: true });
    expect((await practiceReviews(p.orgId)).find((x) => x.id === other.reviewId)).toMatchObject({ canAppeal: false, report: null });
    const notifierMails = async () => (await db.select().from(messages).where(eq(messages.to, notice.email))).length;
    const before = await notifierMails();
    const fresh = await reportAsPractice(owner, { reviewId: other.reviewId, ground: "defamation", details: "False statements." });
    expect(fresh).toMatchObject({ ok: true, appeal: false });
    expect((await rowOf(other.reviewId)).status).toBe("under_review");
    expect(await decideReport(adminA, { reportId: (fresh as { reportId: string }).reportId, decision: "remove", reason })).toEqual({ ok: true });
    expect(await notifierMails()).toBe(before); // the notifier isn't told about the practice's report
  });

  it("with a notice and the practice's report open together, neither decision undoes the other", async () => {
    const notice = { ground: "offensive" as const, explanation: "Rude.", name: "Dee", email: "dee@example.com", locale: "en" as const };
    // Keeping on the notice doesn't publish what the practice's open report is hiding.
    const r = await publishedReview();
    const n = await submitPublicNotice({ reviewId: r.reviewId, ...notice });
    const rep = await reportAsPractice(owner, { reviewId: r.reviewId, ground: "defamation", details: "False statements." });
    expect(await decideReport(adminA, { reportId: (n as { reportId: string }).reportId, decision: "keep", reason })).toEqual({ ok: true });
    expect((await rowOf(r.reviewId)).status).toBe("under_review");
    expect(await decideReport(adminA, { reportId: (rep as { reportId: string }).reportId, decision: "keep", reason })).toEqual({ ok: true });
    expect((await rowOf(r.reviewId)).status).toBe("published");

    // A removal on a notice isn't undone by the practice's pending appeal of an older "keep".
    const s2 = await publishedReview();
    const first = await reportAsPractice(owner, { reviewId: s2.reviewId, ground: "defamation", details: "False statements." });
    expect(await decideReport(adminA, { reportId: (first as { reportId: string }).reportId, decision: "keep", reason })).toEqual({ ok: true });
    const appeal = await reportAsPractice(owner, { reviewId: s2.reviewId, ground: "defamation", details: "We disagree." });
    expect(appeal).toMatchObject({ ok: true, appeal: true });
    const n2 = await submitPublicNotice({ reviewId: s2.reviewId, ...notice });
    expect(await decideReport(adminA, { reportId: (n2 as { reportId: string }).reportId, decision: "remove", reason })).toEqual({ ok: true });
    expect((await rowOf(s2.reviewId)).status).toBe("removed");
    expect(await decideReport(adminB, { reportId: (appeal as { reportId: string }).reportId, decision: "keep", reason })).toEqual({ ok: true });
    expect((await rowOf(s2.reviewId)).status).toBe("removed");
  });

  it("a decision in the practice's favour (removed) offers no appeal to the practice", async () => {
    const r = await publishedReview();
    const rep = await reportAsPractice(owner, { reviewId: r.reviewId, ground: "defamation", details: "False statements." });
    expect(await decideReport(adminA, { reportId: (rep as { reportId: string }).reportId, decision: "remove", reason })).toEqual({ ok: true });
    expect((await practiceReviews(p.orgId)).find((x) => x.id === r.reviewId)).toMatchObject({ status: "removed", canAppeal: false });
    expect(await reportAsPractice(owner, { reviewId: r.reviewId, ground: "other", details: "Appeal in our favour?" })).toEqual({ ok: false, code: "not_found" });
    expect((await rowOf(r.reviewId)).status).toBe("removed");
  });
});

describe("statements of reasons", () => {
  it("are stored encrypted on the report and the removed review, and read back in plain text", async () => {
    const r = await publishedReview();
    const rep = await reportAsPractice(owner, { reviewId: r.reviewId, ground: "offensive", details: "Mentions a patient by name." });
    const reportId = (rep as { reportId: string }).reportId;
    const reason = "Removed: the review names another patient and describes their HIV status.";
    expect(await decideReport(adminA, { reportId, decision: "remove", reason })).toEqual({ ok: true });
    const [stored] = await db.select().from(reviewReports).where(eq(reviewReports.id, reportId));
    expect(stored.decisionReason!.startsWith("v1:")).toBe(true);
    expect(stored.decisionReason).not.toContain("HIV");
    const review = await rowOf(r.reviewId);
    expect(review.removedReason!.startsWith("v1:")).toBe(true);

    expect((await practiceReviews(p.orgId)).find((x) => x.id === r.reviewId)?.report?.decisionReason).toBe(reason);
    const view = await authorModerationView(reviewLinkToken(reportId, new Date(Date.now() + 86_400_000)));
    expect(view?.report.decisionReason).toBe(reason);
    expect(view?.review.removedReason).toBe(reason);
  });
});

describe("moderation with the author", () => {
  it("tells the author the review is hidden only when it is", async () => {
    const lastBody = async (patientId: string) => {
      const rows = await db.select().from(messages).where(eq(messages.patientId, patientId));
      return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.body ?? "";
    };
    const byNotice = await publishedReview();
    await db.update(patients).set({ preferredChannel: "email" }).where(eq(patients.id, byNotice.patientId));
    const n = await submitPublicNotice({ reviewId: byNotice.reviewId, ground: "offensive", explanation: "Rude.", name: "Cy", email: "cy@example.com", locale: "en" });
    expect(await askAuthor(adminA, (n as { reportId: string }).reportId)).toEqual({ ok: true, sent: true });
    expect(await lastBody(byNotice.patientId)).toContain("stays published");
    expect(await lastBody(byNotice.patientId)).not.toContain("is hidden");

    const byPractice = await publishedReview();
    await db.update(patients).set({ preferredChannel: "email" }).where(eq(patients.id, byPractice.patientId));
    const rep = await reportAsPractice(owner, { reviewId: byPractice.reviewId, ground: "defamation", details: "False statements." });
    expect(await askAuthor(adminA, (rep as { reportId: string }).reportId)).toEqual({ ok: true, sent: true });
    expect(await lastBody(byPractice.patientId)).toContain("is hidden");
  });

  it("asks the author, who replies through the signed link within 7 days", async () => {
    const r = await publishedReview();
    const rep = await reportAsPractice(owner, { reviewId: r.reviewId, ground: "not_about_visit", details: "Not our patient." });
    const reportId = (rep as { reportId: string }).reportId;
    expect(await askAuthor(adminA, reportId)).toEqual({ ok: true, sent: true });
    const token = reviewLinkToken(reportId, new Date(Date.now() + 86_400_000));
    expect((await authorModerationView(token))?.canRespond).toBe(true);
    expect(await recordAuthorResponse(token, "I was there on that day.")).toEqual({ ok: true });
    const [row] = await db.select().from(reviewReports).where(eq(reviewReports.id, reportId));
    expect(row.status).toBe("open");
    expect(row.patientResponse!.startsWith("v1:")).toBe(true);
    expect(await recordAuthorResponse(token, "Again")).toEqual({ ok: false, code: "closed" });
  });

  it("decides a held review with reasons; the author can appeal a removal once", async () => {
    const v = await visit();
    const res = await submitReview(v.token, { ...base, comment: "Write to me at giulia@example.com", consent: true });
    const id = (res as { reviewId: string }).reviewId;
    expect(await decideHeldReview(adminA, { reviewId: id, decision: "remove", reason: "Contact details can't be published in a review." })).toEqual({ ok: true });
    expect((await rowOf(id)).status).toBe("removed");
    const [auto] = await db.select().from(reviewReports).where(eq(reviewReports.reviewId, id));
    expect(auto).toMatchObject({ status: "decided", decision: "remove", reporterUserId: null });
    const token = reviewLinkToken(auto.id, new Date(Date.now() + 86_400_000));
    expect((await authorModerationView(token))?.canAppeal).toBe(true);
    expect(await appealAsAuthor(token, "I removed the address, please look again.")).toEqual({ ok: true });
    expect(await appealAsAuthor(token, "Twice")).toEqual({ ok: false, code: "closed" });
  });

  it("publishes a held review a moderator keeps, in plain text", async () => {
    const v = await visit();
    const res = await submitReview(v.token, { ...base, comment: "No complications at all, very good", consent: true });
    const id = (res as { reviewId: string }).reviewId;
    expect((await rowOf(id)).status).toBe("under_review");
    expect(await decideHeldReview(adminA, { reviewId: id, decision: "keep", reason: "Says there were no complications: no health detail about the author." })).toEqual({ ok: true });
    const row = await rowOf(id);
    expect(row).toMatchObject({ status: "published", comment: "No complications at all, very good" });
  });

  it("rejects tampered or expired moderation links", () => {
    const token = reviewLinkToken("abcdefABCDEF", new Date(Date.now() + 60_000));
    expect(verifyReviewLinkToken(token)).toEqual({ reportId: "abcdefABCDEF" });
    expect(verifyReviewLinkToken(token.replace("abcdef", "abcdeg"))).toBeNull();
    expect(verifyReviewLinkToken(reviewLinkToken("abcdefABCDEF", new Date(Date.now() - 60_000)))).toBeNull();
    expect(verifyReviewLinkToken("garbage")).toBeNull();
  });
});

describe("notices from the public (DSA Art. 16)", () => {
  it("records the notice without hiding the review, and confirms receipt by email", async () => {
    const r = await publishedReview();
    const res = await submitPublicNotice({
      reviewId: r.reviewId,
      ground: "offensive",
      explanation: "Insults a member of staff by name.",
      name: "Anna",
      email: "anna.notifier@example.com",
      locale: "en",
    });
    expect(res).toMatchObject({ ok: true });
    expect((await rowOf(r.reviewId)).status).toBe("published");
    const [report] = await db.select().from(reviewReports).where(eq(reviewReports.reviewId, r.reviewId));
    expect(report).toMatchObject({ status: "open", reporterUserId: null });
    expect(report.reporterContactHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await db.select().from(messages).where(eq(messages.to, "anna.notifier@example.com"))).toHaveLength(1);
    expect(await submitPublicNotice({ reviewId: "nope", ground: "other", explanation: "x", name: "A", email: "a@b.co", locale: "en" })).toEqual({
      ok: false,
      code: "not_found",
    });
  });
});

describe("listPatientReviews (privacy center)", () => {
  it("lists the reviews about a patient's visits, newest first, and nobody else's", async () => {
    const mine = await publishedReview();
    await publishedReview();
    const list = await listPatientReviews([mine.patientId]);
    expect(list.map((r) => r.id)).toEqual([mine.reviewId]);
    expect(list[0]).toMatchObject({ orgId: p.orgId, rating: 5, comment: base.comment, status: "published" });
    expect(list[0].createdAt).toBeInstanceOf(Date);
    expect(await listPatientReviews([])).toEqual([]);
  });
});
