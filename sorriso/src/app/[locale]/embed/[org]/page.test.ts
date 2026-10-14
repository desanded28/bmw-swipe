import { eq } from "drizzle-orm";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingFlow, type EmbedMessaging } from "@/components/booking/BookingFlow";
import { db } from "@/db";
import { organizations, type StoredOrgSettings } from "@/db/schema";
import { createPractice } from "@/test/fixtures";

let requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: () => undefined }),
}));

const { default: EmbedPage, generateMetadata } = await import("./page");

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

async function practice(embedOrigins: string[] = []) {
  const p = await createPractice();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId));
  const settings = { ...(org.settings as StoredOrgSettings), privacy: { ...(org.settings as StoredOrgSettings).privacy, embedOrigins } };
  await db.update(organizations).set({ settings }).where(eq(organizations.id, p.orgId));
  return org.slug;
}

function framedBy(referer: string | null) {
  requestHeaders = new Headers({ "sec-fetch-dest": "iframe", host: "sorriso.test" });
  if (referer) requestHeaders.set("referer", referer);
}

async function open(slug: string, query: Record<string, string>, locale = "de") {
  const tree = await EmbedPage({ params: Promise.resolve({ locale, org: slug }), searchParams: Promise.resolve(query) });
  const flow = findElement(tree, BookingFlow);
  return { tree, flow, embed: flow?.props.embed as EmbedMessaging | undefined };
}

beforeEach(() => {
  requestHeaders = new Headers();
});

describe("/[locale]/embed/[org]", () => {
  it("posts only to the validated host origin, and the booked event only when the host opted in", async () => {
    const slug = await practice();
    framedBy("https://host.example/contatti");
    const plain = await open(slug, { parent: "https://host.example" });
    expect(plain.embed).toEqual({ parentOrigin: "https://host.example", events: false, includeId: false });
    expect(plain.flow!.props.context).toBe("practice");
    expect(plain.flow!.props.practiceRef).toBeTruthy();

    const optedIn = await open(slug, { parent: "https://host.example", events: "1", id: "1" });
    expect(optedIn.embed).toEqual({ parentOrigin: "https://host.example", events: true, includeId: true });
  });

  it.each([
    ["not an origin", "https://host.example/page"],
    ["not https", "http://host.example"],
    ["garbage", "javascript:alert(1)"],
    ["missing", ""],
  ])("never posts to a parent that is %s", async (_, parent) => {
    const slug = await practice();
    framedBy(null);
    const { embed } = await open(slug, parent ? { parent } : {});
    expect(embed?.parentOrigin).toBeNull();
  });

  it("refuses a parent the browser's Referer contradicts, but not our own pages' Referer", async () => {
    const slug = await practice();
    framedBy("https://attacker.example/");
    expect((await open(slug, { parent: "https://host.example" })).embed?.parentOrigin).toBeNull();
    // The frame moved on inside itself (e.g. switched language): the Referer is our own page.
    framedBy(`https://sorriso.test/it/embed/${slug}?parent=https%3A%2F%2Fhost.example`);
    expect((await open(slug, { parent: "https://host.example" })).embed?.parentOrigin).toBe("https://host.example");
  });

  it("with allowed websites set, shows only a new-tab link to anyone else", async () => {
    const slug = await practice(["https://studio.example"]);
    framedBy("https://other.example/");
    const blocked = await open(slug, { parent: "https://other.example" });
    expect(blocked.flow).toBeNull();
    const html = renderToStaticMarkup(blocked.tree as ReactElement);
    expect(html).toContain(`href="/de/book/${slug}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Open the booking page in a new tab");

    framedBy(null);
    expect((await open(slug, {})).flow).toBeNull(); // no parent at all

    framedBy("https://studio.example/prenota");
    const allowed = await open(slug, { parent: "https://studio.example" });
    expect(allowed.embed?.parentOrigin).toBe("https://studio.example");
  });

  it("with allowed websites set, fails closed when no Referer vouches for the claimed parent", async () => {
    const slug = await practice(["https://studio.example"]);
    // evil.example frames us with referrerpolicy="no-referrer" and a spoofed ?parent.
    framedBy(null);
    const spoofed = await open(slug, { parent: "https://studio.example" });
    expect(spoofed.flow).toBeNull();
    expect(renderToStaticMarkup(spoofed.tree as ReactElement)).toContain("Open the booking page in a new tab");

    // Another of our pages is no proof either; only this practice's embed with the same parent is.
    framedBy("https://sorriso.test/it/c/studio");
    expect((await open(slug, { parent: "https://studio.example" })).flow).toBeNull();
    framedBy("https://sorriso.test/it/embed/another-practice?parent=https%3A%2F%2Fstudio.example");
    expect((await open(slug, { parent: "https://studio.example" })).flow).toBeNull();
    framedBy(`https://sorriso.test/it/embed/${slug}?parent=https%3A%2F%2Fevil.example`);
    expect((await open(slug, { parent: "https://studio.example" })).flow).toBeNull();
    // The frame switched language inside itself: the Referer is the same embed, same parent.
    framedBy(`https://sorriso.test/it/embed/${slug}?parent=https%3A%2F%2Fstudio.example`);
    expect((await open(slug, { parent: "https://studio.example" })).embed?.parentOrigin).toBe("https://studio.example");
  });

  it("with allowed websites set, applies the rule to browsers that send no Sec-Fetch-Dest when ?parent is given", async () => {
    const slug = await practice(["https://studio.example"]);
    requestHeaders = new Headers({ host: "sorriso.test" });
    expect((await open(slug, { parent: "https://studio.example" })).flow).toBeNull();

    // The listed host really framed us: the flow shows, still as a top-level page (no ref, no messages).
    requestHeaders = new Headers({ host: "sorriso.test", referer: "https://studio.example/" });
    const old = await open(slug, { parent: "https://studio.example" });
    expect(old.flow).not.toBeNull();
    expect(old.flow!.props.context).toBe("marketplace");
    expect(old.flow!.props.practiceRef).toBeNull();
    expect(old.embed?.parentOrigin).toBeNull();

    // Without ?parent such a request is an ordinary top-level visit.
    requestHeaders = new Headers({ host: "sorriso.test" });
    expect((await open(slug, {})).flow).not.toBeNull();
  });

  it("opened top-level, is a Sorriso page: marketplace, no messages, no practice ref", async () => {
    const slug = await practice(["https://studio.example"]);
    requestHeaders = new Headers({ "sec-fetch-dest": "document" });
    const { flow, embed } = await open(slug, { parent: "https://studio.example" });
    expect(flow).not.toBeNull();
    expect(flow!.props.context).toBe("marketplace");
    expect(flow!.props.practiceRef).toBeNull();
    expect(embed?.parentOrigin).toBeNull();
  });

  it("is never indexed and lists every language", async () => {
    const slug = await practice();
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "pt", org: slug }) });
    expect(meta.robots).toMatchObject({ index: false, follow: false });
    expect(Object.keys(meta.alternates?.languages ?? {})).toHaveLength(9);
  });
});
