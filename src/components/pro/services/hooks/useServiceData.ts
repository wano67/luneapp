'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import type { ServiceItem } from '../service-types';

type ReferenceOption = { id: string; name: string };

export function useServiceData(businessId: string) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [categoryOptions, setCategoryOptions] = useState<ReferenceOption[]>([]);
  const [tagOptions, setTagOptions] = useState<ReferenceOption[]>([]);

  const fetchController = useRef<AbortController | null>(null);

  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    services.forEach((s) => { if (s.type) values.add(s.type); });
    return Array.from(values);
  }, [services]);

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.trim().toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.type ?? '').toLowerCase().includes(q)
    );
  }, [services, search]);

  async function loadServices(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }
    try {
      setLoading(true);
      setError(null);
      setRequestId(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (categoryFilter) params.set('categoryReferenceId', categoryFilter);
      if (tagFilter) params.set('tagReferenceId', tagFilter);
      const qs = params.toString();
      const res = await fetchJson<{ items: ServiceItem[] }>(
        `/api/pro/businesses/${businessId}/services${qs ? `?${qs}` : ''}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setRequestId(res.requestId);
      if (res.status === 401) {
        window.location.href = `/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les services.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setServices([]);
        return;
      }
      setServices(
        res.data.items.map((item) => ({
          ...item,
          tagReferences: item.tagReferences ?? [],
          templateCount: item.templateCount ?? 0,
        }))
      );
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  async function loadReferenceOptions(signal?: AbortSignal) {
    try {
      const [catRes, tagRes] = await Promise.all([
        fetchJson<{ items: ReferenceOption[] }>(
          `/api/pro/businesses/${businessId}/references?type=CATEGORY`, {}, signal
        ),
        fetchJson<{ items: ReferenceOption[] }>(
          `/api/pro/businesses/${businessId}/references?type=TAG`, {}, signal
        ),
      ]);
      if (signal?.aborted) return;
      if (catRes.ok && catRes.data) setCategoryOptions(catRes.data.items);
      if (tagRes.ok && tagRes.data) setTagOptions(tagRes.data.items);
    } catch {
      // silently fail for reference options
    }
  }

  useEffect(() => {
    void loadServices();
    return () => { fetchController.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, typeFilter, categoryFilter, tagFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReferenceOptions(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  function updateTemplateCount(serviceId: string, count: number) {
    setServices((prev) => prev.map((s) => s.id === serviceId ? { ...s, templateCount: count } : s));
  }

  return {
    services,
    filtered,
    loading,
    error,
    requestId,
    info,
    setInfo,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    categoryFilter,
    setCategoryFilter,
    tagFilter,
    setTagFilter,
    categoryOptions,
    tagOptions,
    typeOptions,
    loadServices,
    updateTemplateCount,
  };
}
