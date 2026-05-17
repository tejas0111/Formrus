import { Transaction } from "@mysten/sui/transactions";
import { formrusPackageId, formrusRegistryId, suiClockId } from "./config";
import { hexToBytesArray } from "./crypto";
import type { EligibilityProof } from "./eligibility";
import type { SubmissionEligibility } from "../types/form";

function requirePackageAndRegistry(): { packageId: string; registryId: string } {
  if (!formrusPackageId) {
    throw new Error("Missing VITE_FORMRUS_PACKAGE_ID");
  }

  if (!formrusRegistryId) {
    throw new Error("Missing VITE_FORMRUS_REGISTRY_ID");
  }

  return { packageId: formrusPackageId, registryId: formrusRegistryId };
}

export function buildRegisterFormTx(input: {
  dna: string;
  schemaBlobId: string;
  actionType: 0 | 1 | 2;
  rewardAmountMist: bigint;
  eligibility: SubmissionEligibility;
  admins?: string[];
  viewers?: string[];
  expiresAtMs?: bigint;
  initialPoolMist: bigint;
  maxPerAddress?: number;
  maxTotal?: number;
}) {
  const { packageId, registryId } = requirePackageAndRegistry();
  const tx = new Transaction();
  const eligibility = toOnchainEligibility(input.eligibility);

  const [poolCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(input.initialPoolMist.toString())]);

  // Register the form — limits are now set at creation time
  tx.moveCall({
    target: `${packageId}::registry::register_form`,
    arguments: [
      tx.object(registryId),
      tx.pure.vector("u8", hexToBytesArray(input.dna)),
      tx.pure.string(input.schemaBlobId),
      tx.pure.u8(input.actionType),
      tx.pure.u64(input.rewardAmountMist.toString()),
      tx.pure.u8(eligibility.kind),
      tx.pure.u64(eligibility.amount.toString()),
      tx.pure.string(eligibility.type),
      tx.pure.vector("address", input.admins ?? []),
      tx.pure.vector("address", input.viewers ?? []),
      tx.pure.u64((input.expiresAtMs ?? 0n).toString()),
      tx.object(suiClockId),
      poolCoin,
      tx.pure.u64((input.maxPerAddress ?? 0).toString()),
      tx.pure.u64((input.maxTotal ?? 0).toString()),
    ]
  });

  return tx;
}

