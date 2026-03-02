'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '@/lib/apiClient';
import { FigmaKpiCard, FigmaSectionTitle, FigmaListRow, FigmaStatusPill, FigmaEmpty, FigmaFooter, FIGMA } from '../../../figma-ui';

type Client = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  sector?: string | null;
  createdAt?: string;
};

export default function CrmPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    const ctrl = new AbortController();
    (async () => {
      const res = await fetchJson<{ items?: Client[] }>(`/api/pro/businesses/${businessId}/clients`, {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok) setClients(res.data?.items ?? []);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, [businessId]);

  const activeCount = clients.filter((c) => c.status === 'ACTIVE').length;
  const pausedCount = clients.filter((c) => c.status === 'PAUSED').length;

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>CRM</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FigmaKpiCard label="Total clients" value={loading ? '—' : String(clients.length)} delay={0} />
        <FigmaKpiCard label="Actifs" value={loading ? '—' : String(activeCount)} delay={50} />
        <FigmaKpiCard label="En pause" value={loading ? '—' : String(pausedCount)} delay={100} />
      </div>

      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Clients ({clients.length})</FigmaSectionTitle>
        {clients.length === 0 && !loading && <FigmaEmpty message="Aucun client" />}
        {clients.map((c) => (
          <FigmaListRow
            key={c.id}
            left={c.name}
            sub={[c.email, c.sector].filter(Boolean).join(' · ')}
            right={
              c.status ? (
                <FigmaStatusPill
                  status={c.status === 'ACTIVE' ? 'success' : c.status === 'PAUSED' ? 'warning' : 'neutral'}
                  label={c.status === 'ACTIVE' ? 'Actif' : c.status === 'PAUSED' ? 'Pause' : c.status === 'FORMER' ? 'Ancien' : c.status}
                />
              ) : undefined
            }
          />
        ))}
      </div>

      <FigmaFooter />
    </div>
  );
}
