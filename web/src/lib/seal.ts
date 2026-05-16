import { SealClient, SessionKey } from "@mysten/seal";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { formrusPackageId, sealKeyServers, sealThreshold } from "./config";
import { hexToBytes } from "./crypto";
import { buildSealApprovalTx } from "./suiFormrus";

/** Session key TTL in minutes. Configurable via VITE_SEAL_SESSION_TTL_MIN (default: 10). */
const SEAL_SESSION_TTL_MIN = Number(import.meta.env.VITE_SEAL_SESSION_TTL_MIN ?? "10");

export interface BatchDecryptItem {
  ciphertextHex: string;
  dna: string;
}

export interface BatchDecryptResult {
  index: number;
  response: Record<string, unknown> | null;
  error?: string;
}

function requireSealConfig() {
  if (!formrusPackageId) {
    throw new Error("Missing VITE_FORMRUS_PACKAGE_ID for Seal namespace.");
  }

  if (sealKeyServers.length === 0) {
    throw new Error("Missing VITE_SEAL_KEY_SERVER_IDS.");
  }

  if (!Number.isFinite(sealThreshold) || sealThreshold < 1) {
    throw new Error("VITE_SEAL_THRESHOLD must be a positive number.");
  }

  return {
    packageId: formrusPackageId,
    threshold: sealThreshold,
    serverConfigs: sealKeyServers.map((objectId) => ({ objectId, weight: 1 }))
  };
}

export async function sealEncryptResponse(params: {
  suiClient: SuiJsonRpcClient;
  identityId: string;
  payloadBytes: Uint8Array;
}): Promise<Uint8Array> {
  const config = requireSealConfig();

  const seal = new SealClient({
    suiClient: params.suiClient,
    serverConfigs: config.serverConfigs
  });

  const encrypted = await seal.encrypt({
    threshold: config.threshold,
    packageId: config.packageId,
    id: params.identityId,
    data: params.payloadBytes
  });

  return encrypted.encryptedObject;
}

function decodeDecryptedPayload(decrypted: Uint8Array): Record<string, unknown> {
  const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as unknown;
  if (!parsed || typeof parsed !== "object" || !("response" in parsed)) {
    throw new Error("Decrypted payload did not contain a response object.");
  }
  return (parsed as { response: Record<string, unknown> }).response;
}

export async function sealDecryptResponse(params: {
  suiClient: SuiJsonRpcClient;
  formObjectId: string;
  identityId: string;
  ciphertextHex: string;
  signerAddress: string;
  signPersonalMessage: (input: { message: Uint8Array }) => Promise<{ signature: string }>;
}): Promise<Record<string, unknown>> {
  const config = requireSealConfig();

  if (!params.ciphertextHex || params.ciphertextHex.length < 4) {
    throw new Error("Ciphertext is empty or too short.");
  }

  const seal = new SealClient({
    suiClient: params.suiClient,
    serverConfigs: config.serverConfigs
  });

  const sessionKey = await SessionKey.create({
    address: params.signerAddress,
    packageId: config.packageId,
    ttlMin: SEAL_SESSION_TTL_MIN,
    suiClient: params.suiClient
  });

  const { signature } = await params.signPersonalMessage({ message: sessionKey.getPersonalMessage() });
  await sessionKey.setPersonalMessageSignature(signature);

  // Build the seal_approve approval tx.
  // The function name MUST be seal_approve — the Seal SDK parses tx bytes
  // looking for this name to extract the identity ID for key derivation.
  const approvalTx = buildSealApprovalTx({
    formObjectId: params.formObjectId,
    dna: params.identityId
  });
  approvalTx.setSender(params.signerAddress);

  let txBytes: Uint8Array;
  try {
    txBytes = await approvalTx.build({
      client: params.suiClient,
      onlyTransactionKind: true
    });
  } catch (err) {
    throw new Error(
      `Failed to build approval transaction. Make sure the form object exists and you are connected as the creator or an admin. ` +
      `Detail: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let decrypted: Uint8Array;
  try {
    decrypted = await seal.decrypt({
      data: hexToBytes(params.ciphertextHex),
      sessionKey,
      txBytes
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not enough shares") || msg.includes("threshold")) {
      throw new Error(
        "Decryption failed: could not reach enough Seal key servers. The servers may be temporarily unavailable — try again in a moment."
      );
    }
    if (msg.includes("access denied") || msg.includes("seal_approve") || msg.includes("MoveAbort")) {
      throw new Error(
        `Decryption failed: Seal key servers rejected the approval transaction. ` +
        `The on-chain DNA may not match the encrypted payload. Detail: ${msg}`
      );
    }
    if (msg.includes("not found") || msg.includes("ObjectNotFound")) {
      throw new Error(
        "Decryption failed: the form object could not be found on chain. It may have been deleted."
      );
    }
    if (msg.includes("expired") || msg.includes("SessionKey")) {
      throw new Error(
        "Decryption session expired. Please try again — you'll be asked to sign a new message."
      );
    }
    throw new Error(`Decryption failed. ${msg}`);
  }

  return decodeDecryptedPayload(decrypted);
}

/**
 * Decrypt multiple private responses in batch.
 * Creates one SessionKey and signs once, then reuses for all items.
 */
export async function sealDecryptBatch(params: {
  suiClient: SuiJsonRpcClient;
  formObjectId: string;
  items: BatchDecryptItem[];
  signerAddress: string;
  signPersonalMessage: (input: { message: Uint8Array }) => Promise<{ signature: string }>;
  onProgress?: (current: number, total: number) => void;
}): Promise<BatchDecryptResult[]> {
  const config = requireSealConfig();

  const seal = new SealClient({
    suiClient: params.suiClient,
    serverConfigs: config.serverConfigs
  });

  const sessionKey = await SessionKey.create({
    address: params.signerAddress,
    packageId: config.packageId,
    ttlMin: SEAL_SESSION_TTL_MIN,
    suiClient: params.suiClient
  });

  const { signature } = await params.signPersonalMessage({ message: sessionKey.getPersonalMessage() });
  await sessionKey.setPersonalMessageSignature(signature);

  const results: BatchDecryptResult[] = [];

  for (let i = 0; i < params.items.length; i++) {
    params.onProgress?.(i + 1, params.items.length);

    const item = params.items[i]!;

    try {
      const approvalTx = buildSealApprovalTx({
        formObjectId: params.formObjectId,
        dna: item.dna
      });
      approvalTx.setSender(params.signerAddress);

      let txBytes: Uint8Array;
      try {
        txBytes = await approvalTx.build({
          client: params.suiClient,
          onlyTransactionKind: true
        });
      } catch (buildErr) {
        results.push({
          index: i,
          response: null,
          error: `Approval tx build failed: ${buildErr instanceof Error ? buildErr.message : String(buildErr)}`
        });
        continue;
      }

      const decrypted = await seal.decrypt({
        data: hexToBytes(item.ciphertextHex),
        sessionKey,
        txBytes
      });

      results.push({ index: i, response: decodeDecryptedPayload(decrypted) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Decryption failed";
      // Translate common Seal errors to user-friendly messages
      if (msg.includes("not enough shares") || msg.includes("threshold")) {
        results.push({ index: i, response: null, error: "Key server unreachable" });
      } else if (msg.includes("access denied") || msg.includes("seal_approve") || msg.includes("MoveAbort")) {
        results.push({ index: i, response: null, error: "No permission to decrypt" });
      } else {
        results.push({ index: i, response: null, error: msg });
      }
    }
  }

  return results;
}
