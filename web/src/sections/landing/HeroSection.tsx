import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PillTag from '../../components/PillTag'

gsap.registerPlugin(ScrollTrigger)

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const mascotRef = useRef<HTMLImageElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const tagsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const section = sectionRef.current
    const content = contentRef.current
    const mascot = mascotRef.current
    if (!section || !content || !mascot) return

    const ctx = gsap.context(() => {
      // Load animation
      const loadTl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      loadTl
        .fromTo(titleRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, 0.2)
        .fromTo(subtitleRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, 0.35)
        .fromTo(ctaRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0.45)
        .fromTo(tagsRef.current, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0.55)
        .fromTo(mascot, { x: 80, scale: 0.9, opacity: 0 }, { x: 0, scale: 1, opacity: 1, duration: 1, ease: 'back.out(1.2)' }, 0.25)

      // Scroll-driven exit
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=140%',
          pin: true,
          scrub: 0.6,
          onLeaveBack: () => {
            gsap.set([content, mascot, titleRef.current, subtitleRef.current, ctaRef.current, tagsRef.current], {
              clearProps: 'all'
            })
            loadTl.progress(1)
          }
        }
      })

      // EXIT phase (70-100%)
      scrollTl
        .fromTo(content, { x: 0, opacity: 1 }, { x: '-40vw', opacity: 0, ease: 'power2.in' }, 0.70)
        .fromTo(mascot, { x: 0, opacity: 1 }, { x: '40vw', opacity: 0, ease: 'power2.in' }, 0.70)

    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-screen overflow-hidden z-10 dot-grid"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Content */}
      <div
        ref={contentRef}
        className="absolute will-change-transform"
        style={{
          left: 'clamp(24px, 4vw, 64px)',
          top: 'clamp(104px, 18vh, 150px)',
          maxWidth: '680px',
          width: 'calc(100vw - 96px)',
        }}
      >
        {/* Title Card */}
        <div
          className="inline-block max-w-full border-[3px] border-retro-border p-4 md:p-6 mb-6"
          style={{
            background: 'var(--bg-card)',
            boxShadow: '6px 6px 0px var(--shadow-color)',
          }}
        >
          <h1
            ref={titleRef}
            className="font-mono font-bold uppercase leading-[0.9]"
            style={{
              fontSize: 'clamp(26px, 6vw, 68px)',
              color: 'var(--text)',
              textShadow: '3px 3px 0px var(--text-shadow-color)',
            }}
          >
            Programmable<br />Forms
          </h1>
        </div>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="font-mono text-sm md:text-base leading-relaxed max-w-[300px] sm:max-w-md mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          Build surveys, collect files, and verify responses—on Sui and Walrus. No backend needed.
        </p>

        {/* CTAs */}
        <div ref={ctaRef} className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6 w-[280px] max-w-full sm:w-auto">
          <Link to="/dashboard" className="w-full sm:w-auto">
            <button
              className="retro-button-neon text-sm w-full justify-center sm:w-auto"
              style={{ backgroundColor: '#39FF14', color: '#000' }}
            >
              Open Dashboard
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </Link>
        </div>

        {/* Tags */}
        <div ref={tagsRef} className="flex flex-wrap gap-2">
          <PillTag color="#39FF14">No Code</PillTag>
          <PillTag color="#00FFFF">Open Source</PillTag>
          <PillTag color="#FF00FF">On Chain</PillTag>
        </div>
      </div>

      {/* Mascot */}
      <img
        ref={mascotRef}
        src="/brand/walrus-form-cutout.png"
        alt="Formrus walrus mascot"
        className="absolute will-change-transform object-contain hidden md:block"
        style={{
          right: 'clamp(12px, 4vw, 72px)',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 'clamp(220px, 32vw, 460px)',
          height: 'auto',
          maxHeight: '62vh',
        }}
      />
    </section>
  )
}
