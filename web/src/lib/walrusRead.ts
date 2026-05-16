import { walrusAggregatorUrl, walrusPublisherUrl } from "./config";
import { cacheGet, cacheSet, blobCacheKey, TTL_BLOB } from "./cache";

function requireReadBaseUrl(): string {
  const base = walrusAggregatorUrl ?? walrusPublisherUrl;
  if (!base) {
    throw new Error("Missing VITE_WALRUS_AGGREGATOR_URL (or VITE_WALRUS_PUBLISHER_URL fallback)");
  }
  return base;
}

export async function fetchWalrusText(blobId: string): Promise<string> {
  // Check cache first
  const cached = cacheGet<string>(blobCacheKey(blobId));
  if (cached !== null) return cached;

  const base = requireReadBaseUrl();
  const response = await fetch(`${base}/v1/blobs/${blobId}`);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Walrus read failed with ${response.status}`);
  }

  const text = await response.text();
  // Cache the result
  cacheSet(blobCacheKey(blobId), text, TTL_BLOB);
  return text;
}

export async function fetchWalrusJson<T>(blobId: string): Promise<T> {
  const text = await fetchWalrusText(blobId);
  return JSON.parse(text) as T;
}
