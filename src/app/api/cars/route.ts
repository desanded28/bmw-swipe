import { NextResponse } from "next/server";

let cache: unknown = null;

const BRANDS = ["bmw", "audi", "porsche"];
const START_YEAR = 2010;
const END_YEAR = 2025;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

async function fetchTrims(make: string, year: number): Promise<unknown[]> {
  const url = `https://www.carqueryapi.com/api/0.3/?cmd=getTrims&make=${make}&year=${year}&callback=cb`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.startsWith("cb(")) continue;
      const jsonStr = text.replace(/^cb\(/, "").replace(/\);?\s*$/, "");
      const data = JSON.parse(jsonStr);
      return data.Trims || [];
    } catch {
      // retry
    }
  }
  return [];
}

// Run promises with limited concurrency
async function parallel<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;

  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function GET() {
  if (cache) return NextResponse.json(cache);

  try {
    // Build all brand+year tasks
    const tasks: (() => Promise<unknown[]>)[] = [];
    for (const make of BRANDS) {
      for (let year = START_YEAR; year <= END_YEAR; year++) {
        tasks.push(() => fetchTrims(make, year));
      }
    }

    // Run with max 3 concurrent requests to avoid rate limiting
    const results = await parallel(tasks, 3);
    const allTrims = results.flat();

    // Deduplicate by model_id + model_year
    const seen = new Set<string>();
    const deduped = allTrims.filter((t) => {
      const trim = t as Record<string, string>;
      const key = `${trim.model_id}-${trim.model_year}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`Fetched ${deduped.length} trims from CarQuery API`);
    cache = { Trims: deduped };
    return NextResponse.json(cache);
  } catch (e) {
    console.error("CarQuery fetch error:", e);
    return NextResponse.json(
      { error: "Failed to fetch car data" },
      { status: 500 }
    );
  }
}
