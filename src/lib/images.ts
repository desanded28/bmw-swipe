// Client-side cache for fetched image URLs
const urlCache = new Map<string, string | null>();
const pendingFetches = new Map<string, Promise<string | null>>();

/**
 * Fetch a real photo URL for a BMW model from Wikipedia via our API proxy.
 * Returns null if no image is available.
 */
export async function fetchCarImageUrl(
  modelName: string
): Promise<string | null> {
  if (urlCache.has(modelName)) {
    return urlCache.get(modelName) ?? null;
  }

  // Dedupe concurrent requests for the same model
  if (pendingFetches.has(modelName)) {
    return pendingFetches.get(modelName)!;
  }

  const promise = fetch(`/api/image?model=${encodeURIComponent(modelName)}`)
    .then((res) => res.json())
    .then((data: { url: string | null }) => {
      urlCache.set(modelName, data.url);
      pendingFetches.delete(modelName);
      return data.url;
    })
    .catch(() => {
      urlCache.set(modelName, null);
      pendingFetches.delete(modelName);
      return null;
    });

  pendingFetches.set(modelName, promise);
  return promise;
}
