import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, patients, reviews } from "@/db/schema";
import { createPractice, NOW } from "@/test/fixtures";
import { newId } from "./ids";
import { buildRankInputs, scoreResult } from "./ranking";

let p: Awaited<ReturnType<typeof createPractice>>;

/** A completed visit with Dr. B and its review. */
async function reviewDrB(rating: number, status: "published" | "under_review") {
  const patientId = newId();
  const appointmentId = newId();
  await db.insert(patients).values({ id: patientId, orgId: p.orgId, firstName: "Luca", lastName: "Neri" });
  await db.insert(appointments).values({
    id: appointmentId,
    orgId: p.orgId,
    locationId: p.milano,
    practitionerId: p.drB,
    serviceId: p.visit,
    patientId,
    startsAt: NOW,
    endsAt: NOW,
    blockedUntil: NOW,
    status: "completed",
    source: "staff",
    manageToken: `h:${appointmentId}`,
  });
  await db.insert(reviews).values({
    id: newId(),
    orgId: p.orgId,
    practitionerId: p.drB,
    appointmentId,
    rating,
    authorName: "Verified patient",
    status,
  });
}

beforeAll(async () => {
  p = await createPractice();
});

describe("ranking (stub contract)", () => {
  it("builds one input per active practitioner from published ratings only", async () => {
    await reviewDrB(4, "published");
    await reviewDrB(2, "published");
    await reviewDrB(5, "under_review");

    const inputs = await buildRankInputs(p.orgId);
    expect(inputs.map((i) => i.practitionerId).sort()).toEqual([p.drA, p.drB, p.drC].sort());
    expect(inputs.find((i) => i.practitionerId === p.drB)).toEqual({
      practitionerId: p.drB,
      orgId: p.orgId,
      soonestSlotAt: null,
      ratingSum: 6,
      ratingCount: 2,
      staffCancelRate180d: 0,
      profileCompleteness: 0,
      cityMatch: false,
      distanceKm: null,
    });
    expect(inputs.find((i) => i.practitionerId === p.drA)).toMatchObject({ ratingSum: 0, ratingCount: 0 });
    expect(await buildRankInputs("no-such-org")).toEqual([]);
  });

  it("scores every result 0 with no reasons until WP7", async () => {
    const [input] = await buildRankInputs(p.orgId);
    const ctx = { globalMeanRating: 4.5, now: NOW, seed: "2030-03-01" };
    expect(scoreResult(input, ctx)).toEqual({ score: 0, reasons: [] });
  });
});
