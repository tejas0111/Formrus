/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Retro theme colors using CSS variables
        retro: {
          bg: 'var(--bg)',
          'bg-secondary': 'var(--bg-secondary)',
          'bg-card': 'var(--bg-card)',
          nav: 'var(--nav-bg)',
          'code-bg': 'var(--code-bg)',
          text: 'var(--text)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          border: 'var(--border-color)',
          'border-light': 'var(--border-light)',
          shadow: 'var(--shadow-color)',
        },
        // Neon accents (always bright)
        neon: {
          lime: '#39FF14',
          cyan: '#00FFFF',
          magenta: '#FF00FF',
          yellow: '#FFFF00',
          pink: '#FF69B4',
          green: '#00FF88',
        },
        // Legacy walrus colors (kept for compatibility)
        walrus: {
          blue: '#2B6BFF',
          purple: '#8B5CFF',
          aqua: '#00E5C9',
          'text-secondary': '#B8D4FF',
          dark: '#1a1a2e',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        display: ['Fredoka', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
        retro: ['Space Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '24px',
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        // Chunky retro shadows (offset, not blur)
        'retro': '4px 4px 0px var(--shadow-color)',
        'retro-lg': '6px 6px 0px var(--shadow-color)',
        'retro-xl': '8px 8px 0px var(--shadow-color)',
        'retro-hover': '8px 8px 0px var(--shadow-color)',
        'retro-active': '2px 2px 0px var(--shadow-color)',
        'retro-none': '0px 0px 0px var(--shadow-color)',
        // Legacy shadows
        'chunky': '0 14px 0 rgba(0,0,0,0.22)',
        'chunky-hover': '0 18px 0 rgba(0,0,0,0.28)',
        'chunky-sm': '0 8px 0 rgba(0,0,0,0.18)',
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "marquee": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "marquee": "marquee 20s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
