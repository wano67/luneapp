import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';

type Props = { params: Promise<{ businessId: string; productId: string }> };

type ProductDetail = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string | null;
  salePriceCents: string | null;
  purchasePriceCents?: string | null;
  isArchived: boolean;
  createdAt?: string;
};

export default async function ProductDetailPage({ params }: Props) {
  const { businessId, productId } = await params;
  const res = await fetchJson<{ product: ProductDetail }>(
    `/api/pro/businesses/${businessId}/products/${productId}`
  );
  if (!res.ok || !res.data || !res.data.product) return notFound();
  const p = res.data.product;
  const price = p.salePriceCents
    ? formatCurrencyEUR(Number(p.salePriceCents), { minimumFractionDigits: 0 })
    : '—';

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/app/pro/${businessId}/catalog`}>← Catalogue</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/app/pro/${businessId}/catalog?tab=products&editProduct=${productId}`}>Modifier</Link>
          </Button>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{p.name}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          SKU: {p.sku} · {p.unit ?? 'Unité'}
        </p>
      </div>

      <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Informations</p>
        <p className="text-sm text-[var(--text-secondary)]">{p.description || 'Aucune description.'}</p>
        <p className="text-xs text-[var(--text-secondary)]">Statut: {p.isArchived ? 'Archivé' : 'Actif'}</p>
      </Card>

      <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Tarification</p>
        <p className="text-sm text-[var(--text-secondary)]">Prix de vente: {price}</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Prix d’achat: {p.purchasePriceCents ? formatCurrencyEUR(Number(p.purchasePriceCents), { minimumFractionDigits: 0 }) : '—'}
        </p>
      </Card>
    </div>
  );
}
