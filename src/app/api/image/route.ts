import { NextRequest, NextResponse } from "next/server";

// Cache Wikipedia image URLs in memory: modelName -> imageUrl
const imageCache = new Map<string, string | null>();

async function tryWikipediaImage(articleTitle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`,
      {
        headers: {
          "User-Agent": "BMWSwipeApp/1.0 (educational project)",
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    // Use thumbnail as-is (fast, ~320px) — reliable across all Wikipedia images
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const model = req.nextUrl.searchParams.get("model");
  if (!model) {
    return NextResponse.json({ error: "model param required" }, { status: 400 });
  }

  if (imageCache.has(model)) {
    const cached = imageCache.get(model);
    return NextResponse.json({ url: cached });
  }

  // Try multiple Wikipedia article patterns
  const candidates = [
    `BMW_${model.replace(/\s+/g, "_")}`,
  ];

  // If model has extra words like "Gran Turismo", also try the base series
  const seriesMatch = model.match(/^(\d+\s*Series)/i);
  if (seriesMatch && model !== seriesMatch[1]) {
    candidates.push(`BMW_${seriesMatch[1].replace(/\s+/g, "_")}`);
  }

  // Try just "BMW_X5" for names like "X5", "X3", "Z4", "M3", etc.
  if (!model.includes("Series")) {
    candidates.push(`BMW_${model.split(/\s+/)[0]}`);
  }

  let wikiUrl: string | null = null;
  for (const title of candidates) {
    wikiUrl = await tryWikipediaImage(title);
    if (wikiUrl) break;
  }

  const imageUrl = wikiUrl
    ? `/api/image-proxy?url=${encodeURIComponent(wikiUrl)}`
    : null;

  imageCache.set(model, imageUrl);
  return NextResponse.json({ url: imageUrl });
}
