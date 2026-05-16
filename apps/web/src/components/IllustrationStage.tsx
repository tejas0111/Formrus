type IllustrationTone = "cyan" | "pink" | "lime";

interface IllustrationStageProps {
  src: string;
  alt: string;
  label: string;
  tone?: IllustrationTone;
  imageMaxWidth?: number;
  minHeightClassName?: string;
}

const toneStyles: Record<IllustrationTone, { accent: string; soft: string }> = {
  cyan: { accent: "#00FFFF", soft: "var(--bg-secondary)" },
  pink: { accent: "#FF69B4", soft: "var(--bg-secondary)" },
  lime: { accent: "#39FF14", soft: "var(--bg-secondary)" },
};

export function IllustrationStage({
  src,
  alt,
  label,
  tone = "cyan",
  imageMaxWidth,
  minHeightClassName = "min-h-[260px]",
}: IllustrationStageProps) {
  const palette = toneStyles[tone];
  const figureStyle = {
    background: "var(--bg-card)",
    boxShadow: "6px 6px 0px var(--shadow-color)",
    ...(imageMaxWidth ? { maxWidth: `${imageMaxWidth}px` } : {}),
  };

  return (
    <figure
      className={`w-full border-[3px] border-retro-border overflow-hidden ${minHeightClassName}${imageMaxWidth ? " mx-auto" : ""}`}
      style={figureStyle}
    >
      <figcaption
        className="flex items-center justify-between gap-3 px-3 py-2 border-b-[3px] border-retro-border"
        style={{ background: "var(--bg-secondary)", color: "var(--text)" }}
      >
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase font-bold tracking-[0.14em]">
          <span className="w-2.5 h-2.5 border border-retro-border" style={{ background: palette.accent, boxShadow: "1px 1px 0px var(--shadow-color)" }} />
          {label}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border border-retro-border" style={{ background: "var(--bg-card)" }} />
          <span className="w-2.5 h-2.5 border border-retro-border" style={{ background: palette.accent }} />
          <span className="w-2.5 h-2.5 border border-retro-border" style={{ background: "var(--bg-card)" }} />
        </span>
      </figcaption>
      <div style={{ background: palette.soft }}>
        <img src={src} alt={alt} className="block w-full h-auto object-contain max-h-[260px] sm:max-h-[320px] md:max-h-[380px]" />
      </div>
    </figure>
  );
}
