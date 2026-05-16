import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Wallet } from "lucide-react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import FormrusConnectButton from "../components/FormrusConnectButton";
import ThemeToggle from "../components/ThemeToggle";
import SiteFooter from "../components/SiteFooter";
import { suiNetwork } from "../lib/config";
import type { WidgetWalletAdapter } from "../components/WidgetWalletContext";

declare global {
  interface Window {
    FormrusEmbed?: {
      mount: (options: {
        target: string | HTMLElement;
        formId: string;
        theme?: "light" | "dark" | "system";
        wallet?: WidgetWalletAdapter;
      }) => void;
      unmount: (target: string | HTMLElement) => void;
    };
  }
}

const LAST_FORM_ID_CACHE_KEY = "formrus_host_embed_last_form_id";

export function HostEmbedTestPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [formId, setFormId] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");

  useEffect(() => {
    try {
      const cached = localStorage.getItem(LAST_FORM_ID_CACHE_KEY);
      if (cached?.trim()) setFormId(cached.trim());
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    try {
      const trimmed = formId.trim();
      if (trimmed) localStorage.setItem(LAST_FORM_ID_CACHE_KEY, trimmed);
    } catch {
      // Ignore storage failures.
    }
  }, [formId]);

  const walletAdapter = useMemo<WidgetWalletAdapter | undefined>(() => {
    if (!account?.address) return undefined;
    return {
      account: {
        address: account.address,
        label: account.label,
      },
      signAndExecuteTransaction: ({ transaction, chain }) =>
        signAndExecuteTransaction({ transaction, chain }),
    };
  }, [account?.address, account?.label, signAndExecuteTransaction]);

  useEffect(() => {
    let cancelled = false;

    async function mountWidget() {
      await import("../widget");
      if (cancelled || !mountRef.current || !window.FormrusEmbed || !formId.trim()) return;
      window.FormrusEmbed.mount({
        target: mountRef.current,
        formId: formId.trim(),
        theme,
        wallet: walletAdapter,
      });
    }

    void mountWidget();
    return () => {
      cancelled = true;
      if (mountRef.current && window.FormrusEmbed) {
        window.FormrusEmbed.unmount(mountRef.current);
      }
    };
  }, [formId, theme, walletAdapter]);

  return (
    <div className="min-h-screen dot-grid" style={{ backgroundColor: "var(--bg)" }}>
      <header
        className="h-16 flex items-center justify-between px-4 md:px-6 lg:px-10 sticky top-0 z-50"
        style={{ background: "var(--nav-bg)", borderBottom: "3px solid var(--border-color)", boxShadow: "0 3px 0 var(--shadow-color)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="w-8 h-8 flex items-center justify-center border-[3px] border-retro-border transition-colors hover:border-neon-lime"
            style={{ boxShadow: "2px 2px 0px var(--shadow-color)" }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </Link>
          <div>
            <div className="font-mono text-sm font-bold uppercase" style={{ color: "var(--text)" }}>
              Host Wallet Embed Test
            </div>
            <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              Connect here, then submit through the embedded widget.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <FormrusConnectButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 lg:px-10 py-8">
        <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-6 items-start">
          <section
            className="border-[3px] border-retro-border p-4 md:p-5"
            style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "var(--text-muted)" }}>
              Host State
            </div>
            <div className="space-y-4">
              <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
                <div className="font-mono text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>
                  Connected Wallet
                </div>
                <div className="font-mono text-xs break-all" style={{ color: account?.address ? "var(--text)" : "#FF69B4" }}>
                  {account?.address ?? "Not connected"}
                </div>
              </div>

              <label className="block">
                <span className="font-mono text-[10px] uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
                  Form Object ID
                </span>
                <input
                  value={formId}
                  onChange={(event) => setFormId(event.target.value)}
                  className="w-full font-mono text-xs px-3 py-2.5 border-[3px] border-retro-border focus:outline-none"
                  style={{ background: "var(--bg-secondary)", color: "var(--text)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
                />
              </label>

              <label className="block">
                <span className="font-mono text-[10px] uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
                  Widget Theme
                </span>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as "light" | "dark" | "system")}
                  className="w-full font-mono text-xs px-3 py-2.5 border-[3px] border-retro-border focus:outline-none"
                  style={{ background: "var(--bg-secondary)", color: "var(--text)", boxShadow: "2px 2px 0px var(--shadow-color)" }}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </label>

              <div className="border-[2px] border-retro-border p-3" style={{ background: "var(--bg-secondary)" }}>
                <div className="flex items-start gap-2">
                  <Wallet size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--neon-lime)" }} />
                  <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    This page passes the host dapp-kit account and signer into `FormrusEmbed.mount(...)`.
                    If submit works below after connecting here, the host-wallet bridge is working.
                  </p>
                </div>
              </div>

              {formId.trim() ? (
                <a
                  href={`/view/${formId.trim()}`}
                  target="_blank"
                  rel="noopener"
                  className="retro-button text-[10px] justify-center"
                >
                  <ExternalLink size={12} />
                  Open Full Form
                </a>
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
              Embedded Widget
            </div>
            <div
              ref={mountRef}
              className="min-h-[720px] border-[3px] border-retro-border"
              style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}
            />
          </section>
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}
