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
    shell: "border-[var(--color-success)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)]",
    iconShell: "bg-[var(--color-success-dim)] text-[var(--color-success)]",
  },
  info: {
    icon: Info,
    shell: "border-[var(--color-info)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)]",
    iconShell: "bg-[var(--color-info-dim)] text-[var(--color-info)]",
  },
  warning: {
    icon: AlertTriangle,
    shell: "border-[var(--color-warning)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)]",
    iconShell: "bg-[var(--color-warning-dim)] text-[var(--color-warning)]",
  },
  error: {
    icon: AlertCircle,
    shell: "border-[var(--color-danger)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)]",
    iconShell: "bg-[var(--color-danger-dim)] text-[var(--color-danger)]",
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
      <div className="pointer-events-none fixed right-4 top-4 z-[var(--z-toast)] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => {
          const tone = toastTone[toast.variant];
          const Icon = tone.icon;

          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto relative overflow-hidden rounded-2xl border p-4 shadow-[var(--shadow-lg)] transition-all duration-200",
                tone.shell,
              )}
            >
              {toast.duration ? (
                <span
                  className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-[var(--color-accent-primary)]/70"
                  style={{ animation: `toast-progress ${toast.duration}ms linear forwards` }}
                />
              ) : null}
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
                    tone.iconShell,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-[var(--font-display)] text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {toast.title}
                  </p>
                  {toast.description ? (
                    <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                      {toast.description}
                    </p>
                  ) : null}

                  {toast.action ? (
                    <button
                      type="button"
                      onClick={toast.action.onClick}
                      className="btn-link mt-2 text-[12px]"
                    >
                      {toast.action.label}
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="icon-btn h-8 w-8 shrink-0 border-transparent"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
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
