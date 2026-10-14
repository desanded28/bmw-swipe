import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, patients, reviews } from "@/db/schema";
import { createPractice, NOW } from "@/test/fixtures";
import { newId } from "./ids";
import { listPatientReviews, withdrawReview } from "./reviews";

let p: Awaited<ReturnType<typeof createPractice>>;

async function visit(patientId: string) {
  const id = newId();
  await db.insert(appointments).values({
    id,
    orgId: p.orgId,
    locationId: p.milano,
    practitionerId: p.drA,
    serviceId: p.visit,
    patientId,
    startsAt: NOW,
    endsAt: NOW,
    blockedUntil: NOW,
    status: "completed",
    source: "staff",
    manageToken: `h:${id}`,
  });
  return id;
}

async function review(appointmentId: string, rating: number, status: "published" | "under_review") {
  const id = newId();
  await db.insert(reviews).values({
    id,
    orgId: p.orgId,
    practitionerId: p.drA,
    appointmentId,
    rating,
    comment: `Rated ${rating}`,
    authorName: "Verified patient",
    status,
    createdAt: new Date(NOW.getTime() + rating * 1000),
  });
  return id;
}

async function patient() {
  const id = newId();
  await db.insert(patients).values({ id, orgId: p.orgId, firstName: "Luca", lastName: "Neri" });
  return id;
}

beforeAll(async () => {
  p = await createPractice();
});

describe("reviews (privacy-center hooks)", () => {
  it("lists the reviews about a patient's visits, newest first, and nobody else's", async () => {
    const [mine, other] = [await patient(), await patient()];
    const r3 = await review(await visit(mine), 3, "published");
    const r5 = await review(await visit(mine), 5, "under_review");
    await review(await visit(other), 4, "published");

    const list = await listPatientReviews([mine]);
    expect(list.map((r) => r.id)).toEqual([r5, r3]);
    expect(list[1]).toMatchObject({ orgId: p.orgId, rating: 3, comment: "Rated 3", status: "published" });
    expect(list[1].createdAt).toBeInstanceOf(Date);
    expect(await listPatientReviews([])).toEqual([]);
  });

  it("withdraws a review", async () => {
    const id = await review(await visit(await patient()), 4, "published");
    await withdrawReview(id, { type: "patient_link", id: null });
    const [row] = await db.select().from(reviews).where(eq(reviews.id, id));
    expect(row).toMatchObject({ status: "withdrawn", published: false });
  });
});
