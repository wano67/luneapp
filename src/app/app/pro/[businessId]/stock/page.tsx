// src/app/app/pro/[businessId]/stock/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { useRowSelection } from '../../../components/selection/useRowSelection';
import { BulkActionBar } from '../../../components/selection/BulkActionBar';

type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  salePriceCents: string | null;
  purchasePriceCents: string | null;
  isArchived: boolean;
  createdAt: string;
};

type SummaryRow = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  stock: number;
  onHand?: number;
  reserved?: number;
  available?: number;
  lastMovementAt: string | null;
};

const UNITS = ['PIECE', 'KG', 'HOUR', 'LITER', 'OTHER'];

export default function StockListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<Record<string, SummaryRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ sku: '', name: '', unit: 'PIECE', salePriceCents: '', purchasePriceCents: '' });
  const [actionError, setActionError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkInfo, setBulkInfo] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const { selectedArray, selectedCount, toggle, toggleAll, clear, isSelected } = useRowSelection();

  const active = useActiveBusiness({ optional: true });
  const businessId = active?.activeBusiness?.id;
  const role = active?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const sorted = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const load = useCallback(async () => {
    if (!businessId) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const [prodRes, summaryRes] = await Promise.all([
        fetchJson<{ items: Product[] }>(`/api/pro/businesses/${businessId}/products`, {}, controller.signal),
        fetchJson<{ items: SummaryRow[] }>(`/api/pro/businesses/${businessId}/inventory/summary`, {}, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      if (!prodRes.ok || !summaryRes.ok || !prodRes.data || !summaryRes.data) {
        const ref = prodRes.requestId ?? summaryRes.requestId;
        const msg = prodRes.error || summaryRes.error || 'Impossible de charger le stock.';
        setError(ref ? `${msg} (Ref: ${ref})` : msg);
        return;
      }
      setProducts(prodRes.data.items ?? []);
      setSummary(Object.fromEntries((summaryRes.data.items ?? []).map((r) => [r.productId, r])));
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  async function createProduct() {
    if (!businessId) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetchJson<{ product: Product }>(`/api/pro/businesses/${businessId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: draft.sku,
          name: draft.name,
          unit: draft.unit,
          salePriceCents: draft.salePriceCents ? Number(draft.salePriceCents) : undefined,
          purchasePriceCents: draft.purchasePriceCents ? Number(draft.purchasePriceCents) : undefined,
        }),
      });
      if (!res.ok || !res.data) {
        setActionError(
          res.requestId
            ? `${res.error ?? 'Création impossible'} (Ref: ${res.requestId})`
            : res.error ?? 'Création impossible'
        );
        return;
      }
      setModalOpen(false);
      setDraft({ sku: '', name: '', unit: 'PIECE', salePriceCents: '', purchasePriceCents: '' });
      await load();
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkDelete(ids: string[]) {
    if (!ids.length || !businessId) return;
    if (!isAdmin) {
      setActionError(readOnlyMessage);
      return;
    }
    const ok = window.confirm(ids.length === 1 ? 'Supprimer ce produit ?' : `Supprimer ${ids.length} produits ?`);
    if (!ok) return;
    setBulkLoading(true);
    setBulkError(null);
    setBulkInfo(null);
    let failed = 0;
    for (const id of ids) {
      const res = await fetchJson<null>(`/api/pro/businesses/${businessId}/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        failed += 1;
        setBulkError((prev) => prev ?? `Suppression partielle. Ref: ${res.requestId ?? 'N/A'}`);
      }
    }
    setBulkLoading(false);
    clear();
    await load();
    if (failed) {
      setBulkError((prev) => prev ?? 'Certaines suppressions ont échoué.');
    } else {
      setBulkInfo('Produits supprimés.');
    }
  }

  if (!businessId) {
    return <p className="text-sm text-[var(--text-secondary)]">Aucune entreprise active.</p>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Stock
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Catalogue produits & inventaire</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Suis les produits et leurs mouvements de stock.
        </p>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <Link href={`/app/pro/${businessId}/finances/ledger`} className="underline">
            Voir les écritures comptables
          </Link>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Produits</p>
            <p className="text-xs text-[var(--text-secondary)]">Liste des produits actifs et stock courant.</p>
          </div>
          <div className="flex items-center gap-2">
            {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}
            <Button size="sm" onClick={() => setModalOpen(true)}>
              Nouveau produit
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-500">{error}</p>
            <Button size="sm" variant="outline" onClick={() => load()}>
              Réessayer
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun produit.</p>
        ) : (
          <div className="space-y-3">
            {bulkInfo ? <p className="text-xs font-semibold text-emerald-500">{bulkInfo}</p> : null}
            {bulkError ? <p className="text-xs font-semibold text-rose-500">{bulkError}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={sorted.length > 0 && sorted.every((p) => isSelected(p.id))}
                  onChange={() => toggleAll(sorted.map((p) => p.id))}
                />
                Tout sélectionner
              </label>
              <BulkActionBar
                count={selectedCount}
                onClear={clear}
                actions={[
                  {
                    label: bulkLoading ? 'Suppression…' : 'Supprimer',
                    onClick: () => handleBulkDelete(selectedArray),
                    variant: 'danger',
                    disabled: !isAdmin || bulkLoading,
                  },
                ]}
              />
            </div>
            {sorted.map((p) => {
              const sum = summary[p.id];
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[var(--accent)]"
                      checked={isSelected(p.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggle(p.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Sélectionner"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {p.name} <span className="text-[var(--text-secondary)]">({p.sku})</span>
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Stock phys.: {sum?.onHand ?? sum?.stock ?? 0} · Réservé: {sum?.reserved ?? 0} · Dispo:{' '}
                        {sum?.available ?? (sum?.onHand ?? sum?.stock ?? 0) - (sum?.reserved ?? 0)} {p.unit.toLowerCase()}
                        {sum?.lastMovementAt ? ` · Dernier: ${new Date(sum.lastMovementAt).toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.isArchived ? <Badge variant="neutral">Archivé</Badge> : null}
                    <Link href={`/app/pro/${businessId}/stock/${p.id}`}>
                      <Button size="sm" variant="outline">
                        Ouvrir
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onCloseAction={saving ? () => {} : () => setModalOpen(false)}
        title="Nouveau produit"
        description="Crée un produit pour suivre son stock."
      >
        <div className="space-y-3">
          <label className="text-sm text-[var(--text-primary)]">
            <span className="block text-xs text-[var(--text-secondary)]">SKU</span>
            <Input value={draft.sku} onChange={(e) => setDraft((prev) => ({ ...prev, sku: e.target.value }))} />
          </label>
          <label className="text-sm text-[var(--text-primary)]">
            <span className="block text-xs text-[var(--text-secondary)]">Nom</span>
            <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
          </label>
          <label className="text-sm text-[var(--text-primary)]">
            <span className="block text-xs text-[var(--text-secondary)]">Unité</span>
            <Select
              value={draft.unit}
              onChange={(e) => setDraft((prev) => ({ ...prev, unit: e.target.value }))}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Prix de vente (cents)</span>
              <Input
                type="number"
                value={draft.salePriceCents}
                onChange={(e) => setDraft((prev) => ({ ...prev, salePriceCents: e.target.value }))}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Prix d&apos;achat (cents)</span>
              <Input
                type="number"
                value={draft.purchasePriceCents}
                onChange={(e) => setDraft((prev) => ({ ...prev, purchasePriceCents: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={createProduct} disabled={saving}>
              {saving ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
