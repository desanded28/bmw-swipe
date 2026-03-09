import { NextResponse } from "next/server";

let cache: unknown = null;

export async function GET() {
  if (cache) return NextResponse.json(cache);

  try {
    const url =
      "https://www.carqueryapi.com/api/0.3/?cmd=getTrims&make=bmw&full_results=1&callback=cb";
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API returned ${res.status}` },
        { status: 502 }
      );
    }

    const text = await res.text();

    // Strip JSONP wrapper: cb({...}); -> {...}
    const jsonStr = text.replace(/^cb\(/, "").replace(/\);?\s*$/, "");
    cache = JSON.parse(jsonStr);

    return NextResponse.json(cache);
  } catch (e) {
    console.error("CarQuery fetch error:", e);
    return NextResponse.json(
      { error: "Failed to fetch car data" },
      { status: 500 }
    );
  }
}
