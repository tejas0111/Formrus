import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { FormDraft, ResponseEnvelope } from "../types/form";
import { walrusPublisherUrl, WALRUS_EPOCHS } from "./config";
import { bytesToHex } from "./crypto";
import { sealEncryptResponse } from "./seal";

export interface DeployBlobResult {
  schemaBlobId: string;
}

interface WalrusUploadResponse {
  newlyCreated?: {
    blobObject?: { blobId?: string };
  };
  alreadyCertified?: {
    blobId?: string;
  };
}

export interface UploadPolicy {
  maxSizeBytes?: number;
  acceptedMimeTypes?: string[];
}

function getUploadUrl(epochsOverride?: number): string {
  const baseUrl = walrusPublisherUrl;
  if (!baseUrl) {
    throw new Error("Missing VITE_WALRUS_PUBLISHER_URL. Mainnet deployments need an authenticated Walrus publisher.");
  }

  const epochs = epochsOverride ?? WALRUS_EPOCHS;
  if (!Number.isFinite(epochs) || epochs < 1 || !Number.isInteger(epochs)) {
    throw new Error("Walrus epochs must be a positive integer.");
  }
  return `${baseUrl}/v1/blobs?epochs=${epochs}`;
}

export async function uploadJson(payload: unknown, options?: { epochs?: number }): Promise<string> {
  const url = getUploadUrl(options?.epochs);
    
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Walrus upload failed with ${response.status}`);
  }

  const parsed = (await response.json()) as WalrusUploadResponse;
  const blobId = parsed.newlyCreated?.blobObject?.blobId ?? parsed.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error("Walrus upload succeeded but blobId was missing in response.");
  }

  return blobId;
}

async function uploadBlob(body: BodyInit, contentType: string): Promise<string> {
  const url = getUploadUrl();
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Walrus upload failed with ${response.status}`);
  }

  const parsed = (await response.json()) as WalrusUploadResponse;
  const blobId = parsed.newlyCreated?.blobObject?.blobId ?? parsed.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error("Walrus upload succeeded but blobId was missing in response.");
  }

  return blobId;
}

export async function uploadFormToWalrus(draft: FormDraft): Promise<DeployBlobResult> {
  const schemaBlobId = await uploadJson({
    ...draft,
    createdAt: new Date().toISOString()
  });

  return { schemaBlobId };
}

export async function uploadFileToWalrus(file: File): Promise<string> {
  return uploadFileToWalrusWithPolicy(file);
}

export async function uploadFileToWalrusWithPolicy(file: File, policy?: UploadPolicy): Promise<string> {
  if ((policy?.maxSizeBytes ?? 0) > 0 && file.size > (policy?.maxSizeBytes ?? 0)) {
    throw new Error(`File "${file.name}" exceeds max size of ${policy?.maxSizeBytes} bytes.`);
  }
  if ((policy?.acceptedMimeTypes?.length ?? 0) > 0) {
    const normalized = new Set((policy?.acceptedMimeTypes ?? []).map((value) => value.toLowerCase()));
    const fileType = (file.type || "").toLowerCase();
    if (!normalized.has(fileType)) {
      throw new Error(`File "${file.name}" type "${file.type || "unknown"}" is not allowed.`);
    }
  }
  return uploadBlob(file, file.type || "application/octet-stream");
}
export async function prepareEncryptedResponse(params: {
  envelope: ResponseEnvelope;
  suiClient: SuiJsonRpcClient;
}): Promise<unknown> {
  const payload = new TextEncoder().encode(JSON.stringify(params.envelope));
  const encryptedBytes = await sealEncryptResponse({
    suiClient: params.suiClient,
    identityId: params.envelope.dna,
    payloadBytes: payload
  });

  return {
    kind: "formrus_response_v1",
    privacy: "private",
    dna: params.envelope.dna,
    submitter: params.envelope.submitter,
    createdAtMs: params.envelope.createdAtMs,
    ciphertext: bytesToHex(encryptedBytes),
    encoding: "hex"
  };
}

export function preparePublicResponse(envelope: ResponseEnvelope): unknown {
  return {
    kind: "formrus_response_v1",
    privacy: "public",
    dna: envelope.dna,
    submitter: envelope.submitter,
    createdAtMs: envelope.createdAtMs,
    response: envelope.response
  };
}
