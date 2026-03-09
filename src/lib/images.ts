const urlCache = new Map<string, string | null>();
const pendingFetches = new Map<string, Promise<string | null>>();

export async function fetchCarImageUrl(
  modelName: string,
  brand: string = "BMW"
): Promise<string | null> {
  const key = `${brand}:${modelName}`;
  if (urlCache.has(key)) {
    return urlCache.get(key) ?? null;
  }

  if (pendingFetches.has(key)) {
    return pendingFetches.get(key)!;
  }

  const promise = fetch(
    `/api/image?model=${encodeURIComponent(modelName)}&brand=${encodeURIComponent(brand)}`
  )
    .then((res) => res.json())
    .then((data: { url: string | null }) => {
      urlCache.set(key, data.url);
      pendingFetches.delete(key);
      return data.url;
    })
    .catch(() => {
      urlCache.set(key, null);
      pendingFetches.delete(key);
      return null;
    });

  pendingFetches.set(key, promise);
  return promise;
}
