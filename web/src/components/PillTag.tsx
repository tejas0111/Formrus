interface PillTagProps {
  children: string
  className?: string
  color?: string
}

export default function PillTag({ children, className = '', color = '#39FF14' }: PillTagProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 border-[2px] border-retro-border font-mono text-[10px] font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--shadow-color)] bg-retro-bg-card ${className}`}
    >
      <span className="w-2 h-2 inline-block flex-shrink-0" style={{ backgroundColor: color }} />
      {children}
    </span>
  )
}
