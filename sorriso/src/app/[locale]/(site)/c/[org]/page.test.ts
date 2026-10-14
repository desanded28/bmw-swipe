/**
 * /[locale]/c/[org]: the practice page renders fully (async server components resolved, client
 * components server-rendered) without any third-party request on load, shows only listed
 * practitioners, and never puts a treatment name next to a review.
 */
import { eq } from "drizzle-orm";
import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { appointments, locations, organizations, orgFunds, patients, practitioners, reviews, services } from "@/db/schema";
import { LOCALES, toLocale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/provider";
import { getMessages } from "@/i18n/t";
import { newId } from "@/lib/ids";
import { signPracticeRef } from "@/lib/privacy/context";
import { createPractice, NOW } from "@/test/fixtures";

type ProviderProps = Parameters<typeof I18nProvider>[0];

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 Firefox/131.0" }),
  cookies: async () => ({ get: () => undefined }),
}));

const { default: ClinicPage, generateMetadata } = await import("./page");

/** A tiny RSC renderer for tests: awaits async server components, leaves the rest to React. */
async function resolve(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolve));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (typeof el.type === "function" && el.type.constructor.name === "AsyncFunction") {
    return resolve(await (el.type as (props: unknown) => Promise<ReactNode>)(el.props));
  }
  if (el.props.children === undefined) return el;
  return cloneElement(el, undefined, await resolve(el.props.children));
}

async function html(slug: string, locale = "en", query: Record<string, string> = {}) {
  const tree = await ClinicPage({ params: Promise.resolve({ locale, org: slug }), searchParams: Promise.resolve(query) });
  // The [locale] layout provides these namespaces on every public page.
  const l = toLocale(locale);
  const page = createElement(I18nProvider, { locale: l, messages: getMessages(l, ["common", "a11y", "site", "errors", "booking"]) } as ProviderProps, await resolve(tree));
  return renderToStaticMarkup(page as ReactElement);
}

let p: Awaited<ReturnType<typeof createPractice>>;
let slug: string;
const SECRET_SERVICE = "Sbiancamento Riservato";

beforeAll(async () => {
  p = await createPractice();
  slug = (await db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, p.orgId)))[0].slug;
  await db.update(organizations).set({ medicalDirector: "Dott. Mario Verdi" }).where(eq(organizations.id, p.orgId));
  await db.update(practitioners).set({ publicProfile: true, profileApprovedAt: NOW }).where(eq(practitioners.id, p.drA));
  await db.update(practitioners).set({ publicProfile: true }).where(eq(practitioners.id, p.drC)); // not approved
  await db.update(locations).set({ lat: 45.4642, lng: 9.19, accessibility: { stepFree: true, transit: "Metro M1 Duomo" } }).where(eq(locations.id, p.milano));
  await db.update(services).set({ name: SECRET_SERVICE, priceType: "from", priceCents: 5000, priceMaxCents: 12000 }).where(eq(services.id, p.visit));
  await db.insert(orgFunds).values({ orgId: p.orgId, fundId: "fund_unisalute", mode: "direct", serviceIds: [p.visit] });
  const patientId = newId();
  const appointmentId = newId();
  await db.insert(patients).values({ id: patientId, orgId: p.orgId, firstName: "Ada", lastName: "Neri" });
  await db.insert(appointments).values({
    id: appointmentId,
    orgId: p.orgId,
    locationId: p.milano,
    practitionerId: p.drA,
    serviceId: p.visit,
    patientId,
    startsAt: NOW,
    endsAt: NOW,
    blockedUntil: NOW,
    status: "completed",
    source: "online",
    manageToken: `h:${appointmentId}`,
  });
  await db.insert(reviews).values({
    id: newId(),
    orgId: p.orgId,
    practitionerId: p.drA,
    appointmentId,
    rating: 5,
    comment: "Punctual and kind.",
    authorName: "Ada N.",
    authorDisplay: "pseudonym",
    status: "published",
    publishedAt: NOW,
  });
});

describe("/[locale]/c/[org]", () => {
  it("has no OpenStreetMap iframe until the visitor asks for the map", async () => {
    const page = await html(slug);
    expect(page).not.toContain("<iframe");
    expect(page).not.toContain("openstreetmap.org/export/embed");
    expect(page).toContain("Show map (loads content from openstreetmap.org)");
    expect(page).toMatch(/aria-expanded="false"/);
    // Directions leave the site without a referrer.
    expect(page).toMatch(/href="https:\/\/www\.openstreetmap\.org\/directions[^"]*"[^>]*rel="noreferrer noopener"/);
  });

  it("shows the medical director, price types, declared funds, accessibility and the rating breakdown", async () => {
    const page = await html(slug);
    expect(page).toContain("Medical director: Dott. Mario Verdi");
    expect(page).toContain("€50 to €120");
    expect(page).toContain("UniSalute");
    expect(page).toContain("Direct billing");
    expect(page).toContain("As declared by the practice");
    expect(page).toContain("Step-free access");
    expect(page).toContain("Metro M1 Duomo");
    expect(page).toContain("How we verify reviews");
    expect(page).toContain("Weighted score used for ranking");
  });

  it("lists only practitioners with an approved profile", async () => {
    const page = await html(slug);
    expect(page).toContain("Anna A");
    expect(page).not.toContain("Carla C");
    expect(page).not.toContain("Bruno B");
  });

  it("never renders a treatment name next to a review, and keeps pseudonymous authors pseudonymous", async () => {
    const page = await html(slug);
    const list = /<ul[^>]*aria-label="Patient reviews"[^>]*>([\s\S]*?)<\/ul>/.exec(page)?.[1] ?? "";
    expect(list).toContain("Punctual and kind.");
    expect(list).toContain("Verified patient");
    expect(list).not.toContain(SECRET_SERVICE);
    expect(list).not.toContain("Ada");
  });

  it("books as a marketplace booking unless the visitor came through the practice's own link", async () => {
    expect(await html(slug)).not.toMatch(/[?&;]ref=/);
    const ref = signPracticeRef(p.orgId);
    expect(await html(slug, "en", { ref })).toContain(`ref=${ref}`);
    expect(await html(slug, "en", { ref: "forged-ref-12345" })).not.toMatch(/[?&;]ref=/);
  });

  it("is a 404 when the practice left the marketplace, unless opened from its own link", async () => {
    const other = await createPractice();
    const [o] = await db.update(organizations).set({ listed: false }).where(eq(organizations.id, other.orgId)).returning();
    await expect(ClinicPage({ params: Promise.resolve({ locale: "it", org: o.slug }), searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
    await expect(html(o.slug, "it", { ref: signPracticeRef(o.id) })).resolves.toContain(o.name);
  });

  it("has hreflang alternates for every language", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "de", org: slug }), searchParams: Promise.resolve({}) });
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual([...LOCALES, "x-default"].sort());
    expect(meta.alternates?.canonical).toBe(`/de/c/${slug}`);
  });
});
