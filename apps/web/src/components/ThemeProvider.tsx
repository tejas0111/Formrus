import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'system'
    }
    return 'system'
  })

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const root = window.document.documentElement
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')

    const resolveTheme = () => {
      if (theme === 'system') {
        return systemTheme.matches ? 'dark' : 'light'
      }
      return theme
    }

    const current = resolveTheme()
    setResolvedTheme(current)

    root.classList.remove('light', 'dark')
    root.classList.add(current)

    localStorage.setItem('theme', theme)

    const handleChange = () => {
      if (theme === 'system') {
        const newTheme = systemTheme.matches ? 'dark' : 'light'
        setResolvedTheme(newTheme)
        root.classList.remove('light', 'dark')
        root.classList.add(newTheme)
      }
    }

    systemTheme.addEventListener('change', handleChange)
    return () => systemTheme.removeEventListener('change', handleChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
