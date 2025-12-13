'use client';

import React, { useEffect } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function Modal({ open, onClose, title, description, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // lock scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fermer"
      />

      {/* panel */}
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2">
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--background-alt)]/90 shadow-2xl backdrop-blur-md">
          <div className="relative px-6 py-5">
            <div className="pr-14">
              <h3 className="text-xl font-semibold">{title}</h3>
              {description ? (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
              ) : null}
            </div>

            {/* Close X (grosse, propre) */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
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

          <div className="border-t border-[var(--border)] px-6 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default Modal;
