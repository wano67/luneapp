import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';

type Props = { params: Promise<{ businessId: string; serviceId: string }> };

type ServiceDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string | null;
  defaultPriceCents: string | null;
  vatRate: number | null;
  billingType?: 'ONE_OFF' | 'RECURRING';
  recurrenceInterval?: string | null;
  recurrenceDayOfMonth?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export default async function ServiceDetailPage({ params }: Props) {
  const { businessId, serviceId } = await params;
  const res = await fetchJson<ServiceDetail>(`/api/pro/businesses/${businessId}/services/${serviceId}`);
  if (!res.ok || !res.data) return notFound();
  const svc = res.data;

  const price = svc.defaultPriceCents
    ? formatCurrencyEUR(Number(svc.defaultPriceCents), { minimumFractionDigits: 0 })
    : '—';
  const billing =
    svc.billingType === 'RECURRING'
      ? 'Abonnement'
      : 'Ponctuel';

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/app/pro/${businessId}/catalog`}>← Catalogue</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/app/pro/${businessId}/catalog?tab=services&editService=${serviceId}`}>Modifier</Link>
          </Button>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{svc.name}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Code: {svc.code} · {billing}
        </p>
      </div>

      <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Informations</p>
        <p className="text-sm text-[var(--text-secondary)]">{svc.description || 'Aucune description.'}</p>
        <p className="text-xs text-[var(--text-secondary)]">Type: {svc.type || '—'}</p>
        <p className="text-xs text-[var(--text-secondary)]">Créé le: {svc.createdAt ?? '—'}</p>
      </Card>

      <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Facturation</p>
        <p className="text-sm text-[var(--text-secondary)]">Prix: {price}</p>
        <p className="text-sm text-[var(--text-secondary)]">TVA: {svc.vatRate ?? '—'}%</p>
        {svc.billingType === 'RECURRING' ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Récurrence: {svc.recurrenceInterval ?? 'Mensuelle'} {svc.recurrenceDayOfMonth ? `· Jour ${svc.recurrenceDayOfMonth}` : ''}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
