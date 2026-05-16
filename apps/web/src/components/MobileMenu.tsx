import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

interface MobileMenuProps {
  navLinks: { label: string; to?: string; onClick?: () => void }[]
}

export default function MobileMenu({ navLinks }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const handleClick = (onClick?: () => void) => {
    setOpen(false)
    if (onClick) {
      setTimeout(onClick, 150)
    }
  }

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="retro-button p-2"
        aria-label="Toggle menu"
      >
        {open ? <X size={18} strokeWidth={2.5} /> : <Menu size={18} strokeWidth={2.5} />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Menu panel */}
      <div
        className={`fixed top-[64px] left-0 right-0 z-50 transition-all duration-200 ${
          open
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div
          className="mx-3 p-4 border-[3px] border-retro-border shadow-retro-lg"
          style={{ background: 'var(--bg)', boxShadow: '4px 4px 0px var(--shadow-color)' }}
        >
          <nav className="flex flex-col gap-2">
            {navLinks.map((link, i) => (
              <div key={i}>
                {link.to ? (
                  <Link
                    to={link.to}
                    onClick={() => handleClick()}
                    className={`retro-button w-full justify-start text-sm ${
                      location.pathname === link.to ? 'bg-neon-lime text-black' : ''
                    }`}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <button
                    onClick={() => handleClick(link.onClick)}
                    className="retro-button w-full justify-start text-sm"
                  >
                    {link.label}
                  </button>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
