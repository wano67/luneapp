'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchJson } from '@/lib/apiClient';

export type UserPrefs = {
  language: string;
  theme: string;
  defaultCurrency: string;
  defaultTransactionType: string;
  defaultBudgetPeriod: string;
  defaultSubscriptionFrequency: string;
  dashboardPeriodDays: number;
  itemsPerPage: number;
};

const DEFAULTS: UserPrefs = {
  language: 'fr',
  theme: 'system',
  defaultCurrency: 'EUR',
  defaultTransactionType: 'EXPENSE',
  defaultBudgetPeriod: 'MONTHLY',
  defaultSubscriptionFrequency: 'MONTHLY',
  dashboardPeriodDays: 30,
  itemsPerPage: 50,
};

type UserPrefsCtx = {
  prefs: UserPrefs;
  loading: boolean;
  refresh: () => void;
};

const Ctx = createContext<UserPrefsCtx>({
  prefs: DEFAULTS,
  loading: true,
  refresh: () => {},
});

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const res = await fetchJson<UserPrefs>('/api/account/preferences', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok && res.data) {
        setPrefs({ ...DEFAULTS, ...res.data });
      }
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, [key]);

  function refresh() {
    setLoading(true);
    setKey((k) => k + 1);
  }

  return (
    <Ctx value={{ prefs, loading, refresh }}>
      {children}
    </Ctx>
  );
}

export function useUserPreferences(): UserPrefsCtx {
  return useContext(Ctx);
}
