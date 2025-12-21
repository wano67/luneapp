// src/app/app/pro/[businessId]/stock/[productId]/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type Product = {
  id: string;
  businessId: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  salePriceCents: string | null;
  purchasePriceCents: string | null;
  isArchived: boolean;
  stock?: number | null;
};

type Movement = {
  id: string;
  type: string;
  source: string;
  quantity: number;
  unitCostCents: string | null;
  reason: string | null;
  date: string;
};

const UNITS = ['PIECE', 'KG', 'HOUR', 'LITER', 'OTHER'];
const TYPES = ['IN', 'OUT', 'ADJUST'];

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;
  const productId = (params?.productId ?? '') as string;
  const active = useActiveBusiness({ optional: true });
  const role = active?.activeBusiness?.role;
  const canEdit = role === 'OWNER' || role === 'ADMIN';

  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [movementDraft, setMovementDraft] = useState({
    type: 'IN',
    quantity: 1,
    unitCostCents: '',
    reason: '',
    createFinanceEntry: false,
  });
  const [savingMovement, setSavingMovement] = useState(false);
  const [productDraft, setProductDraft] = useState({
    name: '',
    sku: '',
    description: '',
    unit: 'PIECE',
    salePriceCents: '',
    purchasePriceCents: '',
  });
  const controllerRef = useRef<AbortController | null>(null);

  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [movements]
  );

  const load = useCallback(async () => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    try {
      setLoading(true);
      setError(null);

      const [prodRes, moveRes] = await Promise.all([
        fetchJson<{ product: Product }>(`/api/pro/businesses/${businessId}/products/${productId}`, {}, controller.signal),
        fetchJson<{ items: Movement[] }>(
          `/api/pro/businesses/${businessId}/products/${productId}/movements`,
          {},
          controller.signal
        ),
      ]);

      if (controller.signal.aborted) return;
      if (!prodRes.ok || !prodRes.data) {
        if (prodRes.status === 404) {
          router.replace(`/app/pro/${businessId}/stock`);
          return;
        }
        const ref = prodRes.requestId;
        setError(ref ? `${prodRes.error ?? 'Erreur produit'} (Ref: ${ref})` : prodRes.error ?? 'Erreur produit');
        return;
      }
      if (!moveRes.ok || !moveRes.data) {
        const ref = moveRes.requestId;
        setError(ref ? `${moveRes.error ?? 'Erreur mouvements'} (Ref: ${ref})` : moveRes.error ?? 'Erreur mouvements');
        setMovements([]);
      } else {
        setMovements(moveRes.data.items ?? []);
      }

      setProduct(prodRes.data.product);
      setProductDraft({
        name: prodRes.data.product.name,
        sku: prodRes.data.product.sku,
        description: prodRes.data.product.description ?? '',
        unit: prodRes.data.product.unit,
        salePriceCents: prodRes.data.product.salePriceCents ?? '',
        purchasePriceCents: prodRes.data.product.purchasePriceCents ?? '',
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [businessId, productId, router]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  async function saveMovement() {
    if (!product) return;
    setSavingMovement(true);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson<{ movement: Movement }>(
        `/api/pro/businesses/${businessId}/products/${product.id}/movements`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: movementDraft.type,
            quantity: movementDraft.quantity,
            unitCostCents: movementDraft.unitCostCents ? Number(movementDraft.unitCostCents) : undefined,
            reason: movementDraft.reason || null,
            createFinanceEntry: movementDraft.createFinanceEntry,
          }),
        }
      );
      if (!res.ok || !res.data) {
        setActionError(
          res.requestId
            ? `${res.error ?? 'Impossible de créer le mouvement.'} (Ref: ${res.requestId})`
            : res.error ?? 'Impossible de créer le mouvement.'
        );
        return;
      }
      setSuccess('Mouvement créé.');
      setMovementDraft({ type: 'IN', quantity: 1, unitCostCents: '', reason: '', createFinanceEntry: false });
      await load();
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err));
    } finally {
      setSavingMovement(false);
    }
  }

  async function saveProduct() {
    if (!product) return;
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson<{ product: Product }>(
        `/api/pro/businesses/${businessId}/products/${product.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: productDraft.name,
            sku: productDraft.sku,
            description: productDraft.description ?? null,
            unit: productDraft.unit,
            salePriceCents: productDraft.salePriceCents ? Number(productDraft.salePriceCents) : null,
            purchasePriceCents: productDraft.purchasePriceCents ? Number(productDraft.purchasePriceCents) : null,
          }),
        }
      );
      if (!res.ok || !res.data) {
        setActionError(
          res.requestId
            ? `${res.error ?? 'Impossible de mettre à jour le produit.'} (Ref: ${res.requestId})`
            : res.error ?? 'Impossible de mettre à jour le produit.'
        );
        return;
      }
      setProduct(res.data.product);
      setSuccess('Produit mis à jour.');
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err));
    }
  }

  if (!product) {
    return loading ? <p className="text-sm text-[var(--text-secondary)]">Chargement…</p> : <p className="text-sm text-rose-500">{error ?? 'Produit introuvable.'}</p>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Stock
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{product.name}</h1>
          <Badge variant="neutral">{product.sku}</Badge>
          {product.isArchived ? <Badge variant="neutral">Archivé</Badge> : null}
          <Link href={`/app/pro/${businessId}/stock`}>
            <Button size="sm" variant="outline">
              Retour liste
            </Button>
          </Link>
        </div>
        {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}
        {success ? <p className="text-xs text-emerald-500">{success}</p> : null}
        <p className="text-sm text-[var(--text-secondary)]">
          Stock courant: {product.stock ?? 0} {product.unit.toLowerCase()}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 space-y-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Produit</p>
          {canEdit ? (
            <div className="space-y-3">
              <label className="text-sm text-[var(--text-primary)]">
                <span className="block text-xs text-[var(--text-secondary)]">Nom</span>
                <Input value={productDraft.name} onChange={(e) => setProductDraft((prev) => ({ ...prev, name: e.target.value }))} />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="block text-xs text-[var(--text-secondary)]">SKU</span>
                <Input value={productDraft.sku} onChange={(e) => setProductDraft((prev) => ({ ...prev, sku: e.target.value }))} />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="block text-xs text-[var(--text-secondary)]">Description</span>
                <Input
                  value={productDraft.description}
                  onChange={(e) => setProductDraft((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="block text-xs text-[var(--text-secondary)]">Unité</span>
                <Select
                  value={productDraft.unit}
                  onChange={(e) => setProductDraft((prev) => ({ ...prev, unit: e.target.value }))}
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
                    value={productDraft.salePriceCents}
                    onChange={(e) => setProductDraft((prev) => ({ ...prev, salePriceCents: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="block text-xs text-[var(--text-secondary)]">Prix d&apos;achat (cents)</span>
                  <Input
                    type="number"
                    value={productDraft.purchasePriceCents}
                    onChange={(e) => setProductDraft((prev) => ({ ...prev, purchasePriceCents: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveProduct}>
                  Enregistrer
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Lecture seule.</p>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Nouveau mouvement</p>
            <Badge variant="neutral">{movementDraft.type}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Type</span>
              <Select
                value={movementDraft.type}
                onChange={(e) => setMovementDraft((prev) => ({ ...prev, type: e.target.value }))}
                disabled={!canEdit}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Quantité</span>
              <Input
                type="number"
                value={movementDraft.quantity}
                onChange={(e) =>
                  setMovementDraft((prev) => ({ ...prev, quantity: Number(e.target.value || 0) }))
                }
                disabled={!canEdit}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Coût unitaire (cents)</span>
              <Input
                type="number"
                value={movementDraft.unitCostCents}
                onChange={(e) => setMovementDraft((prev) => ({ ...prev, unitCostCents: e.target.value }))}
                disabled={!canEdit}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Créer écriture Finance ?</span>
              <Select
                value={movementDraft.createFinanceEntry ? '1' : '0'}
                onChange={(e) => setMovementDraft((prev) => ({ ...prev, createFinanceEntry: e.target.value === '1' }))}
                disabled={!canEdit}
              >
                <option value="0">Non</option>
                <option value="1">Oui</option>
              </Select>
            </label>
          </div>
          <label className="text-sm text-[var(--text-primary)]">
            <span className="block text-xs text-[var(--text-secondary)]">Raison</span>
            <Input
              value={movementDraft.reason}
              onChange={(e) => setMovementDraft((prev) => ({ ...prev, reason: e.target.value }))}
              disabled={!canEdit}
            />
          </label>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveMovement} disabled={!canEdit || savingMovement}>
              {savingMovement ? 'Enregistrement…' : 'Ajouter'}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Mouvements</p>
        {sortedMovements.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun mouvement.</p>
        ) : (
          <div className="space-y-2">
            {sortedMovements.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {m.type} · {m.quantity} {product.unit.toLowerCase()}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {new Date(m.date).toLocaleDateString('fr-FR')} · {m.source}
                    {m.reason ? ` · ${m.reason}` : ''}
                  </p>
                </div>
                {m.unitCostCents ? (
                  <Badge variant="neutral">Unit: {m.unitCostCents} cents</Badge>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
