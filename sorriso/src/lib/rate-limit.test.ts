import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { migrateOnce } from "@/test/fixtures";
import { hmac } from "./crypto";
import { newId } from "./ids";
import { clientIp, clientIpHash, clientNetworkHash, ipKey, ipNetwork, rateLimit, rateLimitByIp, userAgentHash } from "./rate-limit";

beforeAll(migrateOnce);

const MIN = 60_000;

describe("clientIp", () => {
  const withEnv = (env: Record<string, string | undefined>, fn: () => void) => {
    const before = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    const set = (vals: Record<string, string | undefined>) => {
      for (const [k, v] of Object.entries(vals)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    };
    set(env);
    try {
      fn();
    } finally {
      set(before);
    }
  };

  it("self-hosted: the last x-forwarded-for hop (the one our proxy appended), whatever else the client sends", () => {
    withEnv({ VERCEL: undefined, TRUSTED_IP_HEADER: undefined }, () => {
      // Headers a proxy that doesn't know them passes through untouched: not believed.
      expect(clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.1", "x-forwarded-for": "1.1.1.1" }))).toBe(
        "1.1.1.1",
      );
      expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "1.1.1.1" }))).toBe("1.1.1.1");
      // The client can prepend anything; only the hop our proxy appended is trusted.
      expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.1, 203.0.113.9" }))).toBe("203.0.113.9");
      expect(clientIp(new Headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
      // No x-forwarded-for at all (never under Next, which fills it in): x-real-ip.
      expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
      expect(clientIp(new Headers())).toBe("local");
      expect(clientIp(new Headers({ "x-real-ip": "<script>" }))).toBe("local");
    });
  });

  it("on Vercel: x-vercel-forwarded-for, which the platform's edge overwrites", () => {
    withEnv({ VERCEL: "1", TRUSTED_IP_HEADER: undefined }, () => {
      expect(clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.1", "x-forwarded-for": "1.1.1.1" }))).toBe(
        "203.0.113.7",
      );
      expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "1.1.1.1" }))).toBe("1.1.1.1");
    });
  });

  it("TRUSTED_IP_HEADER names the one header to believe", () => {
    withEnv({ VERCEL: undefined, TRUSTED_IP_HEADER: "X-Real-IP" }, () => {
      expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "1.1.1.1", "x-vercel-forwarded-for": "203.0.113.7" }))).toBe(
        "198.51.100.1",
      );
      expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1" }))).toBe("local");
    });
    withEnv({ VERCEL: "1", TRUSTED_IP_HEADER: "cf-connecting-ip" }, () => {
      expect(clientIp(new Headers({ "cf-connecting-ip": "2001:db8::5", "x-vercel-forwarded-for": "203.0.113.7" }))).toBe("2001:db8::5");
    });
    withEnv({ VERCEL: undefined, TRUSTED_IP_HEADER: "x-forwarded-for" }, () => {
      expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-real-ip": "198.51.100.1" }))).toBe("203.0.113.9");
    });
  });
});

describe("clientIpHash and userAgentHash", () => {
  it("store HMACs only, and nothing without a real client", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.5", "user-agent": "Mozilla/5.0 Test" });
    expect(clientIpHash(h)).toBe(hmac("203.0.113.5", "ip"));
    expect(userAgentHash(h)).toBe(hmac("Mozilla/5.0 Test", "ua"));
    expect(clientIpHash(new Headers())).toBeNull();
    expect(clientIpHash(undefined)).toBeNull();
    expect(userAgentHash(new Headers())).toBeNull();
    expect(userAgentHash(undefined)).toBeNull();
  });
});

