const GITHUB_URL = "https://github.com/tejas0111/Formrus";

export default function SiteFooter({
  compact = false,
  showLinks = true,
  brandHref = "/",
}: {
  compact?: boolean;
  showLinks?: boolean;
  brandHref?: string;
}) {
  return (
    <footer
      className={compact ? "mt-6 pt-3 border-t-[2px] border-retro-border" : "mt-10 pt-4 border-t-[2px] border-retro-border"}
      style={{ borderColor: "var(--border-light)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <a href={brandHref}>
            <img src="/brand/formrus-wordmark.svg" alt="FORMRUS" className={compact ? "h-5 w-auto" : "h-6 w-auto"} />
          </a>
          <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
            On-chain forms on Sui
          </span>
        </div>
        {showLinks ? (
          <div className="flex items-center gap-3 font-mono text-[10px]">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-neon-lime transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              GitHub
            </a>
            <a
              href="/dashboard"
              className="underline hover:text-neon-lime transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              Dashboard
            </a>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
