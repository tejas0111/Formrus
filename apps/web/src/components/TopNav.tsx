import { Link, useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import MobileMenu from './MobileMenu'
import FormrusConnectButton from './FormrusConnectButton'

const GITHUB_URL = 'https://github.com/tejas0111/Formrus'

type NavLink = {
  label: string
  to?: string
  onClick?: () => void
}

export default function TopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const isLanding = location.pathname === '/'

  const scrollToSection = (id: string) => {
    if (!isLanding) {
      navigate('/')
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const landingLinks: NavLink[] = [
    { label: 'Features', onClick: () => scrollToSection('features') },
    { label: 'Widgets', onClick: () => scrollToSection('widgets') },
    { label: 'Testimonials', onClick: () => scrollToSection('testimonials') },
  ]

  const builderLinks: NavLink[] = []

  const dashboardLinks: NavLink[] = []

  const getNavLinks = () => {
    if (location.pathname.startsWith('/builder')) return builderLinks
    if (location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/')) return dashboardLinks
    return landingLinks
  }

  const navLinks = getNavLinks()

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] h-16 flex items-center justify-between px-4 md:px-6 lg:px-10"
      style={{
        background: 'var(--nav-bg)',
        borderBottom: '3px solid var(--border-color)',
        boxShadow: '0 3px 0 var(--shadow-color)',
      }}>
      {/* Logo */}
      <Link to="/" className="flex items-center" aria-label="Formrus home">
        <img
          src="/brand/formrus-wordmark.svg"
          alt="FORMRUS"
          className="h-8 md:h-10 w-auto"
        />
      </Link>

      {/* Desktop Nav */}
      <div className="hidden md:flex items-center gap-2">
        {navLinks.map((link, i) => (
          <div key={i}>
            {link.to ? (
              <Link
                to={link.to}
                className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors hover:text-neon-lime"
                style={{ color: 'var(--text-secondary)' }}
              >
                {link.label}
              </Link>
            ) : (
              <button
                onClick={link.onClick}
                className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors hover:text-neon-lime"
                style={{ color: 'var(--text-secondary)' }}
              >
                {link.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle compact />
        {isLanding ? (
          <>
            <Link
              to="/docs"
              className="retro-button text-xs hidden sm:inline-flex"
            >
              Docs
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="retro-button text-xs hidden sm:inline-flex"
            >
              GitHub
            </a>
            <Link
              to="/dashboard"
              className="retro-button-neon text-xs hidden sm:inline-flex"
              style={{ backgroundColor: '#39FF14', color: '#000' }}
            >
              Dashboard
            </Link>
          </>
        ) : (
          <FormrusConnectButton />
        )}
        {navLinks.length > 0 ? <MobileMenu navLinks={navLinks} /> : null}
      </div>
    </nav>
  )
}
