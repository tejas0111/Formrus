import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen dot-grid flex items-center justify-center px-4" style={{ backgroundColor: "var(--bg)" }}>
          <div className="max-w-md w-full text-center">
            <div
              className="inline-block border-[3px] border-retro-border p-4 mb-6"
              style={{ background: "var(--bg-card)", boxShadow: "6px 6px 0px var(--shadow-color)" }}
            >
              <div className="w-14 h-14 mx-auto flex items-center justify-center border-[3px] border-retro-border" style={{ background: "#FF69B4", boxShadow: "3px 3px 0px var(--shadow-color)" }}>
                <AlertTriangle size={28} color="#000" />
              </div>
            </div>

            <p className="font-mono font-bold text-sm uppercase mb-2" style={{ color: "var(--text)" }}>
              Something Went Wrong
            </p>
            <p className="font-mono text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
              An unexpected error occurred. This is likely a temporary issue.
            </p>
            {this.state.error ? (
              <details className="mb-6 text-left">
                <summary className="font-mono text-[10px] uppercase cursor-pointer" style={{ color: "var(--text-muted)" }}>
                  Error details
                </summary>
                <pre className="font-mono text-[10px] mt-2 p-3 border-[2px] border-retro-border overflow-auto max-h-32" style={{ background: "var(--code-bg)", color: "#FF69B4" }}>
                  {this.state.error.message}
                </pre>
              </details>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="retro-button-neon text-xs justify-center"
                style={{ backgroundColor: "#39FF14", color: "#000" }}
              >
                <RefreshCw size={14} />
                Reload Page
              </button>
              <a href="/" className="retro-button text-xs justify-center">
                <Home size={14} />
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
