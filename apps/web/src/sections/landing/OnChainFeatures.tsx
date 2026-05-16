import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HardDrive, Wallet, Trophy } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const featureCards = [
  { icon: HardDrive, title: 'Walrus Storage', desc: 'Persist form data and files with decentralized storage.', color: '#39FF14' },
  { icon: Wallet, title: 'Wallet Verify', desc: 'Require signatures, token balances, or NFT ownership.', color: '#00FFFF' },
  { icon: Trophy, title: 'Rewards', desc: 'Reward submitters with tokens or points—automatically.', color: '#FF00FF' },
]

export default function OnChainFeatures() {
  const sectionRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.fromTo(textRef.current,
        { x: '-10vw', opacity: 0 },
        {
          x: 0, opacity: 1,
          scrollTrigger: {
            trigger: textRef.current,
            start: 'top 80%',
            end: 'top 55%',
            scrub: 0.5,
          }
        }
      )

      cardsRef.current.forEach((card) => {
        if (!card) return
        gsap.fromTo(card,
          { x: '18vw', rotate: 3, opacity: 0 },
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
      className="relative w-full min-h-screen py-20 md:py-32 overflow-hidden z-[13] dot-grid"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="relative flex flex-col lg:flex-row items-start gap-8 md:gap-12 px-6 md:px-10 lg:px-16 max-w-6xl mx-auto">
        {/* Left text */}
        <div ref={textRef} className="lg:w-2/5 will-change-transform">
          <img
            src="/brand/walrus-surrounded-forms.jpg"
            alt=""
            className="w-full max-w-sm aspect-square object-cover border-[3px] border-retro-border mb-5"
            style={{ boxShadow: '4px 4px 0px var(--shadow-color)' }}
          />
          <div
            className="inline-block border-[3px] border-retro-border px-4 md:px-6 py-2 md:py-3 mb-4"
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
              On-Chain Features
            </h2>
          </div>
          <p className="font-mono text-sm leading-relaxed max-w-sm" style={{ color: 'var(--text-secondary)' }}>
            Store responses on Walrus. Verify wallets. Trigger smart contract actions—without a backend.
          </p>
        </div>

        {/* Right stacked cards */}
        <div className="lg:w-3/5 w-full space-y-4 md:space-y-5">
          {featureCards.map((feat, i) => {
            const Icon = feat.icon
            return (
              <div
                key={i}
                ref={el => { cardsRef.current[i] = el }}
                className="will-change-transform"
                style={{ marginLeft: `${i * 16}px` }}
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
                      className="w-12 h-12 flex items-center justify-center border-[3px] border-retro-border flex-shrink-0"
                      style={{
                        backgroundColor: feat.color,
                        boxShadow: '3px 3px 0px var(--shadow-color)',
                      }}
                    >
                      <Icon size={22} color="#000" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-sm md:text-base mb-2 uppercase tracking-wide" style={{ color: 'var(--text)' }}>
                        {feat.title}
                      </h3>
                      <p className="font-mono text-xs md:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
