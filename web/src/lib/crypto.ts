/**
 * Convert bytes to hex string with 0x prefix.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Convert hex string (with or without 0x prefix) to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert hex string to number[] — needed for tx.pure.vector("u8", ...).
 */
export function hexToBytesArray(hex: string): number[] {
  return Array.from(hexToBytes(hex));
}

/**
 * SHA-256 hash, returned as 0x-prefixed hex.
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Normalize a DNA value (hex string, comma-separated bytes, number array, or base64-like string)
 * into a 0x-prefixed hex string. Handles all Sui SDK vector<u8> serialization formats.
 */
export function normalizeDna(raw: unknown): string {
  if (typeof raw === "string") {
    // Already a 0x-prefixed hex string
    if (raw.startsWith("0x")) return raw;
    // Comma-separated byte values: "171,205,18,52,..."
    if (/^\d+(,\d+)*$/.test(raw)) {
      const bytes = raw.split(",").map((p) => Number.parseInt(p, 10));
      return bytesToHex(new Uint8Array(bytes));
    }
    // Plain hex without 0x prefix (64 hex chars for 32-byte DNA)
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return "0x" + raw;
    // Return as-is for other formats (the caller should handle it)
    return raw;
  }
  if (Array.isArray(raw) && raw.every((v) => typeof v === "number")) {
    return bytesToHex(new Uint8Array(raw as number[]));
  }
  return "";
}
