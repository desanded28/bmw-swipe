/**
 * public/widget.js runs on practices' websites. It is plain browser JavaScript, so this test runs it
 * against a minimal fake DOM: enough to see which URL the frame loads, what the dialog exposes to
 * assistive technology, where focus goes and which messages become page events.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(path.join(process.cwd(), "public/widget.js"), "utf8");
const ORIGIN = "https://sorriso.test";
const HOST = "https://host.example";

type Listener = (e: Record<string, unknown>) => void;

class FakeElement {
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];
  listeners: Record<string, Listener[]> = {};
  parent: FakeElement | null = null;
  contentWindow = {};
  [key: string]: unknown;
  constructor(
    public tagName: string,
    private env: Env,
  ) {}
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  appendChild(c: FakeElement) {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  addEventListener(type: string, fn: Listener) {
    (this.listeners[type] ??= []).push(fn);
  }
  focus() {
    this.env.focused = this;
  }
  find(pred: (e: FakeElement) => boolean): FakeElement | null {
    for (const c of this.children) {
      if (pred(c)) return c;
      const hit = c.find(pred);
      if (hit) return hit;
    }
    return null;
  }
}

type Env = {
  focused: FakeElement | null;
  body: FakeElement;
  host: FakeElement;
  events: { type: string; detail: Record<string, unknown> }[];
  message: Listener | null;
  keydown: Listener | null;
};

function runWidget(dataset: Record<string, string>, opts: { htmlLang?: string; browser?: string } = {}) {
  const env = { focused: null, events: [], message: null, keydown: null } as unknown as Env;
  env.body = new FakeElement("body", env);
  env.host = new FakeElement("div", env);
  const document = {
    currentScript: { src: `${ORIGIN}/widget.js`, dataset },
    documentElement: { lang: opts.htmlLang ?? "" },
    body: env.body,
    createElement: (tag: string) => new FakeElement(tag, env),
    querySelector: (sel: string) => (sel === "#booking" ? env.host : null),
    addEventListener: (type: string, fn: Listener) => {
      if (type === "keydown") env.keydown = fn;
    },
    removeEventListener: (type: string) => {
      if (type === "keydown") env.keydown = null;
    },
  };
  const window = {
    location: { origin: HOST },
    addEventListener: (type: string, fn: Listener) => {
      if (type === "message") env.message = fn;
    },
    dispatchEvent: (e: { type: string; detail: Record<string, unknown> }) => env.events.push(e),
  };
  class CustomEvent {
    constructor(
      public type: string,
      init: { detail: Record<string, unknown> },
    ) {
      this.detail = init.detail;
    }
    detail: Record<string, unknown>;
  }
  const navigator = { language: opts.browser ?? "" };
  const consoleCalls: unknown[][] = [];
  const record = (...args: unknown[]) => consoleCalls.push(args);
  new Function("window", "document", "navigator", "CustomEvent", "console", SOURCE)(window, document, navigator, CustomEvent, {
    log: record,
    info: record,
    warn: record,
    error: record,
  });
  return Object.assign(env, { consoleCalls });
}

const iframeIn = (root: FakeElement) => root.find((e) => e.tagName === "iframe");

describe("public/widget.js", () => {
  it("loads /<lang>/embed/<slug>?parent=<host origin> in data-lang's language", () => {
    const env = runWidget({ clinic: "studio-bianchi", lang: "de", target: "#booking" });
    const frame = iframeIn(env.host)!;
    const url = new URL(frame.src as string);
    expect(url.origin + url.pathname).toBe(`${ORIGIN}/de/embed/studio-bianchi`);
    expect(url.searchParams.get("parent")).toBe(HOST);
    expect(url.searchParams.has("events")).toBe(false);
    expect(url.searchParams.has("id")).toBe(false);
    expect(frame.title).toBe("Termin buchen");
  });

  it.each([
    [{ lang: "pl" }, {}, "pl"],
    [{}, { htmlLang: "ro-RO" }, "ro"],
    [{ lang: "xx" }, { htmlLang: "fr" }, "fr"],
    [{}, { htmlLang: "zh-CN", browser: "pt-BR" }, "pt"],
    [{}, { browser: "es-419" }, "es"],
    [{}, { browser: "ja-JP" }, "it"],
    [{}, {}, "it"],
  ])("picks the language from %o / %o -> %s", (data, opts, lang) => {
    const env = runWidget({ clinic: "x", target: "#booking", ...data }, opts);
    expect(new URL(iframeIn(env.host)!.src as string).pathname).toBe(`/${lang}/embed/x`);
  });

  it("forwards the booked event only when the host opted in, with the id only when asked", () => {
    const booked = (env: Env, frame: FakeElement, origin = ORIGIN) =>
      env.message!({ origin, source: frame.contentWindow, data: { source: "sorriso", type: "booked", appointmentId: "appt_1" } });

    const silent = runWidget({ clinic: "x", target: "#booking" });
    booked(silent, iframeIn(silent.host)!);
    expect(silent.events).toHaveLength(0);

    const opted = runWidget({ clinic: "x", target: "#booking", events: "" });
    const frame = iframeIn(opted.host)!;
    expect(new URL(frame.src as string).searchParams.get("events")).toBe("1");
    booked(opted, frame, "https://evil.example");
    opted.message!({ origin: ORIGIN, source: {}, data: { source: "sorriso", type: "booked" } });
    expect(opted.events).toHaveLength(0);
    booked(opted, frame);
    expect(opted.events).toEqual([{ type: "sorriso:booked", detail: { source: "sorriso", type: "booked" } }]);

    const withId = runWidget({ clinic: "x", target: "#booking", events: "", includeId: "" });
    const f2 = iframeIn(withId.host)!;
    expect(new URL(f2.src as string).searchParams.get("id")).toBe("1");
    booked(withId, f2);
    expect(withId.events[0].detail).toEqual({ source: "sorriso", type: "booked", appointmentId: "appt_1" });
  });

  it("resizes the inline frame from its own messages only", () => {
    const env = runWidget({ clinic: "x", target: "#booking" });
    const frame = iframeIn(env.host)!;
    env.message!({ origin: ORIGIN, source: frame.contentWindow, data: { source: "sorriso", type: "resize", height: 812.4 } });
    expect(frame.style.height).toBe("813px");
    env.message!({ origin: "https://evil.example", source: frame.contentWindow, data: { source: "sorriso", type: "resize", height: 5 } });
    expect(frame.style.height).toBe("813px");
  });

  it("opens a labelled modal dialog, moves focus into the frame and back to the button on close", () => {
    const env = runWidget({ clinic: "x", lang: "fr" });
    const button = env.body.find((e) => e.tagName === "button")!;
    expect(button.textContent).toBe("Prendre rendez-vous");
    expect(button.attrs["aria-expanded"]).toBe("false");
    (button.onclick as () => void)();

    const dialog = env.body.find((e) => e.attrs.role === "dialog")!;
    expect(dialog.attrs["aria-modal"]).toBe("true");
    expect(dialog.attrs["aria-label"]).toBe("Prendre rendez-vous");
    const frame = iframeIn(dialog)!;
    expect(frame.title).toBe("Prendre rendez-vous");
    expect(env.focused).toBe(frame);
    expect(button.attrs["aria-expanded"]).toBe("true");
    const close = dialog.find((e) => e.tagName === "button")!;
    expect(close.attrs["aria-label"]).toBe("Fermer");

    env.keydown!({ key: "Escape" });
    expect(dialog.style.display).toBe("none");
    expect(env.keydown).toBeNull();
    expect(env.focused).toBe(button);
    expect(button.attrs["aria-expanded"]).toBe("false");

    // Opening again shows the same frame: what the visitor typed is still there.
    (button.onclick as () => void)();
    expect(dialog.style.display).toBe("flex");
    expect(iframeIn(dialog)).toBe(frame);
    expect(env.body.children.filter((e) => e.attrs.role === "dialog")).toHaveLength(1);
    expect(env.focused).toBe(frame);
  });

  it("closes the dialog on Escape pressed inside the frame (its close message), from the frame only", () => {
    const env = runWidget({ clinic: "x" });
    const button = env.body.find((e) => e.tagName === "button")!;
    (button.onclick as () => void)();
    const dialog = env.body.find((e) => e.attrs.role === "dialog")!;
    const frame = iframeIn(dialog)!;
    const close = { source: "sorriso", type: "close" };
    env.message!({ origin: "https://evil.example", source: frame.contentWindow, data: close });
    env.message!({ origin: ORIGIN, source: {}, data: close });
    expect(dialog.style.display).toBe("flex");
    env.message!({ origin: ORIGIN, source: frame.contentWindow, data: close });
    expect(dialog.style.display).toBe("none");
    expect(env.focused).toBe(button);
  });

  it("ignores the close message for an inline frame", () => {
    const env = runWidget({ clinic: "x", target: "#booking" });
    const frame = iframeIn(env.host)!;
    env.message!({ origin: ORIGIN, source: frame.contentWindow, data: { source: "sorriso", type: "close" } });
    expect(iframeIn(env.host)).toBe(frame);
  });

  it("does nothing, silently, without data-clinic or with a target that matches nothing (no console)", () => {
    const none = runWidget({});
    expect(none.body.children).toHaveLength(0);
    const missing = runWidget({ clinic: "x", target: "#nowhere" });
    expect(missing.body.children).toHaveLength(0);
    expect([...none.consoleCalls, ...missing.consoleCalls]).toEqual([]);
  });

  it("keeps Tab inside the dialog with focus sentinels", () => {
    const env = runWidget({ clinic: "x" });
    const button = env.body.find((e) => e.tagName === "button")!;
    (button.onclick as () => void)();
    const dialog = env.body.find((e) => e.attrs.role === "dialog")!;
    const [first, , last] = dialog.children;
    expect(first.tabIndex).toBe(0);
    expect(last.tabIndex).toBe(0);
    last.listeners.focus[0]({});
    expect(env.focused?.attrs["aria-label"]).toBe("Chiudi");
    first.listeners.focus[0]({});
    expect(env.focused?.tagName).toBe("iframe");
  });
});
