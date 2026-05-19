import React from "react";
import { createRoot, type Root } from "react-dom/client";
import widgetStyles from "./styles.css?inline";
import dappKitStyles from "@mysten/dapp-kit/dist/index.css?inline";
import { Providers } from "./Providers";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WidgetWalletProvider, type WidgetWalletAdapter } from "./components/WidgetWalletContext";
import { EmbedPage } from "./pages/EmbedPage";

type WidgetTheme = "light" | "dark" | "system";

interface MountOptions {
  target: string | HTMLElement;
  formId: string;
  theme?: WidgetTheme;
  wallet?: WidgetWalletAdapter;
}

declare global {
  interface Window {
    FormrusEmbed?: {
      mount: (options: MountOptions) => void;
      unmount: (target: string | HTMLElement) => void;
    };
  }
}

const mountedRoots = new WeakMap<HTMLElement, Root>();
const DAPP_KIT_STYLE_ID = "formrus-dapp-kit-styles";
const DAPP_KIT_THEME_STYLE_ID = "formrus-dapp-kit-theme";

const widgetBaseCss = `
:host {
  all: initial;
  display: block;
}

.formrus-widget-root,
.formrus-widget-root * {
  box-sizing: border-box;
}

.formrus-widget-root {
  --bg: #E8E8E8;
  --bg-secondary: #FFFFFF;
  --bg-card: #FFFFFF;
  --nav-bg: #E8E8E8;
  --code-bg: #F0F0F0;
  --text: #111111;
  --text-secondary: #555555;
  --text-muted: #888888;
  --border-color: #111111;
  --border-light: #CCCCCC;
  --shadow-color: #111111;
  --text-shadow-color: #B8B8B8;
  --neon-lime: #39FF14;
  --neon-cyan: #00FFFF;
  --neon-magenta: #FF00FF;
  --neon-yellow: #FFFF00;
  --neon-pink: #FF69B4;
  color: var(--text);
  font-family: 'Space Mono', monospace;
  background: var(--bg);
  min-height: 100%;
  height: 100%;
}

.formrus-widget-root.dark {
  --bg: #111111;
  --bg-secondary: #1A1A1A;
  --bg-card: #1A1A1A;
  --nav-bg: #111111;
  --code-bg: #222222;
  --text: #FFFFFF;
  --text-secondary: #AAAAAA;
  --text-muted: #666666;
  --border-color: #FFFFFF;
  --border-light: #333333;
  --shadow-color: #3A3A3A;
  --text-shadow-color: #3A3A3A;
}
`;

