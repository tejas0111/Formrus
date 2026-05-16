import { useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";

interface TooltipProps {
  text: string;
  children?: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ text, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const positionStyles: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowStyles: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-[var(--border-color)]",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[var(--border-color)]",
    left: "left-full top-1/2 -translate-y-1/2 border-l-[var(--border-color)]",
    right: "right-full top-1/2 -translate-y-1/2 border-r-[var(--border-color)]",
  };

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children ?? (
        <HelpCircle
          size={13}
          strokeWidth={2.5}
          className="cursor-help transition-colors"
          style={{ color: "var(--neon-cyan)" }}
        />
      )}
      {visible ? (
        <span
          className={`absolute z-[300] ${positionStyles[position]} pointer-events-none`}
          role="tooltip"
        >
          <span
            className="block font-mono text-[10px] leading-relaxed whitespace-normal max-w-[16rem] px-3 py-2 border-[2px] border-retro-border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              boxShadow: "3px 3px 0px var(--shadow-color)",
            }}
          >
            {text}
          </span>
          <span
            className={`absolute w-0 h-0 border-[5px] border-transparent ${arrowStyles[position]}`}
          />
        </span>
      ) : null}
    </span>
  );
}

/** Inline help: label + ? icon with tooltip */
export function HelpLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <Tooltip text={tip} />
    </span>
  );
}
