import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const testimonials = [
  {
    name: 'Ava Chen',
    handle: '@avachen',
    avatar: '/avatar_ava.png',
    quote: 'We replaced our old survey stack with Formrus. Now responses are on-chain and verifiable.',
    color: '#39FF14',
  },
  {
    name: 'Leo Park',
    handle: '@leopark',
    avatar: '/avatar_leo.png',
    quote: 'The builder feels like a game. Our community actually enjoys filling forms now.',
    color: '#00FFFF',
  },
]

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.fromTo(headingRef.current,
        { x: '-6vw', opacity: 0 },
        {
          x: 0, opacity: 1,
          scrollTrigger: {
            trigger: headingRef.current,
            start: 'top 80%',
            end: 'top 60%',
            scrub: 0.5,
          }
        }
      )

      cardsRef.current.forEach((card, i) => {
        if (!card) return
        const fromX = i === 0 ? '-12vw' : '12vw'
        const rotate = i === 0 ? -2 : 2
        gsap.fromTo(card,
          { x: fromX, rotate, opacity: 0 },
          {
            x: 0, rotate: 0, opacity: 1,
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              end: 'top 55%',
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
      id="testimonials"
      className="relative w-full min-h-screen py-20 md:py-32 overflow-hidden z-[17] dot-grid"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="px-6 md:px-10 lg:px-16 max-w-4xl mx-auto">
        <div
          ref={headingRef}
          className="inline-block border-[3px] border-retro-border px-4 md:px-6 py-2 md:py-3 mb-10 md:mb-14 will-change-transform"
          style={{
            background: '#FFFF00',
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
            Loved by Creators
          </h2>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-wider mb-6 md:mb-8" style={{ color: 'var(--text-muted)' }}>
          Demo testimonials — real feedback coming soon
        </p>

        <div className="flex flex-col gap-6 md:gap-8">
          {testimonials.map((t, i) => (
            <div
              key={i}
              ref={el => { cardsRef.current[i] = el }}
              className="will-change-transform"
            >
              <div
                className="border-[3px] border-retro-border p-5 md:p-6"
                style={{
                  background: 'var(--bg-card)',
                  boxShadow: '4px 4px 0px var(--shadow-color)',
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 flex items-center justify-center border-[3px] border-retro-border flex-shrink-0 overflow-hidden"
                    style={{ boxShadow: '3px 3px 0px var(--shadow-color)' }}
                  >
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono font-bold text-sm uppercase" style={{ color: 'var(--text)' }}>{t.name}</span>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{t.handle}</span>
                    </div>
                    <div className="relative">
                      <span
                        className="absolute -left-1 -top-2 font-mono text-lg"
                        style={{ color: t.color }}
                      >"</span>
                      <p className="font-mono text-xs md:text-sm leading-relaxed pl-4" style={{ color: 'var(--text-secondary)' }}>
                        {t.quote}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
