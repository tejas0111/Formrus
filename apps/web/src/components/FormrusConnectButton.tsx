import { ConnectModal, useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import { formatAddress } from "@mysten/sui/utils";
import { LogOut, Wallet } from "lucide-react";
import { useWidgetWallet } from "./WidgetWalletContext";

export default function FormrusConnectButton({ compact = false }: { compact?: boolean }) {
  const widgetWallet = useWidgetWallet();
  const dappKitAccount = useCurrentAccount();
  const { mutate: disconnectWallet, isPending } = useDisconnectWallet();
  const account = widgetWallet?.account ?? dappKitAccount;
  const disconnect = widgetWallet?.disconnect ?? (() => disconnectWallet());
  const connect = widgetWallet?.connect;
  const usesHostWallet = Boolean(widgetWallet);

  if (account) {
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        disabled={!widgetWallet?.disconnect && isPending}
        className={`retro-button ${compact ? "p-2" : "text-xs"} disabled:opacity-50`}
        title="Disconnect wallet"
      >
        {compact ? <LogOut size={16} strokeWidth={2.5} /> : <Wallet size={14} strokeWidth={2.5} />}
        {!compact ? <span>{account.label ?? formatAddress(account.address)}</span> : null}
      </button>
    );
  }

  if (usesHostWallet) {
    return (
      <button
        type="button"
        onClick={connect ? () => void connect() : undefined}
        disabled={!connect}
        className={`retro-button ${compact ? "p-2" : "text-xs"} disabled:opacity-50`}
        title={connect ? "Connect wallet" : "Wallet controlled by host page"}
      >
        <Wallet size={compact ? 16 : 14} strokeWidth={2.5} />
        {!compact ? <span>{connect ? "Connect" : "Host Wallet"}</span> : null}
      </button>
    );
  }

  return (
    <ConnectModal
      trigger={
        <button type="button" className={`retro-button ${compact ? "p-2" : "text-xs"}`}>
          <Wallet size={compact ? 16 : 14} strokeWidth={2.5} />
          {!compact ? <span>Connect</span> : null}
        </button>
      }
    />
  );
}
