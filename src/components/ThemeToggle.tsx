'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'lune-theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  // Init
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const preferred =
      stored ??
      (window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light');

    setTheme(preferred);
    applyTheme(preferred);
  }, []);

  // Appliquer le thème
  useEffect(() => {
    if (typeof window === 'undefined') return;
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function applyTheme(next: Theme) {
    const root = document.documentElement;
    if (next === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-secondary)] shadow-sm hover:bg-[var(--surface-hover)]"
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
          isDark ? 'bg-yellow-400/20' : 'bg-slate-900/10'
        }`}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
      <span>{isDark ? 'Sombre' : 'Clair'}</span>
    </button>
  );
}
