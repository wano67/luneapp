'use client';

import { useEffect } from 'react';

const SUFFIX = ' • Pivot';

/**
 * Met à jour le titre de l'onglet navigateur.
 * Restaure le titre par défaut au démontage.
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = title + SUFFIX;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
