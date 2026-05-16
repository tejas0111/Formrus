import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)
const GITHUB_URL = 'https://github.com/tejas0111/Formrus'

export default function ClosingCTA() {
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.fromTo(contentRef.current,
        { y: '6vh', scale: 0.96, opacity: 0 },
        {
          y: 0, scale: 1, opacity: 1,
          scrollTrigger: {
            trigger: contentRef.current,
            start: 'top 80%',
            end: 'top 55%',
            scrub: 0.5,
          }
        }
      )
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-screen py-20 md:py-32 overflow-hidden z-[18] flex flex-col items-center justify-center dot-grid"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Content */}
      <div ref={contentRef} className="relative text-center px-6 will-change-transform">
        <img
          src="/brand/walrus-carpet-opening.png"
          alt=""
          className="mx-auto w-44 md:w-60 aspect-square object-cover border-[3px] border-retro-border mb-6"
          style={{ boxShadow: '5px 5px 0px var(--shadow-color)' }}
        />
        <div
          className="inline-block border-[3px] border-retro-border px-5 md:px-8 py-3 md:py-4 mb-6"
          style={{
            background: '#39FF14',
            boxShadow: '6px 6px 0px var(--shadow-color)',
          }}
        >
          <h2
            className="font-mono font-bold uppercase tracking-tight"
            style={{
              fontSize: 'clamp(32px, 5vw, 64px)',
              color: '#000',
              textShadow: '3px 3px 0px rgba(0,0,0,0.15)',
            }}
          >
            Start Building
          </h2>
        </div>
        <p className="font-mono text-sm md:text-base mb-8" style={{ color: 'var(--text-secondary)' }}>
          Create your first form in under a minute.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
          <Link to="/dashboard">
            <button
              className="retro-button-neon text-sm"
              style={{ backgroundColor: '#39FF14', color: '#000' }}
            >
              Open Dashboard
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="retro-button text-sm"
          >
            View GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
