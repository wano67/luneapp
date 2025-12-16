'use client';

import React, { useEffect, useId, useRef } from 'react';
import { useBodyScrollLock } from '@/lib/scrollLock';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function Modal({ open, onClose, title, description, children }: ModalProps) {
  const baseId = useId();
  const titleId = `modal-title-${baseId}`;
  const descId = description ? `modal-desc-${baseId}` : undefined;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    lastActiveRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const focusFirst = () => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = root.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        focusable.focus();
      } else {
        root.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    focusFirst();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      lastActiveRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
      {/* overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fermer"
      />

      {/* panel */}
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 px-2"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div
          ref={panelRef}
          tabIndex={-1}
          className="flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--background-alt)]/90 shadow-2xl shadow-[var(--shadow-float)] backdrop-blur-md focus:outline-none"
        >
          {/* Header */}
          <div className="relative shrink-0 px-6 py-5">
            <div className="pr-14">
              <h3 id={titleId} className="text-xl font-semibold">
                {title}
              </h3>
              {description ? (
                <p id={descId} className="mt-1 text-sm text-[var(--text-secondary)]">
                  {description}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
              aria-label="Fermer la fenêtre"
              title="Fermer"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Body scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)] px-6 py-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

type ModalFooterStickyProps = {
  children: React.ReactNode;
};

export function ModalFooterSticky({ children }: ModalFooterStickyProps) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-6 px-6 pb-5 pt-3">
      {/* barre flottante centrée */}
      <div className="mx-auto w-fit rounded-2xl border border-[var(--border)] bg-[var(--background-alt)]/80 px-3 py-3 shadow-lg shadow-black/30 backdrop-blur-md">
        <div className="flex items-center justify-center gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
