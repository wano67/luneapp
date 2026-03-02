'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '@/lib/apiClient';
import { FigmaKpiCard, FigmaSectionTitle, FigmaListRow, FigmaStatusPill, FigmaEmpty, FigmaFooter, FIGMA } from '../../../figma-ui';

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  onHandQty?: number;
  reservedQty?: number;
  availableQty?: number;
  archivedAt?: string | null;
};

type InventorySummary = {
  totalProducts?: number;
  totalOnHand?: number;
  totalReserved?: number;
  totalAvailable?: number;
};

export default function StockPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    const ctrl = new AbortController();
    (async () => {
      const [pRes, sRes] = await Promise.all([
        fetchJson<{ items?: Product[] }>(`/api/pro/businesses/${businessId}/products`, {}, ctrl.signal),
        fetchJson<InventorySummary>(`/api/pro/businesses/${businessId}/inventory/summary`, {}, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (pRes.ok) setProducts(pRes.data?.items ?? []);
      if (sRes.ok) setSummary(sRes.data ?? null);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, [businessId]);

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>Stock</h1>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FigmaKpiCard label="Produits" value={loading ? '—' : String(summary?.totalProducts ?? products.length)} delay={0} />
        <FigmaKpiCard label="En stock" value={loading ? '—' : String(summary?.totalOnHand ?? 0)} delay={50} />
        <FigmaKpiCard label="Réservé" value={loading ? '—' : String(summary?.totalReserved ?? 0)} delay={100} />
        <FigmaKpiCard label="Disponible" value={loading ? '—' : String(summary?.totalAvailable ?? 0)} delay={150} />
      </div>

      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Produits ({products.length})</FigmaSectionTitle>
        {products.length === 0 && !loading && <FigmaEmpty message="Aucun produit en stock" />}
        {products.filter((p) => !p.archivedAt).map((p) => (
          <FigmaListRow
            key={p.id}
            left={p.name}
            sub={p.sku ?? undefined}
            right={
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 13, color: FIGMA.dark }}>
                  {p.availableQty ?? p.onHandQty ?? 0} dispo
                </span>
                <FigmaStatusPill
                  status={(p.availableQty ?? p.onHandQty ?? 0) > 0 ? 'success' : 'danger'}
                  label={(p.availableQty ?? p.onHandQty ?? 0) > 0 ? 'En stock' : 'Rupture'}
                />
              </div>
            }
          />
        ))}
      </div>

      <FigmaFooter />
    </div>
  );
}
