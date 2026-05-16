import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { FilePlus, Database, ShieldCheck, Zap, Gift, Download } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const features = [
  { icon: FilePlus, label: 'Create Programmable Form' },
  { icon: Database, label: 'Collect On-Chain Responses' },
  { icon: ShieldCheck, label: 'Verify & Automate' },
  { icon: Zap, label: 'Automate Actions' },
  { icon: Gift, label: 'Earn Rewards' },
  { icon: Download, label: 'Export Anywhere' },
]

const accentColors = ['#39FF14', '#00FFFF', '#FF00FF', '#FFFF00', '#FF69B4', '#00FF88']

export default function FeatureMarquee() {
  const sectionRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const section = sectionRef.current
    const title = titleRef.current
    const track = trackRef.current
    if (!section || !title || !track) return

    const ctx = gsap.context(() => {
      const cards = track.querySelectorAll('.feature-card')
      const mm = gsap.matchMedia()

      mm.add('(max-width: 767px)', () => {
        gsap.fromTo(title, { y: 24, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: 0.45,
          scrollTrigger: { trigger: section, start: 'top 82%' }
        })
        gsap.fromTo(cards, { y: 20, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: 0.4,
          stagger: 0.05,
          scrollTrigger: { trigger: track, start: 'top 86%' }
        })
      })

      mm.add('(min-width: 768px)', () => {
        const scrollTl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=130%',
            pin: true,
            scrub: 0.6,
          }
        })

        scrollTl
          .fromTo(title, { x: '-18vw', opacity: 0 }, { x: 0, opacity: 1, ease: 'none' }, 0)
          .fromTo(cards, { x: '60vw', y: '4vh', rotate: 2, opacity: 0 }, {
            x: 0, y: 0, rotate: 0, opacity: 1,
            stagger: 0.03,
            ease: 'none'
          }, 0)
          .fromTo(title, { x: 0, opacity: 1 }, { x: '-10vw', opacity: 0, ease: 'power2.in' }, 0.70)
          .fromTo(track, { x: 0, opacity: 1 }, { x: '-50vw', opacity: 0, ease: 'power2.in' }, 0.70)
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative w-full min-h-[80vh] md:h-screen overflow-hidden z-[11] flex flex-col justify-center dot-grid py-12 md:py-0"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Title */}
      <div ref={titleRef} className="relative px-6 md:px-10 lg:px-16 pt-[12vh] mb-8 md:mb-12">
        <div
          className="inline-block border-[3px] border-retro-border px-4 md:px-6 py-2 md:py-3"
          style={{
            background: '#39FF14',
            boxShadow: '4px 4px 0px var(--shadow-color)',
          }}
        >
          <h2
            className="font-mono font-bold uppercase tracking-tight"
            style={{
              fontSize: 'clamp(24px, 4vw, 48px)',
              color: '#000',
              textShadow: '2px 2px 0px rgba(0,0,0,0.2)',
            }}
          >
            Everything you need
          </h2>
        </div>
        <p className="mt-4 font-mono text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
          A toolkit of field types, rules, and on-chain actions.
        </p>
      </div>

      {/* Cards Track - scrollable on mobile, grid on larger screens */}
      <div
        ref={trackRef}
        className="relative flex gap-4 md:gap-6 px-6 md:px-10 lg:px-16 items-stretch overflow-x-auto pb-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {features.map((feat, i) => {
          const Icon = feat.icon
          const accent = accentColors[i % accentColors.length]
          return (
            <div
              key={i}
              className="feature-card flex-shrink-0 border-[3px] border-retro-border p-5 md:p-6 flex flex-col items-center justify-center gap-4 will-change-transform snap-start"
              style={{
                width: 'clamp(150px, 22vw, 260px)',
                minHeight: 'clamp(160px, 28vh, 240px)',
                background: 'var(--bg-card)',
                boxShadow: '4px 4px 0px var(--shadow-color)',
              }}
            >
              <div
                className="w-14 h-14 flex items-center justify-center border-[3px] border-retro-border"
                style={{
                  backgroundColor: accent,
                  boxShadow: '3px 3px 0px var(--shadow-color)',
                }}
              >
                <Icon size={24} color="#000" strokeWidth={2.5} />
              </div>
              <span
                className="font-mono font-bold text-center text-xs md:text-sm leading-tight uppercase tracking-wide"
                style={{ color: 'var(--text)' }}
              >
                {feat.label}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
