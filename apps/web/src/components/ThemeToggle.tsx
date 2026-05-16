import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { setTheme, resolvedTheme } = useTheme()

  const cycleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const Icon = resolvedTheme === 'dark' ? Moon : Sun
  const label = resolvedTheme === 'dark' ? 'Dark' : 'Light'

  if (compact) {
    return (
      <button
        onClick={cycleTheme}
        className="retro-button p-2"
        title={`Theme: ${label}`}
        aria-label={`Current theme: ${label}. Click to cycle.`}
      >
        <Icon size={16} strokeWidth={2.5} />
      </button>
    )
  }

  return (
    <button
      onClick={cycleTheme}
      className="retro-button text-xs"
      aria-label={`Current theme: ${label}. Click to cycle.`}
    >
      <Icon size={14} strokeWidth={2.5} />
      <span>{label}</span>
    </button>
  )
}
