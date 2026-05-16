export function LoadingSpinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="square"
        className="animate-spin"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      {label ? (
        <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
