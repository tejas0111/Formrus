import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Type, AlignLeft, CheckSquare, ChevronDown, ListChecks, CheckCircle, Link2, Upload } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const widgets = [
  { icon: Type, label: 'Short text' },
  { icon: AlignLeft, label: 'Long text' },
  { icon: CheckSquare, label: 'Checkbox' },
  { icon: ChevronDown, label: 'Dropdown' },
  { icon: ListChecks, label: 'Multiple option' },
  { icon: CheckCircle, label: 'Confirmation' },
  { icon: Link2, label: 'Link' },
  { icon: Upload, label: 'File upload' },
]

const accentColors = ['#39FF14', '#00FFFF', '#FF00FF', '#FFFF00', '#FF69B4', '#00FF88', '#39FF14', '#00FFFF']

export default function WidgetsCloud() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.fromTo(headingRef.current,
        { y: '6vh', opacity: 0 },
        {
          y: 0, opacity: 1,
          scrollTrigger: {
            trigger: headingRef.current,
            start: 'top 80%',
            end: 'top 60%',
            scrub: 0.5,
          }
        }
      )

      cardsRef.current.forEach((card) => {
        if (!card) return
        gsap.fromTo(card,
          { scale: 0.85, y: '8vh', rotate: -2, opacity: 0 },
          {
            scale: 1, y: 0, rotate: 0, opacity: 1,
            scrollTrigger: {
              trigger: card,
              start: 'top 90%',
              end: 'top 65%',
              scrub: 0.5,
            }
          }
        )
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="widgets"
      className="relative w-full min-h-screen py-20 md:py-32 overflow-hidden z-[14] dot-grid"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div ref={headingRef} className="text-center mb-12 md:mb-16 px-6 will-change-transform">
        <div
          className="inline-block border-[3px] border-retro-border px-4 md:px-6 py-2 md:py-3"
          style={{
            background: '#FF00FF',
            boxShadow: '4px 4px 0px var(--shadow-color)',
          }}
        >
          <h2
            className="font-mono font-bold uppercase tracking-tight"
            style={{
              fontSize: 'clamp(24px, 4vw, 48px)',
              color: '#fff',
              textShadow: '2px 2px 0px rgba(0,0,0,0.3)',
            }}
          >
            Composable Widgets
          </h2>
        </div>
        <p className="mt-4 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
          Mix and match inputs like building blocks.
        </p>
      </div>

      {/* Widgets grid */}
      <div className="px-6 md:px-10 lg:px-16 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-5">
          {widgets.map((w, i) => {
            const Icon = w.icon
            const accent = accentColors[i % accentColors.length]
            return (
              <div
                key={i}
                ref={el => { cardsRef.current[i] = el }}
                className="will-change-transform"
              >
                <div
                  className="border-[3px] border-retro-border p-4 md:p-5 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5"
                  style={{
                    background: 'var(--bg-card)',
                    boxShadow: '4px 4px 0px var(--shadow-color)',
                  }}
                >
                  <div
                    className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border-[3px] border-retro-border"
                    style={{
                      backgroundColor: accent,
                      boxShadow: '2px 2px 0px var(--shadow-color)',
                    }}
                  >
                    <Icon size={18} color="#000" strokeWidth={2.5} />
                  </div>
                  <span className="font-mono font-bold text-[10px] md:text-xs text-center uppercase tracking-wide" style={{ color: 'var(--text)' }}>
                    {w.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
