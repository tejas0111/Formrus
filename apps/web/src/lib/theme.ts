// ============================================================
// COLOR PALETTE CONFIG
// Edit these values to customize your theme
// ============================================================

export const palette = {
  // Neon accent colors (used in both light and dark)
  neon: {
    lime: '#39FF14',
    cyan: '#00FFFF',
    magenta: '#FF00FF',
    yellow: '#FFFF00',
    pink: '#FF69B4',
  },

  // Light mode colors
  light: {
    bg: '#E8E8E8',
    bgSecondary: '#FFFFFF',
    bgCard: '#FFFFFF',
    text: '#111111',
    textSecondary: '#555555',
    textMuted: '#888888',
    border: '#111111',
    borderLight: '#CCCCCC',
    shadow: '#111111',
    navBg: '#E8E8E8',
    codeBg: '#F0F0F0',
  },

  // Dark mode colors
  dark: {
    bg: '#111111',
    bgSecondary: '#1A1A1A',
    bgCard: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#AAAAAA',
    textMuted: '#666666',
    border: '#FFFFFF',
    borderLight: '#333333',
    shadow: '#000000',
    navBg: '#111111',
    codeBg: '#222222',
  },

  // Accent color rotations for cards/sections
  accentRotation: ['#39FF14', '#00FFFF', '#FF00FF', '#FFFF00', '#FF69B4', '#00FF88'],
} as const

// Helper to get accent by index
export const getAccent = (index: number) => {
  return palette.accentRotation[index % palette.accentRotation.length]
}

// CSS variable name mapping
export const cssVars = {
  // Backgrounds
  '--bg': '--bg',
  '--bg-secondary': '--bg-secondary',
  '--bg-card': '--bg-card',
  '--nav-bg': '--nav-bg',
  '--code-bg': '--code-bg',

  // Text
  '--text': '--text',
  '--text-secondary': '--text-secondary',
  '--text-muted': '--text-muted',

  // Borders
  '--border-color': '--border-color',
  '--border-light': '--border-light',

  // Shadow
  '--shadow-color': '--shadow-color',

  // Neon accents (always bright)
  '--neon-lime': '--neon-lime',
  '--neon-cyan': '--neon-cyan',
  '--neon-magenta': '--neon-magenta',
  '--neon-yellow': '--neon-yellow',
  '--neon-pink': '--neon-pink',
} as const
