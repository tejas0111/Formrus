import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { buildSubmitAndActTx } from "./suiFormrus";
import { uploadJson, prepareEncryptedResponse, preparePublicResponse } from "./walrusAdapter";
import type { ResponseEnvelope, ResponsePrivacy } from "../types/form";
import type { EligibilityProof } from "./eligibility";
import { translateError } from "./errors";

const SUI_COIN_TYPE = "0x2::sui::SUI";
const SUI_OUTFLOW_BUFFER_MIST = 10_000_000n;

export interface SubmitAndActInput {
  formObjectId: string;
  dna: string;
  submitter: string;
  responsePrivacy: ResponsePrivacy;
  eligibilityProof?: EligibilityProof;
  response: Record<string, unknown>;
  /** Custom handler target, e.g. "0xabc::nft_handler::submit_and_mint" */
  customHandlerTarget?: string;
  /** Type arguments for generic custom handlers */
  typeArguments?: string[];
}

function isSubmitterOwner(owner: unknown, submitter: string): boolean {
  if (!owner || typeof owner !== "object") return false;
  const addressOwner = (owner as { AddressOwner?: unknown }).AddressOwner;
  return typeof addressOwner === "string" && addressOwner.toLowerCase() === submitter.toLowerCase();
}

function gasCostMist(gasUsed: {
  computationCost: string;
  storageCost: string;
  storageRebate: string;
}): bigint {
  const cost = BigInt(gasUsed.computationCost) + BigInt(gasUsed.storageCost) - BigInt(gasUsed.storageRebate);
  return cost > 0n ? cost : 0n;
}

async function assertSubmitTxHasNoUnexpectedSuiOutflow(
  tx: Transaction,
  suiClient: SuiJsonRpcClient,
  submitter: string,
  extraAllowedOutflowMist: bigint = 0n
) {
  tx.setSender(submitter);
  const bytes = await tx.build({ client: suiClient });
  const dryRun = await suiClient.dryRunTransactionBlock({ transactionBlock: bytes });

  if (dryRun.effects.status.status !== "success") {
    throw new Error(translateError(dryRun.effects.status.error ?? "Transaction simulation failed."));
  }

  const submitterSuiChange = dryRun.balanceChanges
    .filter((change) => change.coinType === SUI_COIN_TYPE && isSubmitterOwner(change.owner, submitter))
    .reduce((sum, change) => sum + BigInt(change.amount), 0n);
  const allowedOutflow = gasCostMist(dryRun.effects.gasUsed) + SUI_OUTFLOW_BUFFER_MIST + extraAllowedOutflowMist;

  if (submitterSuiChange < -allowedOutflow) {
    throw new Error(
      "This transaction would spend more SUI than expected. It may contain suspicious logic. Please contact the form creator."
    );
  }
}

export async function submitResponseAndAct(
  input: SubmitAndActInput,
  suiClient: SuiJsonRpcClient,
  signAndExecute: (args: { transaction: Transaction }) => Promise<{ digest: string }>
): Promise<{ responseBlobId: string; digest: string; receipt: ResponseEnvelope & { privacy: ResponsePrivacy } }> {
  const createdAtEpochMs = Date.now();
  const envelope: ResponseEnvelope = {
    kind: "formrus_response_v1",
    dna: input.dna,
    response: input.response,
    submitter: input.submitter,
    createdAtMs: createdAtEpochMs
  };

  // 1. Prepare payload
  const payload = input.responsePrivacy === "private"
    ? await prepareEncryptedResponse({ envelope, suiClient })
    : preparePublicResponse(envelope);

  const responseBlobId = await uploadJson(payload);
  const finalTx = buildSubmitAndActTx({
    formObjectId: input.formObjectId,
    submitter: input.submitter,
    responseBlobId,
    eligibilityProof: input.eligibilityProof,
    customHandlerTarget: input.customHandlerTarget,
    typeArguments: input.typeArguments
  });

  await assertSubmitTxHasNoUnexpectedSuiOutflow(finalTx, suiClient, input.submitter);

  const result = await signAndExecute({ transaction: finalTx });
  return { responseBlobId, digest: result.digest, receipt: { ...envelope, privacy: input.responsePrivacy } };
}
