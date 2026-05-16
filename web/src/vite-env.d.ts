/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUI_NETWORK?: string;
  readonly VITE_WALRUS_PUBLISHER_URL?: string;
  readonly VITE_WALRUS_AGGREGATOR_URL?: string;
  readonly VITE_WALRUS_EPOCHS?: string;
  readonly VITE_FORMRUS_PACKAGE_ID?: string;
  readonly VITE_FORMRUS_REGISTRY_ID?: string;
  readonly VITE_SEAL_KEY_SERVER_IDS?: string;
  readonly VITE_SEAL_THRESHOLD?: string;
  readonly VITE_SEAL_SESSION_TTL_MIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
