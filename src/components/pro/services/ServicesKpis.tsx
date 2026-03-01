'use client';

import { Card } from '@/components/ui/card';
import type { ServiceItem } from './service-types';

function formatMoney(cents: number) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} €`;
  }
}

type Props = {
  services: ServiceItem[];
};

export function ServicesKpis({ services }: Props) {
  const activeCount = services.length;
  const totalTemplates = services.reduce((sum, s) => sum + (s.templateCount ?? 0), 0);

  // Average margin: only services with both price and cost
  const withMargin = services.filter(
    (s) => s.defaultPriceCents && s.costCents && Number(s.defaultPriceCents) > 0
  );
  let avgMargin: number | null = null;
  if (withMargin.length > 0) {
    const totalMargin = withMargin.reduce((sum, s) => {
      const price = Number(s.defaultPriceCents);
      const cost = Number(s.costCents);
      return sum + ((price - cost) / price) * 100;
    }, 0);
    avgMargin = Math.round(totalMargin / withMargin.length);
  }

  // Average price
  const withPrice = services.filter((s) => s.defaultPriceCents && Number(s.defaultPriceCents) > 0);
  const avgPrice = withPrice.length > 0
    ? withPrice.reduce((sum, s) => sum + Number(s.defaultPriceCents), 0) / withPrice.length
    : 0;

  const kpis = [
    { label: 'Services', value: String(activeCount) },
    { label: 'Prix moyen', value: avgPrice > 0 ? formatMoney(avgPrice) : '—' },
    { label: 'Marge moy.', value: avgMargin !== null ? `${avgMargin}%` : '—' },
    { label: 'Templates', value: String(totalTemplates) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          className="flex flex-col items-center justify-center gap-1 border border-[var(--border)] bg-[var(--surface)] p-4 text-center"
        >
          <span className="text-xl font-bold text-[var(--text-primary)]">{kpi.value}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">
            {kpi.label}
          </span>
        </Card>
      ))}
    </div>
  );
}
