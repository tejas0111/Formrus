/**
 * Simple localStorage cache with TTL support.
 * Reduces repeated Walrus/Sui RPC calls for the same data.
 */

const PREFIX = "formrus_cache_";

interface CacheEntry<T> {
  data: T;
  expires: number;
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expires) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = { data, expires: Date.now() + ttlMs };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function cacheRemove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Cache key for a Walrus blob */
export function blobCacheKey(blobId: string): string {
  return `blob_${blobId}`;
}

/** Cache key for form events from a specific creator */
export function formEventsCacheKey(creator: string): string {
  return `forms_${creator.toLowerCase()}`;
}

/** Cache key for response events for a specific form */
export function responseEventsCacheKey(formId: string): string {
  return `responses_${formId}`;
}

/** Cache key for form on-chain object data */
export function formObjectCacheKey(formId: string): string {
  return `formobj_${formId}`;
}

// TTL constants
export const TTL_BLOB = 5 * 60 * 1000;        // 5 minutes — Walrus blobs don't change
export const TTL_EVENTS = 30 * 1000;            // 30 seconds — events are live data
export const TTL_FORM_OBJECT = 60 * 1000;       // 1 minute — on-chain state changes
