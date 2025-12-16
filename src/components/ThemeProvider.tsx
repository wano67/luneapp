'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { applyThemePref, readThemePrefFromDocument, type ThemePref } from '@/lib/theme';

type ThemeProviderProps = {
  children: ReactNode;
  initialPref?: ThemePref;
};

export function ThemeProvider({ children, initialPref }: ThemeProviderProps) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const pref = initialPref ?? readThemePrefFromDocument();
    cleanupRef.current = applyThemePref(pref);
    return () => {
      cleanupRef.current?.();
    };
  }, [initialPref]);

  return <>{children}</>;
}