function resolveTheme(theme: WidgetTheme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function getDappKitThemeCss(theme: "light" | "dark") {
  if (theme === "dark") {
    return `
:root {
  --dapp-kit-fontSizes-small: 14px;
  --dapp-kit-fontSizes-medium: 16px;
  --dapp-kit-fontSizes-large: 18px;
  --dapp-kit-fontSizes-xlarge: 20px;
  --dapp-kit-fontWeights-normal: 400;
  --dapp-kit-fontWeights-medium: 500;
  --dapp-kit-fontWeights-bold: 700;
  --dapp-kit-typography-fontFamily: Inter, system-ui, sans-serif;
  --dapp-kit-typography-fontStyle: normal;
  --dapp-kit-typography-lineHeight: 1.5;
  --dapp-kit-typography-letterSpacing: 0;
  --dapp-kit-radii-small: 8px;
  --dapp-kit-radii-medium: 12px;
  --dapp-kit-radii-large: 16px;
  --dapp-kit-radii-xlarge: 20px;
  --dapp-kit-colors-body: #f5f5f5;
  --dapp-kit-colors-bodyMuted: #a3a3a3;
  --dapp-kit-colors-bodyDanger: #ff8abf;
  --dapp-kit-colors-iconButton: #f5f5f5;
  --dapp-kit-colors-primaryButton: #111111;
  --dapp-kit-colors-outlineButton: #f5f5f5;
  --dapp-kit-backgroundColors-iconButton: rgba(255,255,255,0.08);
  --dapp-kit-backgroundColors-iconButtonHover: rgba(255,255,255,0.14);
  --dapp-kit-backgroundColors-modalOverlay: rgba(0,0,0,0.58);
  --dapp-kit-backgroundColors-modalPrimary: #171717;
  --dapp-kit-backgroundColors-modalSecondary: #222222;
  --dapp-kit-backgroundColors-primaryButton: #39FF14;
  --dapp-kit-backgroundColors-primaryButtonHover: #5dff3c;
  --dapp-kit-backgroundColors-outlineButtonHover: rgba(255,255,255,0.08);
  --dapp-kit-backgroundColors-walletItemHover: rgba(255,255,255,0.08);
  --dapp-kit-backgroundColors-walletItemSelected: rgba(57,255,20,0.14);
  --dapp-kit-backgroundColors-dropdownMenu: #171717;
  --dapp-kit-backgroundColors-dropdownMenuSeparator: #333333;
  --dapp-kit-borderColors-outlineButton: #4a4a4a;
  --dapp-kit-shadows-primaryButton: none;
  --dapp-kit-blurs-modalOverlay: blur(6px);
}
`;
  }

  return `
:root {
  --dapp-kit-fontSizes-small: 14px;
  --dapp-kit-fontSizes-medium: 16px;
  --dapp-kit-fontSizes-large: 18px;
  --dapp-kit-fontSizes-xlarge: 20px;
  --dapp-kit-fontWeights-normal: 400;
  --dapp-kit-fontWeights-medium: 500;
  --dapp-kit-fontWeights-bold: 700;
  --dapp-kit-typography-fontFamily: Inter, system-ui, sans-serif;
  --dapp-kit-typography-fontStyle: normal;
  --dapp-kit-typography-lineHeight: 1.5;
  --dapp-kit-typography-letterSpacing: 0;
  --dapp-kit-radii-small: 8px;
  --dapp-kit-radii-medium: 12px;
  --dapp-kit-radii-large: 16px;
  --dapp-kit-radii-xlarge: 20px;
  --dapp-kit-colors-body: #111111;
  --dapp-kit-colors-bodyMuted: #666666;
  --dapp-kit-colors-bodyDanger: #d61f69;
  --dapp-kit-colors-iconButton: #111111;
  --dapp-kit-colors-primaryButton: #111111;
  --dapp-kit-colors-outlineButton: #111111;
  --dapp-kit-backgroundColors-iconButton: rgba(0,0,0,0.06);
  --dapp-kit-backgroundColors-iconButtonHover: rgba(0,0,0,0.1);
  --dapp-kit-backgroundColors-modalOverlay: rgba(17,17,17,0.42);
  --dapp-kit-backgroundColors-modalPrimary: #ffffff;
  --dapp-kit-backgroundColors-modalSecondary: #f3f3f3;
  --dapp-kit-backgroundColors-primaryButton: #39FF14;
  --dapp-kit-backgroundColors-primaryButtonHover: #5dff3c;
  --dapp-kit-backgroundColors-outlineButtonHover: rgba(0,0,0,0.05);
  --dapp-kit-backgroundColors-walletItemHover: rgba(0,0,0,0.05);
  --dapp-kit-backgroundColors-walletItemSelected: rgba(57,255,20,0.12);
  --dapp-kit-backgroundColors-dropdownMenu: #ffffff;
  --dapp-kit-backgroundColors-dropdownMenuSeparator: #d4d4d4;
  --dapp-kit-borderColors-outlineButton: #111111;
  --dapp-kit-shadows-primaryButton: none;
  --dapp-kit-blurs-modalOverlay: blur(6px);
}
`;
}

function resolveTarget(target: string | HTMLElement): HTMLElement | null {
  if (typeof target === "string") return document.querySelector<HTMLElement>(target);
  return target;
}

function createMountNode(host: HTMLElement, theme: "light" | "dark") {
  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = "";

  const styleEl = document.createElement("style");
  styleEl.textContent = `${widgetBaseCss}\n${widgetStyles}`;
  shadowRoot.appendChild(styleEl);

  const mountEl = document.createElement("div");
  mountEl.className = `formrus-widget-root ${theme}`;
  shadowRoot.appendChild(mountEl);
  return mountEl;
}

function ensureGlobalWalletStyles(theme: "light" | "dark") {
  let baseStyleEl = document.getElementById(DAPP_KIT_STYLE_ID) as HTMLStyleElement | null;
  if (!baseStyleEl) {
    baseStyleEl = document.createElement("style");
    baseStyleEl.id = DAPP_KIT_STYLE_ID;
    baseStyleEl.textContent = dappKitStyles;
    document.head.appendChild(baseStyleEl);
  }

  let themeStyleEl = document.getElementById(DAPP_KIT_THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!themeStyleEl) {
    themeStyleEl = document.createElement("style");
    themeStyleEl.id = DAPP_KIT_THEME_STYLE_ID;
    document.head.appendChild(themeStyleEl);
  }
  themeStyleEl.textContent = getDappKitThemeCss(theme);
}

function mount(options: MountOptions) {
  const host = resolveTarget(options.target);
  if (!host) throw new Error("Formrus embed target was not found.");
  if (!options.formId?.trim()) throw new Error("Formrus embed requires a formId.");

  const existingRoot = mountedRoots.get(host);
  if (existingRoot) existingRoot.unmount();

  const resolvedTheme = resolveTheme(options.theme ?? "system");
  ensureGlobalWalletStyles(resolvedTheme);
  const mountNode = createMountNode(host, resolvedTheme);
  const root = createRoot(mountNode);
  mountedRoots.set(host, root);

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <Providers>
          <WidgetWalletProvider wallet={options.wallet}>
            <EmbedPage formObjectId={options.formId.trim()} showThemeToggle={false} />
          </WidgetWalletProvider>
        </Providers>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

function unmount(target: string | HTMLElement) {
  const host = resolveTarget(target);
  if (!host) return;
  const existingRoot = mountedRoots.get(host);
  if (!existingRoot) return;
  existingRoot.unmount();
  mountedRoots.delete(host);
  if (host.shadowRoot) host.shadowRoot.innerHTML = "";
}

window.FormrusEmbed = { mount, unmount };

function autoMount() {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-form-id]"));

  // Also check document.currentScript for legacy support if available
  const currentScript = document.currentScript as HTMLScriptElement | null;
  if (currentScript && !scripts.includes(currentScript)) {
    scripts.push(currentScript);
  }

  for (const script of scripts) {
    if (script.dataset.formrusMounted) continue;
    script.dataset.formrusMounted = "true";

    const formId = script.dataset.formId;
    if (!formId) continue;

    const target = script.dataset.target || script.previousElementSibling;
    const theme =
      script.dataset.theme === "dark"
        ? "dark"
        : script.dataset.theme === "light"
          ? "light"
          : "system";

    if (typeof target === "string" || target instanceof HTMLElement) {
      try {
        mount({
          target,
          formId,
          theme,
        });
      } catch (err) {
        console.error("Formrus: Failed to auto-mount widget", err);
      }
    }
  }
}

// Run auto-mount
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoMount);
} else {
  autoMount();
}
