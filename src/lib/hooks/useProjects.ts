import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

export type ProjectListItem = {
  id: string;
  businessId: string;
  name: string;
  status: string;
  quoteStatus?: string | null;
  depositStatus?: string | null;
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

export type ProjectScope = 'ACTIVE' | 'PLANNED' | 'INACTIVE' | 'ALL';

export type ProjectFilters = {
  scope?: ProjectScope;
  clientId?: string;
  archived?: 'true' | 'false';
  q?: string;
};

export type ProjectCounts = {
  active: number;
  planned: number;
  inactive: number;
  archived: number;
  total: number;
  activeTasks?: { total: number; done: number };
};

type HookState = {
  data: ProjectListItem[] | null;
  counts: ProjectCounts | null;
  totalCount: number | null;
  isLoading: boolean;
  error: string | null;
};

export function useProjects(businessId: string, filters: ProjectFilters) {
  const [state, setState] = useState<HookState>({
    data: null,
    counts: null,
    totalCount: null,
    isLoading: true,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.scope) params.set('scope', filters.scope);
    if (filters.clientId) params.set('clientId', filters.clientId);
    if (filters.archived) params.set('archived', filters.archived);
    if (filters.q) params.set('q', filters.q);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [filters.archived, filters.clientId, filters.q, filters.scope]);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetchJson<{ items: ProjectListItem[]; counts?: ProjectCounts; totalCount?: number }>(
        `/api/pro/businesses/${businessId}/projects${queryString}`,
        { method: 'GET' },
        controller.signal
      );
      if (!res.ok || !res.data) {
        setState({
          data: null,
          counts: null,
          totalCount: null,
          isLoading: false,
          error: res.error ?? 'Impossible de charger les projets.',
        });
        return;
      }
      setState({
        data: res.data.items,
        counts: res.data.counts ?? null,
        totalCount: typeof res.data.totalCount === 'number' ? res.data.totalCount : null,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState({
        data: null,
        counts: null,
        totalCount: null,
        isLoading: false,
        error: getErrorMessage(err),
      });
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
    counts: state.counts,
    totalCount: state.totalCount,
    isLoading: state.isLoading,
    error: state.error,
    refetch: load,
  };
}
