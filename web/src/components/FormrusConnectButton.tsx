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
  const buttonClassName = compact
    ? "retro-button p-2"
    : "retro-button px-2.5 py-2 text-[10px] sm:px-4 sm:py-3 sm:text-xs";
  const labelClassName = compact ? "hidden" : "hidden sm:inline";

  if (account) {
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        disabled={!widgetWallet?.disconnect && isPending}
        className={`${buttonClassName} disabled:opacity-50`}
        title="Disconnect wallet"
      >
        {compact ? <LogOut size={16} strokeWidth={2.5} /> : <Wallet size={14} strokeWidth={2.5} />}
        <span className={labelClassName}>{account.label ?? formatAddress(account.address)}</span>
      </button>
    );
  }

  if (usesHostWallet) {
    return (
      <button
        type="button"
        onClick={connect ? () => void connect() : undefined}
        disabled={!connect}
        className={`${buttonClassName} disabled:opacity-50`}
        title={connect ? "Connect wallet" : "Wallet controlled by host page"}
      >
        <Wallet size={compact ? 16 : 14} strokeWidth={2.5} />
        <span className={labelClassName}>{connect ? "Connect" : "Host Wallet"}</span>
      </button>
    );
  }

  return (
    <ConnectModal
      trigger={
        <button type="button" className={buttonClassName}>
          <Wallet size={compact ? 16 : 14} strokeWidth={2.5} />
          <span className={labelClassName}>Connect</span>
        </button>
      }
    />
  );
}
