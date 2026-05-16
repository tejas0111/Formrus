import { Link } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { IllustrationStage } from "../components/IllustrationStage";
import SiteFooter from "../components/SiteFooter";

export function NotFoundPage() {
  const notFoundIllustration = "/brand/not-found-walrus.png";
  return (
    <div className="min-h-screen dot-grid px-4 py-12 md:px-6 lg:px-10" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-6xl mx-auto min-h-[calc(100vh-6rem)] flex items-center">
        <section
          className="w-full border-[3px] border-retro-border overflow-hidden"
          style={{ background: "var(--bg-card)", boxShadow: "8px 8px 0px var(--shadow-color)" }}
        >
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative p-6 md:p-8 lg:p-10 border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-retro-border" style={{ background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-secondary) 100%)" }}>
              <div className="inline-flex items-center border-[2px] border-retro-border px-3 py-1.5 mb-5 font-mono text-[10px] uppercase font-bold tracking-[0.16em]" style={{ background: "#FF69B4", color: "#000" }}>
                Wrong Route
              </div>
              <div className="mb-5">
                <div className="font-mono font-bold text-[5rem] md:text-[7rem] leading-none" style={{ color: "#FF69B4", textShadow: "5px 5px 0px var(--text-shadow-color)" }}>
                  404
                </div>
                <h1 className="font-mono font-bold text-xl md:text-3xl uppercase mt-3" style={{ color: "var(--text)" }}>
                  Page Not Found
                </h1>
              </div>
              <p className="font-mono text-xs md:text-sm max-w-xl leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                This link does not resolve to a live Formrus page. The form may have moved, the URL may be incomplete, or the route simply does not exist.
              </p>
              <p className="font-mono text-[11px] max-w-lg mb-8" style={{ color: "var(--text-muted)" }}>
                If this came from a shared form, check the object ID in the URL. Dashboard routes also require a valid team wallet.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/" className="retro-button-neon text-xs justify-center" style={{ backgroundColor: "#39FF14", color: "#000" }}>
                  <Home size={14} />
                  Go Home
                </Link>
                <Link to="/dashboard" className="retro-button text-xs justify-center">
                  <ArrowLeft size={14} />
                  Dashboard
                </Link>
              </div>
            </div>

            <div className="relative p-6 md:p-8 lg:p-10 flex items-center justify-center overflow-hidden" style={{ background: "radial-gradient(circle at top, rgba(255, 0, 255, 0.18), transparent 48%), linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%)" }}>
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(0,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.12) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
              <div className="relative w-full max-w-md">
                <IllustrationStage src={notFoundIllustration} alt="Walrus 404 illustration" label="Lost Walrus" tone="cyan" imageMaxWidth={340} minHeightClassName="min-h-[280px]" />
              </div>
            </div>
          </div>
        </section>
      </div>
      <div className="max-w-6xl mx-auto">
        <SiteFooter />
      </div>
    </div>
  );
}
