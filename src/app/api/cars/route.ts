import { NextResponse } from "next/server";

let cache: unknown = null;

const BRANDS = ["bmw", "audi", "porsche"];

export async function GET() {
  if (cache) return NextResponse.json(cache);

  try {
    const allTrims: unknown[] = [];

    for (const make of BRANDS) {
      const url = `https://www.carqueryapi.com/api/0.3/?cmd=getTrims&make=${make}&full_results=1&callback=cb`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });

      if (!res.ok) continue;

      const text = await res.text();
      const jsonStr = text.replace(/^cb\(/, "").replace(/\);?\s*$/, "");
      const data = JSON.parse(jsonStr);
      if (data.Trims) {
        allTrims.push(...data.Trims);
      }
    }

    cache = { Trims: allTrims };
    return NextResponse.json(cache);
  } catch (e) {
    console.error("CarQuery fetch error:", e);
    return NextResponse.json(
      { error: "Failed to fetch car data" },
      { status: 500 }
    );
  }
}
