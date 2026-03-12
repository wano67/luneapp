'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function CookieConsent() {
  const mounted = useMounted();
  const [dismissed, setDismissed] = useState(false);

  if (!mounted || dismissed) return null;

  const accepted = localStorage.getItem('cookie_consent');
  if (accepted) return null;

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted');
    setDismissed(true);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t px-4 py-3 md:px-6 animate-fade-in-up"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Ce site utilise uniquement des cookies strictement n&eacute;cessaires au fonctionnement du service
          (authentification). Aucun cookie de tracking ou publicitaire n&apos;est utilis&eacute;.{' '}
          <Link href="/legal/privacy" className="underline hover:no-underline" style={{ color: 'var(--accent-strong)' }}>
            En savoir plus
          </Link>
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-lg px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--shell-accent)' }}
        >
          Compris
        </button>
      </div>
    </div>
  );
}
