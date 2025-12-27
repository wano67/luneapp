import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

export type ProjectListItem = {
  id: string;
  businessId: string;
  name: string;
  status: string;
  clientId: string | null;
  clientName: string | null;
  categoryReferenceId: string | null;
  categoryReferenceName: string | null;
  tagReferences: Array<{ id: string; name: string }>;
  startedAt: string | null;
  archivedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  amountCents?: number | string | null;
  createdAt: string;
  updatedAt: string;
  progress: number;
  tasksSummary?: { total: number; open: number; done: number; progressPct: number };
};

export type ProjectFilters = {
  status?: string;
  clientId?: string;
  archived?: 'true' | 'false';
  q?: string;
};

type HookState = {
  data: ProjectListItem[] | null;
  isLoading: boolean;
  error: string | null;
};

export function useProjects(businessId: string, filters: ProjectFilters) {
  const [state, setState] = useState<HookState>({ data: null, isLoading: true, error: null });
  const abortRef = useRef<AbortController | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.clientId) params.set('clientId', filters.clientId);
    if (filters.archived) params.set('archived', filters.archived);
    if (filters.q) params.set('q', filters.q);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [filters.archived, filters.clientId, filters.q, filters.status]);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetchJson<{ items: ProjectListItem[] }>(
        `/api/pro/businesses/${businessId}/projects${queryString}`,
        { method: 'GET' },
        controller.signal
      );
      if (!res.ok || !res.data) {
        setState({ data: null, isLoading: false, error: res.error ?? 'Impossible de charger les projets.' });
        return;
      }
      setState({ data: res.data.items, isLoading: false, error: null });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState({ data: null, isLoading: false, error: getErrorMessage(err) });
    }
  }, [businessId, queryString]);

  useEffect(() => {
    abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    refetch: load,
  };
}
