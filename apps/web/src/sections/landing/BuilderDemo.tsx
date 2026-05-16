import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { BarChart3, Eye, KeyRound, Lock, Send, Share2 } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const responseRows = [
  { label: 'Ava Patel', status: 'Decrypted', icon: Eye, color: '#39FF14' },
  { label: 'Leo Chen', status: 'Private', icon: Lock, color: '#FF00FF' },
  { label: 'Mina Rao', status: 'Reward paid', icon: Send, color: '#00FFFF' },
]

export default function BuilderDemo() {
  const sectionRef = useRef<HTMLElement>(null)
  const builderRef = useRef<HTMLDivElement>(null)
  const mascotRef = useRef<HTMLImageElement>(null)

  useLayoutEffect(() => {
    const section = sectionRef.current
    const builder = builderRef.current
    const mascot = mascotRef.current
    if (!section || !builder || !mascot) return

    const ctx = gsap.context(() => {
      const panels = builder.querySelectorAll('.builder-panel')
      const mm = gsap.matchMedia()

      mm.add('(max-width: 1023px)', () => {
        gsap.fromTo(builder, { y: 24, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: 0.5,
          scrollTrigger: { trigger: section, start: 'top 84%' }
        })
      })

      mm.add('(min-width: 1024px)', () => {
        const scrollTl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=150%',
            pin: true,
            scrub: 0.7,
          }
        })

        scrollTl
          .fromTo(builder, { x: '-50vw', opacity: 0 }, { x: 0, opacity: 1, ease: 'none' }, 0)
          .fromTo(panels, { y: '4vh', opacity: 0 }, {
            y: 0, opacity: 1, stagger: 0.08, ease: 'none'
          }, 0.05)
          .fromTo(mascot, { x: '50vw', scale: 0.9, opacity: 0 }, { x: 0, scale: 1, opacity: 1, ease: 'none' }, 0)
          .fromTo(builder, { x: 0, opacity: 1 }, { x: '-30vw', opacity: 0, ease: 'power2.in' }, 0.70)
          .fromTo(mascot, { x: 0, opacity: 1 }, { x: '30vw', opacity: 0, ease: 'power2.in' }, 0.70)
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-screen lg:h-screen overflow-hidden z-[15] flex items-center dot-grid py-12 lg:py-0"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Admin UI */}
      <div
        ref={builderRef}
        className="relative mx-auto lg:absolute lg:left-[8vw] lg:top-[12vh] will-change-transform w-[92vw] md:w-[86vw] lg:w-[clamp(340px,44vw,560px)] max-w-3xl lg:max-w-none"
      >
        <div
          className="builder-panel border-[3px] border-retro-border p-4 md:p-5 mb-4"
          style={{ background: 'var(--bg-card)', boxShadow: '4px 4px 0px var(--shadow-color)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 flex items-center justify-center border-[3px] border-retro-border"
                style={{ backgroundColor: '#39FF14', boxShadow: '2px 2px 0px var(--shadow-color)' }}
              >
                <BarChart3 size={16} color="#000" strokeWidth={2.5} />
              </div>
              <div>
                <div className="font-mono font-bold text-xs uppercase" style={{ color: 'var(--text)' }}>Response Console</div>
                <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>Creator view with answers, rewards, and share link</div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 border-[2px] border-retro-border px-2 py-1" style={{ background: 'var(--bg-secondary)' }}>
              <Share2 size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="font-mono text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Public link</span>
            </div>
          </div>
        </div>

        <div
          className="builder-panel grid grid-cols-3 gap-3 mb-4"
        >
          {[
            ['42', 'Responses', '#00FFFF'],
            ['31', 'Submitters', '#FF00FF'],
            ['0.84', 'SUI pool', '#FFFF00'],
          ].map(([value, label, color]) => (
            <div key={label} className="border-[3px] border-retro-border p-3" style={{ background: 'var(--bg-card)', boxShadow: '3px 3px 0px var(--shadow-color)' }}>
              <div className="w-5 h-5 border-[2px] border-retro-border mb-2" style={{ backgroundColor: color }} />
              <div className="font-mono font-bold text-lg leading-none" style={{ color: 'var(--text)' }}>{value}</div>
              <div className="font-mono text-[9px] uppercase mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>

        <div
          className="builder-panel border-[3px] border-retro-border p-4 md:p-5"
          style={{ background: 'var(--bg-card)', boxShadow: '4px 4px 0px var(--shadow-color)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono font-bold text-xs uppercase" style={{ color: 'var(--text)' }}>Latest Responses</span>
            <span className="font-mono text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Admin only</span>
          </div>
          <div className="space-y-2">
            {responseRows.map((row, i) => {
              const Icon = row.icon
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 border-[2px] border-retro-border p-3"
                  style={{
                    background: 'var(--bg-secondary)',
                  }}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 flex items-center justify-center border-[2px] border-retro-border flex-shrink-0" style={{ backgroundColor: row.color }}>
                      <Icon size={13} color="#000" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-mono font-bold text-xs truncate" style={{ color: 'var(--text)' }}>{row.label}</span>
                      <span className="block font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{row.status}</span>
                    </span>
                  </span>
                  {row.status === 'Private' ? <KeyRound size={14} style={{ color: 'var(--text-muted)' }} /> : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mascot */}
      <img
        ref={mascotRef}
        src="/brand/walrus-tapping-cutout.png"
        alt="Formrus walrus presenting the builder"
        className="absolute will-change-transform object-contain hidden lg:block"
        style={{
          right: '6vw',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 'min(400px, 36vw)',
          height: 'auto',
          maxHeight: '60vh',
        }}
      />
    </section>
  )
}
