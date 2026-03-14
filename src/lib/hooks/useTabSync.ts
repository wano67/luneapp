'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useMemo, useCallback } from 'react';

/**
 * Synchronise l'onglet actif avec le paramètre `?tab=` de l'URL.
 * Retourne [currentTab, setTab] — le setter fait un router.replace sans scroll.
 */
export function useTabSync<K extends string>(
  validKeys: readonly K[],
  defaultKey?: K,
): [K, (key: K) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const fallback = defaultKey ?? validKeys[0];

  const currentTab = useMemo(() => {
    const raw = searchParams?.get('tab') as K | null;
    return raw && (validKeys as readonly string[]).includes(raw) ? raw : fallback;
  }, [searchParams, validKeys, fallback]);

  const setTab = useCallback(
    (key: K) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (key === fallback) {
        params.delete('tab');
      } else {
        params.set('tab', key);
      }
      const qs = params.toString();
      const base = pathname ?? '/';
      router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
    },
    [searchParams, pathname, router, fallback],
  );

  return [currentTab, setTab];
}