export function buildSubmitAndActTx(input: {
  formObjectId: string;
  submitter: string;
  responseBlobId: string;
  eligibilityProof?: EligibilityProof;
  /** Custom handler target, e.g. "0xabc::my_handler::submit_and_mint". Falls back to built-in. */
  customHandlerTarget?: string;
  /** Type arguments for generic custom handlers */
  typeArguments?: string[];
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();
  const proof = input.eligibilityProof ?? { kind: "anyone" as const };

  // If a custom handler is specified, use it instead of the built-in handlers
  if (input.customHandlerTarget) {
    const args: any[] = [
      tx.object(input.formObjectId),
      tx.pure.string(input.responseBlobId),
      tx.object(suiClockId)
    ];

    // Add eligibility proof argument if needed
    // Note: For custom handlers, the proof coin lifecycle is managed by the handler itself.
    // We pass the coin reference but do NOT auto-transfer it back — the handler decides.
    if (proof.kind === "sui") {
      args.splice(1, 0, tx.object(proof.coinObjectId));
      tx.moveCall({
        target: input.customHandlerTarget,
        typeArguments: input.typeArguments ?? [],
        arguments: args
      });
      // Do NOT transferObjects here — the handler consumes or returns the coin
    } else if (proof.kind === "coin") {
      args.splice(1, 0, tx.object(proof.coinObjectId));
      tx.moveCall({
        target: input.customHandlerTarget,
        typeArguments: input.typeArguments ?? [],
        arguments: args
      });
    } else if (proof.kind === "object") {
      args.splice(1, 0, tx.object(proof.objectId));
      tx.moveCall({
        target: input.customHandlerTarget,
        typeArguments: input.typeArguments ?? [],
        arguments: args
      });
    } else {
      tx.moveCall({
        target: input.customHandlerTarget,
        typeArguments: input.typeArguments ?? [],
        arguments: args
      });
    }

    return tx;
  }

  // Built-in handlers (existing behavior)
  if (proof.kind === "sui") {
    tx.moveCall({
      target: `${packageId}::registry::submit_and_act_with_sui`,
      arguments: [
        tx.object(input.formObjectId),
        tx.object(proof.coinObjectId),
        tx.pure.string(input.responseBlobId),
        tx.object(suiClockId)
      ]
    });

    return tx;
  }

  if (proof.kind === "coin") {
    tx.moveCall({
      target: `${packageId}::registry::submit_and_act_with_coin`,
      typeArguments: [proof.coinType],
      arguments: [
        tx.object(input.formObjectId),
        tx.object(proof.coinObjectId),
        tx.pure.string(input.responseBlobId),
        tx.object(suiClockId)
      ]
    });

    return tx;
  }

  if (proof.kind === "object") {
    tx.moveCall({
      target: `${packageId}::registry::submit_and_act_with_object`,
      typeArguments: [proof.objectType],
      arguments: [
        tx.object(input.formObjectId),
        tx.object(proof.objectId),
        tx.pure.string(input.responseBlobId),
        tx.object(suiClockId)
      ]
    });

    return tx;
  }

  tx.moveCall({
    target: `${packageId}::registry::submit_and_act`,
    arguments: [
      tx.object(input.formObjectId),
      tx.pure.string(input.responseBlobId),
      tx.object(suiClockId)
    ]
  });

  return tx;
}

export function buildSealApprovalTx(input: {
  formObjectId: string;
  dna: string;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  // Function name MUST be seal_approve — the Seal SDK parses tx bytes
  // looking for this exact name to extract the identity ID for key derivation.
  tx.moveCall({
    target: `${packageId}::registry::seal_approve`,
    arguments: [
      tx.pure.vector("u8", hexToBytesArray(input.dna)),
      tx.object(input.formObjectId)
    ]
  });

  return tx;
}

function toOnchainEligibility(eligibility: SubmissionEligibility): { kind: 0 | 1 | 2 | 3; amount: bigint; type: string } {
  if (eligibility.requiredObjectType?.trim()) {
    return { kind: 3, amount: 0n, type: eligibility.requiredObjectType.trim() };
  }

  if (eligibility.coinType?.trim() && eligibility.minCoinBalance?.trim()) {
    return { kind: 2, amount: BigInt(eligibility.minCoinBalance.trim()), type: eligibility.coinType.trim() };
  }

  if (eligibility.minSuiMist?.trim()) {
    return { kind: 1, amount: BigInt(eligibility.minSuiMist.trim()), type: "" };
  }

  return { kind: 0, amount: 0n, type: "" };
}

// ── Admin transaction builders ─────────────────────────────────

export function buildSetAdminTx(input: {
  formObjectId: string;
  wallet: string;
  enabled: boolean;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::registry::set_admin`,
    arguments: [
      tx.object(input.formObjectId),
      tx.pure.address(input.wallet),
      tx.pure.bool(input.enabled)
    ]
  });

  return tx;
}

export function buildSetViewerTx(input: {
  formObjectId: string;
  wallet: string;
  enabled: boolean;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::registry::set_viewer`,
    arguments: [
      tx.object(input.formObjectId),
      tx.pure.address(input.wallet),
      tx.pure.bool(input.enabled)
    ]
  });

  return tx;
}

export function buildTopUpPoolTx(input: {
  formObjectId: string;
  amountMist: bigint;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  const [poolCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(input.amountMist.toString())]);

  tx.moveCall({
    target: `${packageId}::registry::top_up_pool`,
    arguments: [
      tx.object(input.formObjectId),
      poolCoin
    ]
  });

  return tx;
}

export function buildSetFormActiveTx(input: {
  formObjectId: string;
  active: boolean;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::registry::set_form_active`,
    arguments: [
      tx.object(input.formObjectId),
      tx.pure.bool(input.active)
    ]
  });

  return tx;
}

export function buildUpdateSchemaBlobIdTx(input: {
  formObjectId: string;
  newSchemaBlobId: string;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::registry::update_schema_blob_id`,
    arguments: [
      tx.object(input.formObjectId),
      tx.pure.string(input.newSchemaBlobId)
    ]
  });

  return tx;
}

export function buildUpdateRewardAmountTx(input: {
  formObjectId: string;
  newRewardAmountMist: bigint;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::registry::update_reward_amount`,
    arguments: [
      tx.object(input.formObjectId),
      tx.pure.u64(input.newRewardAmountMist.toString())
    ]
  });

  return tx;
}

export function buildDrainAndDeactivateTx(input: {
  formObjectId: string;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::registry::drain_and_deactivate`,
    arguments: [
      tx.object(input.formObjectId)
    ]
  });

  return tx;
}

export function buildSetMaxSubmissionsTx(input: {
  formObjectId: string;
  maxPerAddress: number;
  maxTotal: number;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::registry::set_max_submissions`,
    arguments: [
      tx.object(input.formObjectId),
      tx.pure.u64(input.maxPerAddress.toString()),
      tx.pure.u64(input.maxTotal.toString())
    ]
  });

  return tx;
}

export function buildExtendExpiryTx(input: {
  formObjectId: string;
  newExpiresAtMs: bigint;
}) {
  const { packageId } = requirePackageAndRegistry();
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::registry::extend_expiry`,
    arguments: [
      tx.object(input.formObjectId),
      tx.pure.u64(input.newExpiresAtMs.toString()),
      tx.object(suiClockId)
    ]
  });

  return tx;
}
