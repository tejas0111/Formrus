import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { FormDraft, SubmissionEligibility } from "../types/form";

export interface EligibilityCheckInput {
  suiClient: SuiJsonRpcClient;
  submitter: string;
  form: Pick<FormDraft, "eligibility">;
}

export interface EligibilityCheckResult {
  eligible: boolean;
  messages: string[];
  proof?: EligibilityProof;
}

export type EligibilityProof =
  | { kind: "anyone" }
  | { kind: "sui"; minSuiMist: string }
  | { kind: "coin"; coinType: string; coinObjectId: string }
  | { kind: "object"; objectType: string; objectId: string };

function parseRequiredAmount(value: string | undefined): bigint {
  if (!value?.trim()) return 0n;
  try {
    return BigInt(value.trim());
  } catch {
    return 0n;
  }
}

function hasEnabledChecks(eligibility: SubmissionEligibility | undefined): boolean {
  if (!eligibility) return false;
  return Boolean(
    parseRequiredAmount(eligibility.minSuiMist) > 0n ||
      (eligibility.coinType?.trim() && parseRequiredAmount(eligibility.minCoinBalance) > 0n) ||
      eligibility.requiredObjectType?.trim()
  );
}

export async function checkSubmissionEligibility(input: EligibilityCheckInput): Promise<EligibilityCheckResult> {
  const eligibility = input.form.eligibility;
  if (!hasEnabledChecks(eligibility)) {
    return { eligible: true, messages: ["Anyone can submit this form."], proof: { kind: "anyone" } };
  }

  const messages: string[] = [];
  let proof: EligibilityProof | undefined;

  const coinType = eligibility?.coinType?.trim();
  const minCoinBalance = parseRequiredAmount(eligibility?.minCoinBalance);
  const requiredObjectType = eligibility?.requiredObjectType?.trim();
  const minSuiMist = parseRequiredAmount(eligibility?.minSuiMist);

  if (requiredObjectType) {
    const objects = await input.suiClient.getOwnedObjects({
      owner: input.submitter,
      filter: { StructType: requiredObjectType },
      limit: 1
    });

    if (objects.data.length === 0) {
      messages.push(`Needs an owned object/NFT of type ${requiredObjectType}.`);
    } else {
      proof = { kind: "object", objectType: requiredObjectType, objectId: objects.data[0].data?.objectId ?? "" };
    }
  } else if (coinType && minCoinBalance > 0n) {
    const balance = await input.suiClient.getBalance({ owner: input.submitter, coinType });
    const totalBalance = BigInt(balance.totalBalance);
    if (totalBalance < minCoinBalance) {
      messages.push(`Needs at least ${minCoinBalance.toString()} of ${coinType}.`);
    } else {
      const coins = await input.suiClient.getCoins({ owner: input.submitter, coinType, limit: 50 });
      const coin = coins.data.find((item) => BigInt(item.balance) >= minCoinBalance);
      if (!coin) {
        messages.push(`Needs one ${coinType} coin object with at least ${minCoinBalance.toString()}.`);
      } else {
        proof = { kind: "coin", coinType, coinObjectId: coin.coinObjectId };
      }
    }
  } else if (minSuiMist > 0n) {
    const balance = await input.suiClient.getBalance({ owner: input.submitter });
    const totalBalance = BigInt(balance.totalBalance);
    if (totalBalance < minSuiMist) {
      messages.push(`Needs at least ${minSuiMist.toString()} mist.`);
    } else {
      proof = { kind: "sui", minSuiMist: minSuiMist.toString() };
    }
  }

  if (messages.length > 0) {
    return { eligible: false, messages };
  }

  return { eligible: true, messages: ["Eligibility checks passed."], proof: proof ?? { kind: "anyone" } };
}