describe("ipNetwork and clientNetworkHash", () => {
  it("keeps IPv4 addresses and buckets IPv6 by /64", () => {
    expect(ipNetwork("203.0.113.5")).toBe("203.0.113.5");
    expect(ipNetwork("2001:db8:a:b:1:2:3:4")).toBe("2001:db8:a:b::/64");
    expect(ipNetwork("2001:0DB8:000a:000b::ffff")).toBe("2001:db8:a:b::/64");
    expect(ipNetwork("[2001:db8::1]")).toBe("2001:db8:0:0::/64");
    expect(ipNetwork("::1")).toBe("0:0:0:0::/64");
    expect(ipNetwork("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(ipNetwork("64:ff9b::203.0.113.5")).toBe("64:ff9b:0:0::/64");
    expect(ipNetwork("1:2:3::4::5")).toBe("1:2:3::4::5"); // not an address: left as it is
  });

  it("hashes the network, with one shared bucket for requests without an address", () => {
    const v6 = (ip: string) => clientNetworkHash(new Headers({ "x-real-ip": ip }));
    expect(v6("2001:db8:1:2::1")).toBe(v6("2001:db8:1:2:aaaa::9"));
    expect(v6("2001:db8:1:2::1")).not.toBe(v6("2001:db8:1:3::1"));
    expect(v6("203.0.113.5")).toBe(hmac("203.0.113.5", "ip"));
    expect(clientNetworkHash(new Headers())).toBe(clientNetworkHash(new Headers({ "x-real-ip": "<script>" })));
    expect(ipKey(new Headers({ "x-real-ip": "2001:db8:1:2::1" }), "b")).toBe(ipKey(new Headers({ "x-real-ip": "2001:db8:1:2::2" }), "b"));
  });
});

describe("rateLimit", () => {
  it("allows `limit` hits per fixed window, then reports when to retry", async () => {
    const key = `t:${newId()}`;
    const t0 = new Date("2030-01-01T10:00:00Z");
    for (let i = 0; i < 3; i++) expect(await rateLimit(key, 3, 10 * MIN, t0)).toEqual({ ok: true, retryAfterSec: 0 });
    expect(await rateLimit(key, 3, 10 * MIN, new Date(t0.getTime() + 4 * MIN))).toEqual({ ok: false, retryAfterSec: 6 * 60 });
    // Still the same window one second before it ends.
    expect((await rateLimit(key, 3, 10 * MIN, new Date(t0.getTime() + 10 * MIN - 1000))).ok).toBe(false);
    // A new window starts once the old one has passed.
    const t1 = new Date(t0.getTime() + 10 * MIN);
    expect(await rateLimit(key, 3, 10 * MIN, t1)).toEqual({ ok: true, retryAfterSec: 0 });
    expect((await rateLimit(key, 3, 10 * MIN, t1)).ok).toBe(true);
    expect((await rateLimit(key, 3, 10 * MIN, t1)).ok).toBe(true);
    expect(await rateLimit(key, 3, 10 * MIN, t1)).toEqual({ ok: false, retryAfterSec: 600 });
  });

  it("keeps keys independent", async () => {
    const a = `t:${newId()}`;
    const b = `t:${newId()}`;
    expect((await rateLimit(a, 1, MIN)).ok).toBe(true);
    expect((await rateLimit(a, 1, MIN)).ok).toBe(false);
    expect((await rateLimit(b, 1, MIN)).ok).toBe(true);
  });

  it("counts concurrent hits exactly", async () => {
    const key = `t:${newId()}`;
    const results = await Promise.all(Array.from({ length: 12 }, () => rateLimit(key, 5, MIN)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
});

describe("rateLimitByIp", () => {
  it("limits per IP and bucket without storing the address", async () => {
    const bucket = `login-${newId()}`;
    const h1 = new Headers({ "x-real-ip": "203.0.113.77" });
    const h2 = new Headers({ "x-real-ip": "203.0.113.78" });
    expect((await rateLimitByIp(h1, bucket, 2, MIN)).ok).toBe(true);
    expect((await rateLimitByIp(h1, bucket, 2, MIN)).ok).toBe(true);
    expect((await rateLimitByIp(h1, bucket, 2, MIN)).ok).toBe(false);
    expect((await rateLimitByIp(h2, bucket, 2, MIN)).ok).toBe(true);
    expect((await rateLimitByIp(h1, `${bucket}-other`, 2, MIN)).ok).toBe(true);

    expect(ipKey(h1, bucket)).not.toContain("203.0.113");
    const keys = (await db.select({ key: rateLimits.key }).from(rateLimits)).map((r) => r.key);
    expect(keys).toContain(ipKey(h1, bucket));
    expect(keys.some((k) => k.includes("203.0.113"))).toBe(false);
  });
});
