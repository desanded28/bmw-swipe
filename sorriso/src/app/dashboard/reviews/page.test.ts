/**
 * Smoke test of the WP7 dashboard pages: each renders (async server components resolved, client
 * components server-rendered) for its audience, in the staff member's language, without leaking
 * what it must not show.
 */
import { eq } from "drizzle-orm";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { appointments, organizations, orgFunds, patients, practitioners, reviews, users } from "@/db/schema";
import { CLIENT_NAMESPACES } from "@/i18n/namespaces";
import { I18nProvider } from "@/i18n/provider";
import { getMessages } from "@/i18n/t";
import type { StaffSession } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { heldCommentValue } from "@/lib/reviews";
import { createPractice, NOW } from "@/test/fixtures";

type ProviderProps = Parameters<typeof I18nProvider>[0];

const state = vi.hoisted(() => ({ session: null as StaffSession | null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getSession: async () => state.session,
  requireStaff: async () => {
    if (!state.session) throw new Error("no session in test");
    return state.session;
  },
  requirePlatformAdmin: async () => {
    if (!state.session?.user.isPlatformAdmin) throw new Error("not a platform admin");
    return state.session;
  },
}));

const pages = {
  reviews: () => import("./page"),
  services: () => import("../services/page"),
  locations: () => import("../locations/page"),
  funds: () => import("../settings/funds/page"),
  platform: () => import("../platform/page"),
  albo: () => import("../platform/practitioners/page"),
  moderation: () => import("../platform/reviews/page"),
};

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

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn() } as unknown as AppRouterInstance;

async function render(name: keyof typeof pages): Promise<string> {
  const { default: Page } = (await pages[name]()) as { default: (p: unknown) => Promise<ReactNode> };
  const tree = await resolve(await Page({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router }, createElement(I18nProvider, { locale: "en", messages: getMessages("en", CLIENT_NAMESPACES) } as ProviderProps, tree)) as ReactElement,
  );
}

let p: Awaited<ReturnType<typeof createPractice>>;

async function signIn(role: MembershipRole, platformAdmin = false) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
  state.session = {
    sessionId: "s",
    user: { id: `user-${role}`, name: "T", email: "t@example.com", isPlatformAdmin: platformAdmin, locale: "en" },
    org,
    role,
    orgs: [{ org, role }],
  } as unknown as StaffSession;
}

async function review(comment: string, status: "published" | "under_review", stored = comment) {
  const patientId = newId();
  const appointmentId = newId();
  await db.insert(patients).values({ id: patientId, orgId: p.orgId, firstName: "Ottavia", lastName: "Segreti" });
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
    rating: 4,
    comment: stored,
    authorName: "Ottavia S.",
    authorDisplay: "pseudonym",
    status,
    flags: status === "under_review" ? ["health.condition"] : [],
    publishedAt: status === "published" ? NOW : null,
  });
}

beforeAll(async () => {
  p = await createPractice();
  for (const id of ["user-owner", "user-reception"]) await db.insert(users).values({ id, email: `${id}@example.com`, name: id, passwordHash: "x" });
  await db.update(practitioners).set({ publicProfile: true, profileApprovedAt: NOW, alboProvince: "Milano", alboNumber: "42" }).where(eq(practitioners.id, p.drA));
  await db.insert(orgFunds).values({ orgId: p.orgId, fundId: "fund_fasi", mode: "direct", serviceIds: null });
  await review("Very kind, on time.", "published");
  await review("I have diabetes", "under_review", heldCommentValue("I have diabetes"));
});

async function renderEditor(): Promise<string> {
  const { PractitionerForm } = await import("@/components/dashboard/PractitionerForm");
  const { services } = await import("@/db/schema");
  const [practitioner] = await db.select().from(practitioners).where(eq(practitioners.id, p.drA));
  const svcs = await db.select().from(services).where(eq(services.orgId, p.orgId));
  const tree = await resolve(createElement(PractitionerForm, { practitioner, services: svcs, offered: [p.visit] }));
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router }, createElement(I18nProvider, { locale: "en", messages: getMessages("en", CLIENT_NAMESPACES) } as ProviderProps, tree)) as ReactElement,
  );
}

describe("PractitionerForm (rendered by WP6's team pages)", () => {
  it("gives managers the full editor with the public-profile tab, preview and approval", async () => {
    await signIn("owner");
    const html = await renderEditor();
    expect(html).toContain("Details and treatments");
    expect(html).toContain("Public profile");
    expect(html).toContain("Preview");
    expect(html).toContain("Albo degli Odontoiatri");
    expect(html).toContain("Approved on");
    expect(html).not.toContain("icsToken");
    expect(html).not.toContain("Remove me from the marketplace"); // only the practitioner themselves
  });

  it("gives the practitioner (own account, no team.manage) the preview, approval and opt-out only", async () => {
    await db.update(practitioners).set({ userId: "user-reception" }).where(eq(practitioners.id, p.drA));
    await signIn("reception");
    const html = await renderEditor();
    expect(html).toContain("Only practice managers can edit these details");
    expect(html).toContain("Remove me from the marketplace");
    expect(html).not.toContain('name="bio"');
    await db.update(practitioners).set({ userId: null }).where(eq(practitioners.id, p.drA));
  });
});

describe("WP7 dashboard pages", () => {
  it("reviews: reply and report for managers, never the author's identity or a held text", async () => {
    await signIn("owner");
    const page = await render("reviews");
    expect(page).toContain("Very kind, on time.");
    expect(page).toContain("Verified patient");
    expect(page).not.toContain("Ottavia");
    expect(page).not.toContain("I have diabetes");
    expect(page).not.toContain("v1:");
    expect(page).toMatch(/ Reply<\/button>/);
    expect(page).toMatch(/ Report<\/button>/);
    expect(page).not.toMatch(/>Hide<|>Publish<\/button>/);
    await signIn("reception");
    const reception = await render("reviews");
    expect(reception).toContain("Very kind, on time.");
    expect(reception).not.toMatch(/ Reply<\/button>/);
  });

  it("services, offices and health funds render their WP7 fields", async () => {
    await signIn("owner");
    const services = await render("services");
    expect(services).toContain("Type of price");
    expect(services).toContain("Sensitive treatment");
    const offices = await render("locations");
    expect(offices).toContain("Step-free access");
    expect(offices).toContain("Getting there");
    const funds = await render("funds");
    expect(funds).toContain("We work with FASI");
    expect(funds).toContain("Tax deduction");
  });

  it("platform pages: the Albo queue and the moderation queue with the held review", async () => {
    await signIn("owner", true);
    expect(await render("platform")).toContain("Albo verification");
    const albo = await render("albo");
    expect(albo).toContain("Province Milano, number 42");
    expect(albo).toContain("Mark as verified");
    const moderation = await render("moderation");
    expect(moderation).toContain("I have diabetes"); // moderators read held texts (decrypted)
    expect(moderation).toContain("Medical condition");
    expect(moderation).toContain("Statement of reasons");
  });
});
