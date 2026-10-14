/**
 * /[locale]/c/[org]/[practitioner]: only listed practitioners have a page (approved profile, no
 * opt-out); the page shows the verified Albo badge and legal specialisations only once verified,
 * hands the booking form server-formatted prices (with the price types) and counts a view
 * server-side.
 */
import { and, eq } from "drizzle-orm";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { ProfileFacts, type ProfileFactsData } from "@/components/marketplace/ProfileFacts";
import { db } from "@/db";
import { organizations, practitioners, profileStats, services } from "@/db/schema";
import { LOCALES } from "@/i18n/config";
import { formatMoney } from "@/i18n/number";
import { todayIn } from "@/lib/time";
import { createPractice, NOW } from "@/test/fixtures";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0" }),
  cookies: async () => ({ get: () => undefined }),
}));

const { default: PractitionerPage, generateMetadata } = await import("./page");

function findElement(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findElement(n, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (node.type === type) return node as ReactElement<Record<string, unknown>>;
  return findElement((node.props as { children?: ReactNode }).children, type);
}

/** The first element whose only child is this text. */
function findText(node: ReactNode, text: string): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findText(n, text);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const props = node.props as { children?: ReactNode };
  if (props.children === text) return node as ReactElement<Record<string, unknown>>;
  return findText(props.children, text);
}

let p: Awaited<ReturnType<typeof createPractice>>;
let slug: string;
const open = (practitioner: string, locale = "it") =>
  PractitionerPage({ params: Promise.resolve({ locale, org: slug, practitioner }), searchParams: Promise.resolve({}) });

beforeAll(async () => {
  p = await createPractice();
  slug = (await db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, p.orgId)))[0].slug;
  // a: listed and Albo-verified; b: public but never approved; c: approved, then opted out.
  await db
    .update(practitioners)
    .set({
      publicProfile: true,
      profileApprovedAt: NOW,
      spokenLanguages: ["it", "fr"],
      specializations: ["orthodontics"],
      alboProvince: "Milano",
      alboNumber: "1234",
      alboVerifiedAt: NOW,
    })
    .where(eq(practitioners.id, p.drA));
  await db.update(practitioners).set({ publicProfile: true, profileApprovedAt: null }).where(eq(practitioners.id, p.drB));
  await db.update(practitioners).set({ publicProfile: true, profileApprovedAt: NOW, marketplaceOptOutAt: NOW, specializations: ["oral_surgery"] }).where(eq(practitioners.id, p.drC));
});

const notFound = { digest: expect.stringContaining("404") };

describe("/[locale]/c/[org]/[practitioner]", () => {
  it("is a 404 without profile approval", async () => {
    await expect(open("b")).rejects.toMatchObject(notFound);
  });

  it("is a 404 after the practitioner removed themselves from the marketplace", async () => {
    await expect(open("c")).rejects.toMatchObject(notFound);
  });

  it("renders a listed profile with the verified Albo badge and specialisations, and books as marketplace", async () => {
    const tree = await open("a");
    const facts = findElement(tree, ProfileFacts)!.props.profile as ProfileFactsData;
    expect(facts.albo).toEqual({ province: "Milano", verifiedAt: NOW });
    expect(facts.specializations).toEqual(["orthodontics"]);
    expect(facts.spokenLanguages).toEqual(["it", "fr"]);
    const flow = findElement(tree, BookingFlow)!;
    expect(flow.props.context).toBe("marketplace");
    expect(flow.props.practiceRef).toBeNull();
  });

  it("gives the booking form the practice's price types, formatted on the server", async () => {
    await db.update(services).set({ priceType: "from", priceCents: 5000, priceMaxCents: 9000 }).where(eq(services.id, p.visit));
    await db.update(services).set({ priceType: "quote", priceCents: null }).where(eq(services.id, p.cleaning));
    const labels = findElement(await open("a", "en"), BookingFlow)!.props.labels as { services: Record<string, { price: string; duration: string }> };
    expect(labels.services[p.visit]).toEqual({ price: `${formatMoney(5000, "en")} to ${formatMoney(9000, "en")}`, duration: "30 min" });
    expect(labels.services[p.cleaning].price).toBe("Price after an assessment");
  });

  it("hides specialisations until the Albo registration is verified", async () => {
    await db.update(practitioners).set({ alboVerifiedAt: null }).where(eq(practitioners.id, p.drA));
    const facts = findElement(await open("a"), ProfileFacts)!.props.profile as ProfileFactsData;
    expect(facts.albo).toBeNull();
    expect(facts.specializations).toEqual([]);
    await db.update(practitioners).set({ alboVerifiedAt: NOW }).where(eq(practitioners.id, p.drA));
  });

  it("shows the practice's areas of interest with their language, and a translated default when left empty", async () => {
    await db.update(practitioners).set({ specialty: "Implantologia" }).where(eq(practitioners.id, p.drA));
    expect(findText(await open("a", "en"), "Implantologia")?.props.lang).toBe("it");
    await db.update(practitioners).set({ specialty: "" }).where(eq(practitioners.id, p.drA));
    const fallback = findText(await open("a", "en"), "Dentist");
    expect(fallback).not.toBeNull();
    expect(fallback!.props.lang).toBeUndefined();
    await db.update(practitioners).set({ specialty: "Dentist" }).where(eq(practitioners.id, p.drA));
  });

  it("counts a view per visit (no cookie)", async () => {
    const day = todayIn("Europe/Rome");
    const views = async () => (await db.select().from(profileStats).where(and(eq(profileStats.practitionerId, p.drA), eq(profileStats.day, day))))[0]?.views ?? 0;
    const before = await views();
    await open("a");
    expect(await views()).toBe(before + 1);
  });

  it("has hreflang alternates; unlisted practitioners get no metadata", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "pl", org: slug, practitioner: "a" }), searchParams: Promise.resolve({}) });
    expect(Object.keys(meta.alternates?.languages ?? {}).sort()).toEqual([...LOCALES, "x-default"].sort());
    expect(meta.alternates?.canonical).toBe(`/pl/c/${slug}/a`);
    expect(await generateMetadata({ params: Promise.resolve({ locale: "pl", org: slug, practitioner: "b" }), searchParams: Promise.resolve({}) })).toEqual({});
  });
});
