'use client';

// Simple localStorage wrapper to persist mock forms/settings.
import { useEffect, useState } from 'react';

const PREFIX = 'lune-pro';

function mergeInitial<T>(initial: T, parsed: unknown): T {
  if (Array.isArray(initial)) {
    return (Array.isArray(parsed) ? parsed : initial) as T;
  }
  if (typeof initial === 'object' && initial !== null && typeof parsed === 'object' && parsed !== null) {
    return { ...(initial as Record<string, unknown>), ...(parsed as Record<string, unknown>) } as T;
  }
  return parsed as T;
}

export function usePersistentState<T>(key: string, initial: T) {
  const storageKey = `${PREFIX}:${key}`;
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setValue(mergeInitial(initial, parsed));
    } catch {
      // ignore invalid payloads
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = (next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(resolved));
        } catch {
          // ignore storage errors
        }
      }
      return resolved;
    });
  };

  return [value, persist] as const;
}
