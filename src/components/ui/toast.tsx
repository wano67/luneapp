'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CheckCircle2, AlertCircle, Info, X, PartyPopper } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info' | 'celebrate';

type CelebrateOptions = {
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string }[];
};

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  leaving: boolean;
  celebrate?: CelebrateOptions;
};

type ToastContextType = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  celebrate: (options: CelebrateOptions) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const DURATION_MS = 3500;
const CELEBRATE_DURATION_MS = 5000;
const EXIT_MS = 300;

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]',
  error: 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]',
  info: 'border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]',
  celebrate: 'border-[var(--shell-accent)] bg-[var(--surface)] text-[var(--text)]',
};

const variantIcons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  celebrate: PartyPopper,
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant, celebrateOpts?: CelebrateOptions) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant, leaving: false, celebrate: celebrateOpts }]);
      setTimeout(() => dismiss(id), variant === 'celebrate' ? CELEBRATE_DURATION_MS : DURATION_MS);
    },
    [dismiss]
  );

  const api = useMemo<ToastContextType>(
    () => ({
      success: (msg) => push(msg, 'success'),
      error: (msg) => push(msg, 'error'),
      info: (msg) => push(msg, 'info'),
      celebrate: (opts) => push(opts.title, 'celebrate', opts),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast container — bottom-right, above everything */}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[80] flex flex-col-reverse items-end gap-2"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const Icon = variantIcons[toast.variant];
          const isCelebrate = toast.variant === 'celebrate' && toast.celebrate;
          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto rounded-2xl border shadow-lg backdrop-blur-sm',
                'transition-all duration-300 ease-out',
                toast.leaving
                  ? 'translate-x-[120%] opacity-0'
                  : isCelebrate ? 'animate-celebrate-enter' : 'animate-toast-enter',
                isCelebrate ? 'px-5 py-4' : 'flex items-center gap-3 px-4 py-3 text-sm font-medium',
                variantStyles[toast.variant]
              )}
              role="status"
            >
              {isCelebrate ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 flex items-center justify-center rounded-full animate-confetti-pop" style={{ width: 32, height: 32, background: 'var(--shell-accent)' }}>
                      <Icon size={18} style={{ color: 'white' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{toast.celebrate!.title}</p>
                      {toast.celebrate!.subtitle && (
                        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{toast.celebrate!.subtitle}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(toast.id)}
                      className="shrink-0 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
                      aria-label="Fermer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {toast.celebrate!.stats && toast.celebrate!.stats.length > 0 && (
                    <div className="flex gap-4 pt-1">
                      {toast.celebrate!.stats.map((s) => (
                        <div key={s.label} className="text-center">
                          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{s.label}</p>
                          <p className="text-sm font-semibold" style={{ color: 'var(--shell-accent)' }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Icon size={18} className="shrink-0" />
                  <span className="max-w-xs">{toast.message}</span>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    className="ml-1 shrink-0 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
                    aria-label="Fermer"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
