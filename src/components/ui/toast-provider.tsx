"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { TOAST_DURATIONS } from "@/lib/ui/interaction";
import { cn } from "@/lib/utils/cn";

type ToastVariant = "success" | "info" | "warning" | "error";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
  persistent?: boolean;
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toastTone = {
  success: {
    icon: CheckCircle2,
    shell: "border-[#cfe7d7] bg-white text-[#0d2315]",
    iconShell: "bg-[#ecf8f0] text-[#12796a]",
    progress: "bg-[#12796a]",
    accent: "bg-[#12796a]",
  },
  info: {
    icon: Info,
    shell: "border-[#d7e5f4] bg-white text-[#0d2315]",
    iconShell: "bg-[#eef6ff] text-[#256f9c]",
    progress: "bg-[#256f9c]",
    accent: "bg-[#256f9c]",
  },
  warning: {
    icon: AlertTriangle,
    shell: "border-[#eadab8] bg-white text-[#0d2315]",
    iconShell: "bg-[#fff7e8] text-[#8a6410]",
    progress: "bg-[#8a6410]",
    accent: "bg-[#8a6410]",
  },
  error: {
    icon: AlertCircle,
    shell: "border-[#efcdcd] bg-white text-[#0d2315]",
    iconShell: "bg-[#fff1f1] text-[#a13d3d]",
    progress: "bg-[#a13d3d]",
    accent: "bg-[#a13d3d]",
  },
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current[id];
    if (timer) {
      window.clearTimeout(timer);
      delete timersRef.current[id];
    }
  }, []);

  const showToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const duration = toast.duration ?? TOAST_DURATIONS[toast.variant];
    const nextToast = { ...toast, id, duration };

    setToasts((current) => [nextToast, ...current].slice(0, 5));

    if (!toast.persistent && duration > 0) {
      timersRef.current[id] = window.setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  }, [dismissToast]);

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  const contextValue = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[var(--z-toast)] flex w-[min(390px,calc(100vw-2rem))] flex-col gap-2.5 sm:right-5 sm:top-5">
        {toasts.map((toast) => {
          const tone = toastTone[toast.variant];
          const Icon = tone.icon;

          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto relative overflow-hidden rounded-[12px] border py-3 pl-3 pr-2 shadow-[0_18px_44px_-24px_rgba(13,35,21,0.42),0_8px_18px_-14px_rgba(13,35,21,0.28)] ring-1 ring-black/[0.02] backdrop-blur transition-all duration-200",
                tone.shell,
              )}
            >
              <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", tone.accent)} />
              {toast.duration ? (
                <span
                  className={cn("absolute inset-x-0 bottom-0 h-[2px] origin-left opacity-70", tone.progress)}
                  style={{ animation: `toast-progress ${toast.duration}ms linear forwards` }}
                />
              ) : null}
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]",
                    tone.iconShell,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-[var(--font-heading)] text-[13px] font-bold leading-5 text-[#0d2315]">
                    {toast.title}
                  </p>
                  {toast.description ? (
                    <p className="mt-0.5 text-[12px] leading-5 text-[#66736b]">
                      {toast.description}
                    </p>
                  ) : null}

                  {toast.action ? (
                    <button
                      type="button"
                      onClick={toast.action.onClick}
                      className="mt-2 inline-flex h-8 items-center rounded-[8px] border border-[#dee8e2] bg-[#f4f8f6] px-3 text-[12px] font-bold text-[#12796a] transition hover:border-[#12796a] hover:bg-[#eef7f2]"
                    >
                      {toast.action.label}
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[#9aa9a1] transition hover:bg-[#f4f8f6] hover:text-[#0d2315]"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
