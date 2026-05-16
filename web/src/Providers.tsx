import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { suiNetwork } from "./lib/config";

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
  testnet: { network: "testnet", url: getJsonRpcFullnodeUrl("testnet") },
  mainnet: { network: "mainnet", url: getJsonRpcFullnodeUrl("mainnet") }
});

export function Providers({ children }: { children: ReactNode }) {
  const network = suiNetwork === "mainnet" ? "mainnet" : "testnet";

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider defaultNetwork={network} networks={networkConfig}>
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
