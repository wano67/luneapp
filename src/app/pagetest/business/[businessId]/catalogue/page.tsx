'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '@/lib/apiClient';
import { FigmaKpiCard, FigmaSectionTitle, FigmaListRow, FigmaEmpty, FigmaFooter, FIGMA, fmtKpi } from '../../../figma-ui';

type Service = {
  id: string;
  name: string;
  description?: string | null;
  defaultPriceCents?: string | null;
  unit?: string | null;
};

export default function CataloguePage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    const ctrl = new AbortController();
    (async () => {
      const res = await fetchJson<{ items?: Service[] }>(`/api/pro/businesses/${businessId}/services`, {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok) setServices(res.data?.items ?? []);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, [businessId]);

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>Catalogue</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FigmaKpiCard label="Services" value={loading ? '—' : String(services.length)} delay={0} />
        <FigmaKpiCard
          label="Valeur moyenne"
          value={loading ? '—' : (() => {
            const priced = services.filter((s) => s.defaultPriceCents);
            if (priced.length === 0) return '—';
            const avg = priced.reduce((s, v) => s + Number(v.defaultPriceCents), 0) / priced.length;
            return fmtKpi(String(Math.round(avg)));
          })()}
          delay={50}
        />
      </div>

      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Services ({services.length})</FigmaSectionTitle>
        {services.length === 0 && !loading && <FigmaEmpty message="Aucun service au catalogue" />}
        {services.map((s) => (
          <FigmaListRow
            key={s.id}
            left={s.name}
            sub={s.description ?? undefined}
            right={
              s.defaultPriceCents ? (
                <span style={{ color: FIGMA.rose, fontWeight: 700, fontFamily: 'var(--font-roboto-mono), monospace', fontSize: 14 }}>
                  {fmtKpi(s.defaultPriceCents)}
                </span>
              ) : undefined
            }
          />
        ))}
      </div>

      <FigmaFooter />
    </div>
  );
}
