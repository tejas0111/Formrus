export const walrusPublisherUrl = (import.meta.env.VITE_WALRUS_PUBLISHER_URL as string | undefined)?.replace(/\/$/, "");
export const walrusAggregatorUrl = (import.meta.env.VITE_WALRUS_AGGREGATOR_URL as string | undefined)?.replace(/\/$/, "");

export const formrusPackageId = import.meta.env.VITE_FORMRUS_PACKAGE_ID as string | undefined;
export const formrusLegacyPackageIds = (import.meta.env.VITE_FORMRUS_LEGACY_PACKAGE_IDS as string | undefined)
  ?.split(",")
  .map((v) => v.trim())
  .filter(Boolean) ?? [];

export const formrusPackageIds = [
  ...(formrusPackageId ? [formrusPackageId] : []),
  ...formrusLegacyPackageIds,
];

export const formrusRegistryId = import.meta.env.VITE_FORMRUS_REGISTRY_ID as string | undefined;

export const suiNetwork = (import.meta.env.VITE_SUI_NETWORK as string | undefined) ?? "mainnet";

/** Sui system clock object ID — immutable, same on every network */
export const suiClockId = "0x6";

export const sealKeyServers = (import.meta.env.VITE_SEAL_KEY_SERVER_IDS as string | undefined)
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean) ?? [];

export const sealThreshold = Number(import.meta.env.VITE_SEAL_THRESHOLD ?? "2");

export const WALRUS_EPOCHS = Number(import.meta.env.VITE_WALRUS_EPOCHS ?? "5");
