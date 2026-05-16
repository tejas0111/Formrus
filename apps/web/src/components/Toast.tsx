import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const ctx: ToastContextValue = {
    toast,
    success: (msg) => toast(msg, "success"),
    error: (msg) => toast(msg, "error"),
    info: (msg) => toast(msg, "info"),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colorMap = {
  success: { bg: "#39FF14", border: "#39FF14" },
  error: { bg: "#FF69B4", border: "#FF69B4" },
  info: { bg: "#00FFFF", border: "#00FFFF" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const Icon = iconMap[toast.kind];
  const colors = colorMap[toast.kind];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className="pointer-events-auto transition-all duration-300 ease-out"
      style={{
        transform: visible ? "translateX(0)" : "translateX(120%)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="flex items-start gap-3 p-3 border-[3px] font-mono text-xs"
        style={{
          background: "var(--bg-card)",
          borderColor: colors.border,
          boxShadow: `4px 4px 0px var(--shadow-color)`,
          color: "var(--text)",
        }}
      >
        <div
          className="w-6 h-6 flex items-center justify-center flex-shrink-0 border-[2px] border-retro-border"
          style={{ backgroundColor: colors.bg }}
        >
          <Icon size={14} color="#000" strokeWidth={2.5} />
        </div>
        <span className="flex-1 pt-0.5 leading-relaxed">{toast.message}</span>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
