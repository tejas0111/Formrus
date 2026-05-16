import { createContext, useContext, type ReactNode } from "react";
import type { Transaction } from "@mysten/sui/transactions";

export interface WidgetWalletAccount {
  address: string;
  label?: string;
}

export interface WidgetWalletAdapter {
  account?: WidgetWalletAccount | null;
  connect?: () => void | Promise<void>;
  disconnect?: () => void | Promise<void>;
  signAndExecuteTransaction?: (args: { transaction: Transaction; chain: `${string}:${string}` }) => Promise<{ digest: string }>;
}

const WidgetWalletContext = createContext<WidgetWalletAdapter | null>(null);

export function WidgetWalletProvider({
  wallet,
  children,
}: {
  wallet?: WidgetWalletAdapter;
  children: ReactNode;
}) {
  return <WidgetWalletContext.Provider value={wallet ?? null}>{children}</WidgetWalletContext.Provider>;
}

export function useWidgetWallet() {
  return useContext(WidgetWalletContext);
}
