'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useMemo, useCallback } from 'react';

/**
 * Synchronise des filtres avec les paramètres URL (?key=value).
 * - À l'initialisation, lit les valeurs depuis l'URL (ou utilise les defaults).
 * - `setFilter('key', 'val')` → router.replace (pas de nouvelle entrée historique).
 * - `resetFilters()` → supprime tous les filtres de l'URL.
 * - router.back() restaure naturellement l'URL précédente → filtres restaurés.
 */
export function useFilterParams<K extends string>(
  defaults: Record<K, string>,
): [Record<K, string>, (key: K, value: string) => void, () => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const keys = Object.keys(defaults) as K[];

  const values = useMemo(() => {
    const result = {} as Record<K, string>;
    for (const key of keys) {
      result[key] = searchParams?.get(key) ?? defaults[key];
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setFilter = useCallback(
    (key: K, value: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (value === '' || value === defaults[key]) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      const base = pathname ?? '/';
      router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, pathname, router],
  );

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    for (const key of keys) {
      params.delete(key);
    }
    const qs = params.toString();
    const base = pathname ?? '/';
    router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname, router]);

  return [values, setFilter, resetFilters];
}
