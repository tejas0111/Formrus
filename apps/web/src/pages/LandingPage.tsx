import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import TopNav from '../components/TopNav'
import HeroSection from '../sections/landing/HeroSection'
import FeatureMarquee from '../sections/landing/FeatureMarquee'
import SetupSteps from '../sections/landing/SetupSteps'
import OnChainFeatures from '../sections/landing/OnChainFeatures'
import WidgetsCloud from '../sections/landing/WidgetsCloud'
import BuilderDemo from '../sections/landing/BuilderDemo'
import ShareCollect from '../sections/landing/ShareCollect'
import Testimonials from '../sections/landing/Testimonials'
import ClosingCTA from '../sections/landing/ClosingCTA'
import SiteFooter from '../components/SiteFooter'

gsap.registerPlugin(ScrollTrigger)

const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function LandingPage() {
  useEffect(() => {
    if (prefersReducedMotion) return // skip all scroll animations

    const setupSnap = () => {
      const pinned = ScrollTrigger.getAll()
        .filter(st => st.vars.pin)
        .sort((a, b) => a.start - b.start)

      const maxScroll = ScrollTrigger.maxScroll(window)
      if (!maxScroll || pinned.length === 0) return

      const pinnedRanges = pinned.map(st => ({
        start: st.start / maxScroll,
        end: (st.end ?? st.start) / maxScroll,
        center: (st.start + ((st.end ?? st.start) - st.start) * 0.5) / maxScroll,
      }))

      ScrollTrigger.create({
        snap: {
          snapTo: (value: number) => {
            const inPinned = pinnedRanges.some(r => value >= r.start - 0.02 && value <= r.end + 0.02)
            if (!inPinned) return value

            const target = pinnedRanges.reduce((closest, r) =>
              Math.abs(r.center - value) < Math.abs(closest - value) ? r.center : closest,
              pinnedRanges[0]?.center ?? 0
            )
            return target
          },
          duration: { min: 0.15, max: 0.35 },
          delay: 0,
          ease: 'power2.out',
        }
      })
    }

    const timer = setTimeout(setupSnap, 500)

    return () => {
      clearTimeout(timer)
      ScrollTrigger.getAll().forEach(st => st.kill())
    }
  }, [])

  return (
    <div className="relative">
      <TopNav />
      <HeroSection />
      <FeatureMarquee />
      <SetupSteps />
      <OnChainFeatures />
      <WidgetsCloud />
      <BuilderDemo />
      <ShareCollect />
      <Testimonials />
      <ClosingCTA />
      <div className="px-4 md:px-6 lg:px-10 max-w-7xl mx-auto pb-8">
        <SiteFooter />
      </div>
    </div>
  )
}
