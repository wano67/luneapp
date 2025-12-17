'use client';

import React, { useEffect, useId, useRef } from 'react';
import { useBodyScrollLock } from '@/lib/scrollLock';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onCloseAction: () => void;
};

function getFocusableElements(root: HTMLElement | null) {
  if (!root) return [];
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    )
  );
  return nodes.filter((el) => {
    const isDisabled = (el as HTMLButtonElement | HTMLInputElement).disabled;
    const hidden = el.getAttribute('aria-hidden') === 'true';
    const displayNone = el.offsetParent === null && el.getClientRects().length === 0;
    return !isDisabled && !hidden && !displayNone;
  });
}

export function Modal({ open, onCloseAction, title, description, children }: ModalProps) {
  const baseId = useId();
  const titleId = `modal-title-${baseId}`;
  const descId = description ? `modal-desc-${baseId}` : undefined;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    closeRef.current = onCloseAction;
  }, [onCloseAction]);

  function requestClose() {
    closeRef.current?.();
  }

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const parent = container?.parentElement;
    if (!parent) return;

    const siblings = Array.from(parent.children).filter((el) => el !== container) as HTMLElement[];
    const previous = siblings.map((el) => ({
      el,
      ariaHidden: el.getAttribute('aria-hidden'),
      hadInert: el.hasAttribute('inert'),
    }));

    siblings.forEach((el) => {
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
      (el as HTMLElement & { inert?: boolean }).inert = true;
    });

    return () => {
      previous.forEach(({ el, ariaHidden, hadInert }) => {
        if (ariaHidden === null) {
          el.removeAttribute('aria-hidden');
        } else {
          el.setAttribute('aria-hidden', ariaHidden);
        }
        if (hadInert) {
          el.setAttribute('inert', '');
          (el as HTMLElement & { inert?: boolean }).inert = true;
        } else {
          el.removeAttribute('inert');
          (el as HTMLElement & { inert?: boolean }).inert = false;
        }
      });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    lastActiveRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };

    const focusFirst = () => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = getFocusableElements(root);
      if (focusable[0]) {
        focusable[0].focus();
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
  }, [open]);

  if (!open) return null;

  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    requestClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const root = panelRef.current;
    const focusables = getFocusableElements(root);

    if (!root) return;
    if (focusables.length === 0) {
      e.preventDefault();
      root.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const isShift = e.shiftKey;

    const isOutside = active ? !root.contains(active) : true;
    if (isOutside) {
      e.preventDefault();
      (isShift ? last : first).focus();
      return;
    }

    if (!isShift && active === last) {
      e.preventDefault();
      first.focus();
      return;
    }

    if (isShift && active === first) {
      e.preventDefault();
      last.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      {/* overlay */}
      <div
        role="presentation"
        aria-hidden="true"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onPointerDown={handleOverlayPointerDown}
        onClick={handleOverlayPointerDown}
      />

      {/* panel */}
      <div
        className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 px-2"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          ref={panelRef}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          tabIndex={-1}
          className="flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-2xl shadow-[var(--shadow-float)] backdrop-blur-md focus:outline-none"
        >
          {/* Header */}
          <div className="relative shrink-0 border-b border-[var(--border)] px-6 py-5">
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
              onClick={requestClose}
              className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
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
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
