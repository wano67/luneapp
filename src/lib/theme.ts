export type ThemePref = 'light' | 'dark' | 'system';

export function getThemePrefFromCookieValue(value?: string | null): ThemePref {
  if (value === 'dark' || value === 'light' || value === 'system') return value;
  return 'system';
}

export function getThemePrefFromCookieHeader(cookieHeader?: string | null): ThemePref {
  if (!cookieHeader) return 'system';
  const match = cookieHeader.match(/(?:^|;\s*)pref_theme=([^;]+)/);
  if (!match) return 'system';
  try {
    return getThemePrefFromCookieValue(decodeURIComponent(match[1]));
  } catch {
    return 'system';
  }
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return pref;
}

export function applyThemePref(pref: ThemePref): () => void {
  const root = document.documentElement;
  const apply = (mode: 'light' | 'dark') => {
    root.setAttribute('data-theme', mode);
  };

  if (pref === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches ? 'dark' : 'light');
    const listener = (event: MediaQueryListEvent) => apply(event.matches ? 'dark' : 'light');
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }

  apply(pref);
  return () => {};
}

export function readThemePrefFromDocument(): ThemePref {
  if (typeof document === 'undefined') return 'system';
  const match = document.cookie.match(/(?:^|;\s*)pref_theme=([^;]+)/);
  if (match) {
    try {
      return getThemePrefFromCookieValue(decodeURIComponent(match[1]));
    } catch {
      return 'system';
    }
  }
  return 'system';
}
