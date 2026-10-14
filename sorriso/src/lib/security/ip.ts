/**
 * IP allow-lists for API keys: exact addresses or CIDR ranges, IPv4 and IPv6. Parsed to integers,
 * so "::ffff:203.0.113.5" matches "203.0.113.0/24" and "2001:db8::1" matches "2001:0db8:0:0::1".
 */

type Parsed = { v: 4 | 6; n: bigint };

function parseV4(s: string): bigint | null {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return parts.reduce((acc, p) => (acc << 8n) | BigInt(p), 0n);
}

function parseV6(s: string): bigint | null {
  let v = s.toLowerCase().replace(/%.*$/, ""); // drop a zone id ("fe80::1%eth0")
  const tail: bigint[] = [];
  const embedded = v.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embedded) {
    const n = parseV4(embedded[2]);
    if (n === null) return null;
    tail.push((n >> 16n) & 0xffffn, n & 0xffffn);
    v = embedded[1].endsWith("::") ? embedded[1] : embedded[1].slice(0, -1);
  }
  const halves = v.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return [...groups.map((g) => BigInt(parseInt(g, 16))), ...tail].reduce((acc, g) => (acc << 16n) | g, 0n);
}

export function parseIp(input: string): Parsed | null {
  const s = input.trim().replace(/^\[(.*)\]$/, "$1");
  const v4 = parseV4(s);
  if (v4 !== null) return { v: 4, n: v4 };
  if (!s.includes(":")) return null;
  const v6 = parseV6(s);
  if (v6 === null) return null;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) is the IPv4 address.
  if (v6 >> 32n === 0xffffn) return { v: 4, n: v6 & 0xffffffffn };
  return { v: 6, n: v6 };
}

type Range = { v: 4 | 6; base: bigint; bits: number };

/** "203.0.113.5", "203.0.113.0/24", "2001:db8::/32" -> a range; null when invalid. */
export function parseIpRange(input: string): Range | null {
  const [addr, prefix, extra] = input.trim().split("/");
  if (extra !== undefined || !addr) return null;
  const ip = parseIp(addr);
  if (!ip) return null;
  const max = ip.v === 4 ? 32 : 128;
  const bits = prefix === undefined ? max : /^\d{1,3}$/.test(prefix) ? Number(prefix) : NaN;
  if (!Number.isInteger(bits) || bits < 0 || bits > max) return null;
  const shift = BigInt(max - bits);
  return { v: ip.v, base: (ip.n >> shift) << shift, bits };
}

/** Normalised text form for storage (validates as it goes); null when invalid. */
export function normalizeIpRange(input: string): string | null {
  const trimmed = input.trim();
  return parseIpRange(trimmed) ? trimmed.toLowerCase() : null;
}

export function ipInRange(ip: string, range: string): boolean {
  const a = parseIp(ip);
  const r = parseIpRange(range);
  if (!a || !r || a.v !== r.v) return false;
  const shift = BigInt((r.v === 4 ? 32 : 128) - r.bits);
  return a.n >> shift === r.base >> shift;
}

/** Is `ip` allowed by the list? An empty or missing list allows everything. */
export function ipAllowed(ip: string, allowed: string[] | null | undefined): boolean {
  if (!allowed?.length) return true;
  return allowed.some((r) => ipInRange(ip, r));
}
