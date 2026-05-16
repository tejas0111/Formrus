import TopNav from "../components/TopNav";
import SiteFooter from "../components/SiteFooter";

export function DocsPage() {
  return (
    <div className="min-h-screen dot-grid" style={{ backgroundColor: "var(--bg)" }}>
      <TopNav />
      <main className="pt-24 pb-12 px-4 md:px-6 lg:px-10 max-w-5xl mx-auto">
        <section
          className="border-[3px] border-retro-border p-5 md:p-7"
          style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}
        >
          <div
            className="inline-flex items-center border-[3px] border-retro-border px-4 py-2 mb-4"
            style={{ background: "#00FFFF", boxShadow: "4px 4px 0px var(--shadow-color)" }}
          >
            <h1 className="font-mono font-bold text-xl md:text-2xl uppercase" style={{ color: "#000" }}>
              Docs
            </h1>
          </div>
          <p className="font-mono text-xs md:text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
            Formrus documentation hub. Full setup, SDK, and contract docs are available in the GitHub repository.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <a
              href="https://github.com/tejas0111/Formrus"
              target="_blank"
              rel="noopener noreferrer"
              className="border-[3px] border-retro-border p-4 hover:border-neon-lime transition-colors"
              style={{ background: "var(--bg-secondary)", boxShadow: "3px 3px 0px var(--shadow-color)" }}
            >
              <div className="font-mono text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>
                Repository
              </div>
              <div className="font-mono font-bold text-sm" style={{ color: "var(--text)" }}>
                tejas0111/Formrus
              </div>
            </a>
            <a
              href="https://github.com/tejas0111/Formrus#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="border-[3px] border-retro-border p-4 hover:border-neon-lime transition-colors"
              style={{ background: "var(--bg-secondary)", boxShadow: "3px 3px 0px var(--shadow-color)" }}
            >
              <div className="font-mono text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>
                Quick Start
              </div>
              <div className="font-mono font-bold text-sm" style={{ color: "var(--text)" }}>
                README Guide
              </div>
            </a>
          </div>
        </section>
        <SiteFooter />
      </main>
    </div>
  );
}
