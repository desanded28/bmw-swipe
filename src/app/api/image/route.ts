import { NextRequest, NextResponse } from "next/server";

const imageCache = new Map<string, string | null>();

async function tryWikipediaImage(articleTitle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`,
      {
        headers: {
          "User-Agent": "CarSwipeApp/1.0 (educational project)",
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const model = req.nextUrl.searchParams.get("model");
  const brand = req.nextUrl.searchParams.get("brand") || "BMW";
  if (!model) {
    return NextResponse.json({ error: "model param required" }, { status: 400 });
  }

  const cacheKey = `${brand}:${model}`;
  if (imageCache.has(cacheKey)) {
    const cached = imageCache.get(cacheKey);
    return NextResponse.json({ url: cached });
  }

  const candidates: string[] = [];

  if (brand === "Porsche") {
    candidates.push(`Porsche_${model.replace(/\s+/g, "_")}`);
    if (model.includes("911")) candidates.push("Porsche_911");
    candidates.push(`Porsche_${model.split(/\s+/)[0]}`);
  } else if (brand === "Audi") {
    candidates.push(`Audi_${model.replace(/\s+/g, "_")}`);
    const baseMatch = model.match(/^(?:RS\s*)?([A-Za-z]\d+)/i);
    if (baseMatch) candidates.push(`Audi_${baseMatch[1]}`);
    candidates.push(`Audi_${model.split(/\s+/)[0]}`);
  } else {
    candidates.push(`BMW_${model.replace(/\s+/g, "_")}`);
    const seriesMatch = model.match(/^(\d+\s*Series)/i);
    if (seriesMatch && model !== seriesMatch[1]) {
      candidates.push(`BMW_${seriesMatch[1].replace(/\s+/g, "_")}`);
    }
    if (!model.includes("Series")) {
      candidates.push(`BMW_${model.split(/\s+/)[0]}`);
    }
  }

  let wikiUrl: string | null = null;
  for (const title of candidates) {
    wikiUrl = await tryWikipediaImage(title);
    if (wikiUrl) break;
  }

  const imageUrl = wikiUrl
    ? `/api/image-proxy?url=${encodeURIComponent(wikiUrl)}`
    : null;

  imageCache.set(cacheKey, imageUrl);
  return NextResponse.json({ url: imageUrl });
}
