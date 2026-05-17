import type { EventId } from "@mysten/sui/jsonRpc";
import type { MoveStruct } from "@mysten/sui/jsonRpc";

/** Safely cast unknown value to Record */
export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

/** Safely extract string[] from unknown value */
export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

/** Format EventId to human-readable digest string */
export function eventDigest(id: EventId): string {
  return `${id.txDigest}#${id.eventSeq}`;
}

/** Format epoch ms to locale string */
export function formatTime(ms: string | number): string {
  const parsed = Number(ms);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Unknown";
  return new Date(parsed).toLocaleString();
}

/** Shorten a hex/address string with ellipsis */
export function shorten(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

/** Allow only http/https URLs — prevents CSS/JS injection */
export function safeUrl(url: string | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "";
}

/** Stringify any value for display */
export function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const record = asRecord(item);
          const name = typeof record.name === "string" ? record.name : "";
          const blobId = typeof record.blobId === "string" ? record.blobId : "";
          if (name && blobId) return `${name} (${blobId})`;
          if (name) return name;
          if (blobId) return blobId;
          return JSON.stringify(item);
        }
        return String(item);
      })
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Parse balance mist from Move object fields */
export function parseBalanceMist(value: unknown): number | null {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const record = asRecord(value);
  const fields = asRecord(record.fields);
  const parsed = Number(fields.value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse form chain state from Move object content */
export interface FormChainState {
  dna: string;
  schemaBlobId: string;
  actionType: number;
  rewardAmountMist: number;
  remainingPoolMist: number | null;
  active: boolean;
  createdAtMs: string;
  admins: string[];
  viewers: string[];
  creator: string;
  maxPerAddress: number;
  maxTotal: number;
  expiresAtMs: string;
}

/** Normalize a Sui address to 0x + 64 hex chars. Returns empty string if invalid. */
export function normalizeSuiAddress(addr: string): string {
  const clean = addr.trim();
  if (!clean) return "";
  const hex = clean.startsWith("0x") ? clean.slice(2) : clean;
  if (!/^[0-9a-fA-F]{1,64}$/.test(hex)) return "";
  return "0x" + hex.toLowerCase().padStart(64, "0");
}

/** VecSet<address> serializes as { contents: [...] } in Sui JSON. */
export function readAddressSet(field: unknown): string[] {
  let raw: unknown[] = [];
  if (Array.isArray(field)) {
    raw = field;
  } else {
    const vecSet = asRecord(field);
    const vecSetFields = asRecord(vecSet.fields);
    if (Array.isArray(vecSetFields.contents)) {
      raw = vecSetFields.contents;
    } else if (Array.isArray(vecSet.contents)) {
      raw = vecSet.contents;
    }
  }
  return raw.map((item) => normalizeSuiAddress(String(item))).filter(Boolean);
}

export function parseFormFields(content: MoveStruct, normalizeDna: (raw: unknown) => string): FormChainState {
  const moveObject = asRecord(content as unknown);
  const fields = asRecord(moveObject.fields);
  const dna = normalizeDna(fields.dna);
  const schemaBlobId = String(fields.schema_blob_id ?? "");
  if (!dna || !schemaBlobId) throw new Error("Form object missing dna/schema_blob_id fields.");
  return {
    dna,
    schemaBlobId,
    actionType: Number(fields.action_type ?? 0),
    rewardAmountMist: Number(fields.reward_amount ?? 0),
    remainingPoolMist: parseBalanceMist(fields.fee_pool),
    active: Boolean(fields.active ?? true),
    createdAtMs: String(fields.created_at_ms ?? "0"),
    admins: readAddressSet(fields.admins),
    viewers: readAddressSet(fields.viewers),
    creator: String(fields.creator ?? ""),
    // Current on-chain Form field is `max_submissions_per_address`.
    // Keep `max_per_address` as fallback for compatibility with older object shapes.
    maxPerAddress: Number(fields.max_submissions_per_address ?? fields.max_per_address ?? 0),
    maxTotal: Number(fields.max_total_submissions ?? 0),
    expiresAtMs: String(fields.expires_at_ms ?? "0"),
  };
}

/** Convert SUI string to mist BigInt safely (avoids Number precision loss) */
export function suiToMist(sui: string): bigint {
  const trimmed = sui.trim();
  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed)) return 0n;
  const [whole = "0", frac = ""] = trimmed.split(".");
  const paddedFrac = frac.padEnd(9, "0").slice(0, 9);
  return BigInt(whole) * 1_000_000_000n + BigInt(paddedFrac);
}

/** Format mist to SUI string */
export function mistToSui(mist: string | number | bigint): string {
  const n = typeof mist === "bigint" ? mist : BigInt(Number(mist));
  const whole = n / 1_000_000_000n;
  const frac = n % 1_000_000_000n;
  if (frac === 0n) return `${whole}`;
  return `${whole}.${frac.toString().padStart(9, "0").replace(/0+$/, "")}`;
}
