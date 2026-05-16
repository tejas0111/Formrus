import { blake2b } from "@noble/hashes/blake2.js";
import { bytesToHex, hexToBytes } from "./crypto";

export type ActionType = 0 | 1;

export interface DnaInput {
  creatorAddress: string;
  schemaBlobId: string;
  actionType: ActionType;
  saltHex32: string;
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function generateSaltHex32(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

export function computeFormDna(input: DnaInput): { dnaHex: string; dnaBytes: Uint8Array } {
  const creator = hexToBytes(input.creatorAddress);
  const blob = utf8Bytes(input.schemaBlobId);
  const action = new Uint8Array([input.actionType]);
  const salt = hexToBytes(input.saltHex32);

  if (salt.length !== 32) {
    throw new Error("Salt must be exactly 32 bytes.");
  }

  const packed = concatBytes(creator, blob, action, salt);
  const dnaBytes = blake2b(packed, { dkLen: 32 });

  return {
    dnaHex: bytesToHex(dnaBytes),
    dnaBytes
  };
}
