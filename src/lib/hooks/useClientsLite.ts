import { useEffect, useReducer, useRef } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

export type ClientLite = { id: string; name: string | null };

type State = { data: ClientLite[]; isLoading: boolean; error: string | null };
type Action =
  | { type: 'start' }
  | { type: 'success'; data: ClientLite[] }
  | { type: 'error'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return { ...state, isLoading: true, error: null };
    case 'success':
      return { data: action.data, isLoading: false, error: null };
    case 'error':
      return { ...state, isLoading: false, error: action.error };
    default:
      return state;
  }
}

export function useClientsLite(businessId: string, search: string) {
  const [state, dispatch] = useReducer(reducer, { data: [], isLoading: false, error: null });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    dispatch({ type: 'start' });
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    params.set('sortBy', 'name');
    params.set('sortDir', 'asc');
    void fetchJson<{ items: Array<{ id: string; name: string | null }> }>(
      `/api/pro/businesses/${businessId}/clients?${params.toString()}`,
      { method: 'GET' },
      controller.signal
    )
      .then((res) => {
        if (!res.ok || !res.data) {
          dispatch({ type: 'error', error: res.error ?? 'Impossible de charger les clients.' });
          return;
        }
        dispatch({ type: 'success', data: res.data.items });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'error', error: getErrorMessage(err) });
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        // noop, reducer already set loading=false on success/error
      });

    return () => {
      controller.abort();
    };
  }, [businessId, search]);

  return { data: state.data, isLoading: state.isLoading, error: state.error };
}
