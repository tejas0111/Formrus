import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const steps = [
  {
    num: '1',
    title: 'Create a form',
    desc: 'Pick a template or start blank. Drag fields, set rules, and design in clicks.',
    color: '#39FF14',
    image: '/brand/walrus-form-purple.png',
  },
  {
    num: '2',
    title: 'Add inputs & logic',
    desc: 'Short text, files, checkboxes, wallets—plus conditions and limits.',
    color: '#00FFFF',
    image: '/brand/walrus-tapping-purple.jpg',
  },
  {
    num: '3',
    title: 'Publish & collect',
    desc: 'Share a link or embed anywhere. Responses land on-chain.',
    color: '#FF00FF',
    image: '/brand/walrus-pointing-down-purple.png',
  },
]

export default function SetupSteps() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.fromTo(headingRef.current,
        { y: '8vh', opacity: 0 },
        {
          y: 0, opacity: 1,
          scrollTrigger: {
            trigger: headingRef.current,
            start: 'top 80%',
            end: 'top 55%',
            scrub: 0.5,
          }
        }
      )

      cardsRef.current.forEach((card, i) => {
        if (!card) return
        const fromX = i === 0 ? '-20vw' : i === 2 ? '20vw' : '0'
        const fromY = i === 1 ? '15vh' : '0'
        const rotate = i === 0 ? -3 : i === 2 ? 3 : 0

        gsap.fromTo(card,
          { x: fromX, y: fromY, rotate, opacity: 0 },
          {
            x: 0, y: 0, rotate: 0, opacity: 1,
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              end: 'top 50%',
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
      className="relative w-full min-h-screen py-20 md:py-32 overflow-hidden z-[12] dot-grid"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Section heading */}
      <div ref={headingRef} className="text-center mb-12 md:mb-20 px-6">
        <div
          className="inline-block border-[3px] border-retro-border px-4 md:px-6 py-2 md:py-3"
          style={{
            background: '#00FFFF',
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
            How It Works
          </h2>
        </div>
        <p className="mt-4 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
          Connect your wallet, choose a template, and publish.
        </p>
      </div>

      {/* Steps Grid */}
      <div className="relative px-6 md:px-10 lg:px-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <div
              key={i}
              ref={el => { cardsRef.current[i] = el }}
              className="will-change-transform"
            >
              <div
                className="border-[3px] border-retro-border p-5 md:p-6 h-full"
                style={{
                  background: 'var(--bg-card)',
                  boxShadow: '4px 4px 0px var(--shadow-color)',
                }}
              >
                <img
                  src={step.image}
                  alt=""
                  className="w-full aspect-square object-cover border-[3px] border-retro-border mb-5"
                  style={{ boxShadow: '3px 3px 0px var(--shadow-color)' }}
                />
                {/* Step number */}
                <div
                  className="w-12 h-12 flex items-center justify-center font-mono font-bold text-lg mb-5 border-[3px] border-retro-border"
                  style={{
                    backgroundColor: step.color,
                    color: '#000',
                    boxShadow: '3px 3px 0px var(--shadow-color)',
                  }}
                >
                  {step.num}
                </div>

                <h3
                  className="font-mono font-bold text-base md:text-lg mb-3 uppercase tracking-wide"
                  style={{ color: 'var(--text)' }}
                >
                  {step.title}
                </h3>
                <p className="font-mono text-xs md:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
