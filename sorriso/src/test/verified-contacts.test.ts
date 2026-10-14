import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { isContactVerified, markContactVerified } from "@/lib/contact";
import { newId } from "@/lib/ids";
import { createPractice } from "./fixtures";

describe("per-contact verification", () => {
  it("records only the proven contact, idempotently", async () => {
    const p = await createPractice();
    const id = newId();
    await db.insert(patients).values({ id, orgId: p.orgId, firstName: "Ada", lastName: "Neri", phone: "+393331112223", email: "ada@example.com" });
    expect(await markContactVerified(id, { kind: "phone", value: "+39 333 111 2223" })).toBe(true);
    expect(await markContactVerified(id, { kind: "phone", value: "+393331112223" })).toBe(true);
    const [row] = await db.select().from(patients).where(eq(patients.id, id));
    expect(row.verifiedContacts).toHaveLength(1);
    expect(isContactVerified(row, "phone", "+393331112223")).toBe(true);
    expect(isContactVerified(row, "email", "ada@example.com")).toBe(false);
  });
});
