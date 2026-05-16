import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Share2, Code2, Database } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const cards = [
  { icon: Share2, title: 'Share a link', desc: 'One URL. Works on any device.', color: '#39FF14' },
  { icon: Code2, title: 'Embed', desc: 'Copy a snippet. Drop it into your site.', color: '#00FFFF' },
  { icon: Database, title: 'Collect on-chain', desc: 'Responses write to Walrus—verifiable and permanent.', color: '#FF00FF' },
]

export default function ShareCollect() {
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
          { y: '15vh', scale: 0.92, opacity: 0 },
          {
            y: 0, scale: 1, opacity: 1,
            scrollTrigger: {
              trigger: card,
              start: 'top 90%',
              end: 'top 60%',
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
      className="relative w-full min-h-screen py-20 md:py-32 overflow-hidden z-[16] dot-grid"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div ref={headingRef} className="text-center mb-12 md:mb-16 px-6 will-change-transform">
        <img
          src="/brand/walrus-left-pointing-purple.jpg"
          alt=""
          className="mx-auto w-44 md:w-56 aspect-square object-cover border-[3px] border-retro-border mb-5"
          style={{ boxShadow: '4px 4px 0px var(--shadow-color)' }}
        />
        <div
          className="inline-block border-[3px] border-retro-border px-4 md:px-6 py-2 md:py-3"
          style={{
            background: '#FF69B4',
            boxShadow: '4px 4px 0px var(--shadow-color)',
          }}
        >
          <h2
            className="font-mono font-bold uppercase tracking-tight"
            style={{
              fontSize: 'clamp(24px, 4vw, 48px)',
              color: '#000',
              textShadow: '2px 2px 0px rgba(0,0,0,0.15)',
            }}
          >
            Share & Collect
          </h2>
        </div>
        <p className="mt-4 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
          Send a link, embed a widget, or drop a form into your app.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-stretch justify-center gap-5 md:gap-6 px-6 md:px-10 lg:px-16 max-w-5xl mx-auto">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <div
              key={i}
              ref={el => { cardsRef.current[i] = el }}
              className="will-change-transform flex-1"
            >
              <div
                className="border-[3px] border-retro-border p-5 md:p-6 h-full transition-all duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer"
                style={{
                  background: 'var(--bg-card)',
                  boxShadow: '4px 4px 0px var(--shadow-color)',
                }}
              >
                <div
                  className="w-12 h-12 flex items-center justify-center border-[3px] border-retro-border mb-5"
                  style={{
                    backgroundColor: card.color,
                    boxShadow: '3px 3px 0px var(--shadow-color)',
                  }}
                >
                  <Icon size={22} color="#000" strokeWidth={2.5} />
                </div>
                <h3 className="font-mono font-bold text-sm md:text-base mb-2 uppercase tracking-wide" style={{ color: 'var(--text)' }}>
                  {card.title}
                </h3>
                <p className="font-mono text-xs md:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {card.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
