// src/app/app/pro/ActiveBusinessProvider.tsx
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchJson } from '@/lib/apiClient';

export type ActiveBusiness = {
  id: string;
  name: string;
  role?: string | null;
  websiteUrl?: string | null;
};

type BusinessListItem = {
  business: {
    id: string;
    name: string;
    websiteUrl?: string | null;
  };
  role: string;
};

type BusinessesResponse = {
  items: BusinessListItem[];
};

type ActiveBusinessContextValue = {
  activeBusiness: ActiveBusiness | null;
  setActiveBusiness: (biz: ActiveBusiness | null) => void;
  switchOpen: boolean;
  openSwitchModal: () => void;
  closeSwitchModal: () => void;
  businesses: BusinessListItem[];
  loadingBusinesses: boolean;
  businessesError: string | null;
  refreshBusinesses: () => Promise<void>;
  isAdmin: boolean;
  isViewer: boolean;
};

const ActiveBusinessContext = createContext<ActiveBusinessContextValue | null>(null);

const ACTIVE_KEY = 'activeProBusinessId';
const LAST_KEY = 'lastProBusinessId';

export function useActiveBusiness(options?: { optional?: boolean }) {
  const ctx = useContext(ActiveBusinessContext);
  if (!ctx && !options?.optional) {
    throw new Error('useActiveBusiness must be used within ActiveBusinessProvider');
  }
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
  initialBusiness?: ActiveBusiness | null;
};

export function ActiveBusinessProvider({ children, initialBusiness }: ProviderProps) {
  const [activeBusiness, setActiveBusinessState] = useState<ActiveBusiness | null>(
    initialBusiness ?? null
  );
  const [switchOpen, setSwitchOpen] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessListItem[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [businessesError, setBusinessesError] = useState<string | null>(null);
  const loadController = useRef<AbortController | null>(null);

  // hydrate from localStorage on mount
  useEffect(() => {
    if (activeBusiness) return;
    try {
      const stored = localStorage.getItem(ACTIVE_KEY);
      if (stored) {
        setActiveBusinessState((prev) => prev ?? { id: stored, name: stored });
      }
    } catch {
      // ignore
    }
  }, [activeBusiness]);

  // keep localStorage in sync
  const persistIds = useCallback((biz: ActiveBusiness | null) => {
    if (typeof window === 'undefined') return;
    try {
      if (biz?.id) {
        localStorage.setItem(ACTIVE_KEY, biz.id);
        localStorage.setItem(LAST_KEY, biz.id);
      } else {
        localStorage.removeItem(ACTIVE_KEY);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  const setActiveBusiness = useCallback(
    (biz: ActiveBusiness | null) => {
      setActiveBusinessState(biz);
      persistIds(biz);
    },
    [persistIds]
  );

  useEffect(() => {
    if (!initialBusiness?.id) return;
    setActiveBusinessState((prev) => {
      if (
        prev?.id === initialBusiness.id &&
        prev?.name === initialBusiness.name &&
        prev?.role === initialBusiness.role &&
        prev?.websiteUrl === initialBusiness.websiteUrl
      ) {
        return prev;
      }
      persistIds(initialBusiness);
      return initialBusiness;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBusiness?.id, initialBusiness?.name, initialBusiness?.role, persistIds]);

  const refreshBusinesses = useCallback(async () => {
    const controller = new AbortController();
    loadController.current?.abort();
    loadController.current = controller;

    try {
      setLoadingBusinesses(true);
      setBusinessesError(null);

      const res = await fetchJson<BusinessesResponse>(
        '/api/pro/businesses',
        {},
        controller.signal
      );

      if (controller.signal.aborted) return;

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les entreprises.';
        setBusinessesError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setBusinesses([]);
        return;
      }

      setBusinesses(res.data.items);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      setBusinessesError('Impossible de charger les entreprises.');
    } finally {
      if (!controller.signal.aborted) setLoadingBusinesses(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      loadController.current?.abort();
    };
  }, []);

  const value: ActiveBusinessContextValue = useMemo(
    () => ({
      activeBusiness,
      setActiveBusiness,
      switchOpen,
      openSwitchModal: () => setSwitchOpen(true),
      closeSwitchModal: () => setSwitchOpen(false),
      businesses,
      loadingBusinesses,
      businessesError,
      refreshBusinesses,
      isAdmin: activeBusiness?.role === 'ADMIN' || activeBusiness?.role === 'OWNER',
      isViewer: !!activeBusiness,
    }),
    [
      activeBusiness,
      setActiveBusiness,
      switchOpen,
      businesses,
      loadingBusinesses,
      businessesError,
      refreshBusinesses,
    ]
  );

  return <ActiveBusinessContext.Provider value={value}>{children}</ActiveBusinessContext.Provider>;
}
