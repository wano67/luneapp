"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchJson } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { formatCentsToEuroInput, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { TabsPills } from '@/components/pro/TabsPills';

type ProductDetail = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string | null;
  salePriceCents: string | null;
  purchasePriceCents?: string | null;
  isArchived: boolean;
};

type ProductForm = {
  sku: string;
  name: string;
  description: string;
  price: string;
  unit: string;
  purchasePrice: string;
};

type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
  mimeType?: string | null;
};

export function ProductDetailPage({ businessId, productId }: { businessId: string; productId: string }) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'media' | 'settings'>('overview');
  const [form, setForm] = useState<ProductForm>({
    sku: '',
    name: '',
    description: '',
    price: '',
    unit: 'PIECE',
    purchasePrice: '',
  });

  const [images, setImages] = useState<ProductImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchJson<{ item: ProductDetail }>(
      `/api/pro/businesses/${businessId}/products/${productId}`
    );
    setLoading(false);
    if (!res.ok || !res.data?.item) {
      setError(res.error ?? 'Produit introuvable.');
      return;
    }
    setProduct(res.data.item);
    setForm({
      sku: res.data.item.sku,
      name: res.data.item.name,
      description: res.data.item.description ?? '',
      price: formatCentsToEuroInput(res.data.item.salePriceCents),
      unit: res.data.item.unit ?? 'PIECE',
      purchasePrice: formatCentsToEuroInput(res.data.item.purchasePriceCents),
    });
  }, [businessId, productId]);

  const loadImages = useCallback(async () => {
    setImagesLoading(true);
    setImageError(null);
    const res = await fetchJson<{ items: ProductImage[] }>(
      `/api/pro/businesses/${businessId}/products/${productId}/images`
    );
    setImagesLoading(false);
    if (!res.ok || !res.data) {
      setImageError(res.error ?? 'Impossible de charger les médias.');
      return;
    }
    setImages(res.data.items);
    if (!selectedImageId && res.data.items.length > 0) {
      setSelectedImageId(res.data.items[0].id);
    }
  }, [businessId, productId, selectedImageId]);

  useEffect(() => {
    void loadProduct();
    void loadImages();
  }, [loadProduct, loadImages]);

  const saveProduct = async () => {
    if (!form.name.trim() || !form.sku.trim()) {
      setFormError('SKU et nom requis.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const salePriceCents = form.price.trim() ? parseEuroToCents(form.price) : null;
    const purchasePriceCents = form.purchasePrice.trim() ? parseEuroToCents(form.purchasePrice) : null;
    if (
      (form.price.trim() && !Number.isFinite(salePriceCents)) ||
      (form.purchasePrice.trim() && !Number.isFinite(purchasePriceCents))
    ) {
      setFormError('Prix invalide.');
      setSaving(false);
      return;
    }
    const res = await fetchJson(`/api/pro/businesses/${businessId}/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        salePriceCents: Number.isFinite(salePriceCents ?? NaN) ? (salePriceCents as number) : null,
        unit: form.unit || 'PIECE',
        purchasePriceCents: Number.isFinite(purchasePriceCents ?? NaN) ? (purchasePriceCents as number) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Enregistrement impossible.');
      return;
    }
    void loadProduct();
  };

  const price = product?.salePriceCents ? Number(product.salePriceCents) : null;
  const costValue = product?.purchasePriceCents ? Number(product.purchasePriceCents) : null;
  const margin = price != null && costValue != null ? price - costValue : null;
  const marginPct = useMemo(() => (margin != null && price ? Math.round((margin / price) * 100) : null), [margin, price]);
  const needsCompletion = !product?.description || images.length === 0 || costValue == null;

  const selectedImage = images.find((img) => img.id === selectedImageId) ?? images[0] ?? null;

  const moveImage = async (id: string, direction: -1 | 1) => {
    const idx = images.findIndex((img) => img.id === id);
    if (idx === -1) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= images.length) return;
    const reordered = [...images];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    await fetchJson(`/api/pro/businesses/${businessId}/products/${productId}/images/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: reordered.map((img) => img.id) }),
    });
    await loadImages();
  };

  const uploadImage = async (file: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    const res = await fetchJson(`/api/pro/businesses/${businessId}/products/${productId}/images`, {
      method: 'POST',
      body: formData,
    });
    setUploading(false);
    if (!res.ok) {
      setImageError(res.error ?? 'Upload impossible.');
      return;
    }
    await loadImages();
  };

  const deleteImage = async (id: string) => {
    await fetchJson(`/api/pro/businesses/${businessId}/products/${productId}/images/${id}`, { method: 'DELETE' });
    await loadImages();
    if (selectedImageId === id) {
      setSelectedImageId(images.filter((img) => img.id !== id)[0]?.id ?? null);
    }
  };

  const gallery = (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Galerie</p>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => uploadImage(e.target.files?.[0] ?? null)}
            disabled={uploading}
            data-testid="product-upload"
          />
          <Button size="sm" variant="outline" disabled={uploading}>
            {uploading ? 'Upload…' : 'Ajouter des photos'}
          </Button>
        </div>
      </div>
      {imagesLoading ? (
        <p className="text-sm text-[var(--text-secondary)]">Chargement des images…</p>
      ) : imageError ? (
        <p className="text-sm text-rose-500">{imageError}</p>
      ) : images.length === 0 ? (
        <div className="space-y-2 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]">
          <p>Aucune image. Ajoutez vos visuels produit.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedImage ? (
            <Card className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage.url} alt={selectedImage.alt ?? ''} className="h-64 w-full object-cover" />
            </Card>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((img, idx) => (
              <Card
                key={img.id}
                className={`group overflow-hidden border ${
                  img.id === selectedImageId ? 'border-[var(--border-strong)]' : 'border-[var(--border)]'
                }`}
              >
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => setSelectedImageId(img.id)}
                  aria-label={`Sélectionner image ${idx + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt ?? ''} className="h-24 w-full object-cover" />
                </button>
                <div className="flex items-center justify-between gap-1 px-2 py-1">
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => moveImage(img.id, -1)} disabled={idx === 0}>
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveImage(img.id, 1)}
                      disabled={idx === images.length - 1}
                    >
                      ↓
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => deleteImage(img.id)}>
                    Suppr.
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Card>
  );

  const infoCard = (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{product?.name}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            SKU: {product?.sku} · Unité: {product?.unit ?? '—'} · Statut: {product?.isArchived ? 'Archivé' : 'Actif'}
          </p>
        </div>
      </div>
      <div className="space-y-2 text-sm text-[var(--text-secondary)]">
        <p className="text-[var(--text-primary)]">Description</p>
        <p className="whitespace-pre-line">{product?.description || 'Aucune description.'}</p>
      </div>
      <div className="space-y-2 text-sm text-[var(--text-secondary)]">
        <p className="text-[var(--text-primary)]">Tarification</p>
        <p>Prix de vente : {price != null ? formatCurrencyEUR(price, { minimumFractionDigits: 0 }) : '—'}</p>
        <p>Coût : {costValue != null ? formatCurrencyEUR(costValue, { minimumFractionDigits: 0 }) : '—'}</p>
        <p>
          Marge : {margin != null ? formatCurrencyEUR(margin, { minimumFractionDigits: 0 }) : '—'}{' '}
          {marginPct != null ? `(${marginPct}%)` : ''}
        </p>
      </div>
      {needsCompletion ? (
        <Card className="border-dashed border-[var(--border)] bg-[var(--surface)]/60 p-3 text-sm text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">À compléter</p>
          <ul className="list-disc pl-4">
            {images.length === 0 ? <li>Ajouter des photos produit</li> : null}
            {!product?.description ? <li>Ajouter une description</li> : null}
            {costValue == null ? <li>Renseigner le coût</li> : null}
          </ul>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setActiveTab('settings')}>
              Mettre à jour
            </Button>
            {images.length === 0 ? (
              <Button size="sm" variant="outline" onClick={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()}>
                Importer des photos
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}
    </Card>
  );

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}/catalog?tab=products`}
      backLabel="Catalogue"
      title={product?.name ?? 'Produit'}
      subtitle={`${product?.sku ?? ''} · ${product?.unit ?? 'Unité'}`}
    >
      {loading ? (
        <Card className="p-4 text-sm text-[var(--text-secondary)]">Chargement…</Card>
      ) : error ? (
        <Card className="p-4 text-sm text-rose-500">{error}</Card>
      ) : (
        <div className="space-y-4">
          <KpiCirclesBlock
            items={[
              { label: 'Prix', value: price != null ? formatCurrencyEUR(price, { minimumFractionDigits: 0 }) : '—' },
              { label: 'Coût', value: costValue != null ? formatCurrencyEUR(costValue, { minimumFractionDigits: 0 }) : '—' },
              {
                label: 'Marge',
                value:
                  margin != null
                    ? `${formatCurrencyEUR(margin, { minimumFractionDigits: 0 })}${marginPct != null ? ` (${marginPct}%)` : ''}`
                    : '—',
              },
            ]}
          />
          <TabsPills
            items={[
              { key: 'overview', label: 'Vue d’ensemble' },
              { key: 'media', label: 'Médias' },
              { key: 'settings', label: 'Paramètres' },
            ]}
            value={activeTab}
            onChange={(key) => setActiveTab(key as typeof activeTab)}
          />
          {activeTab === 'overview' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {infoCard}
              <Card className="space-y-3 p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Tarification rapide</p>
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <p>Prix : {price != null ? formatCurrencyEUR(price) : '—'}</p>
                  <p>Coût : {costValue != null ? formatCurrencyEUR(costValue) : '—'}</p>
                  <p>Marge : {margin != null ? formatCurrencyEUR(margin) : '—'}</p>
                </div>
              </Card>
            </div>
          ) : null}
          {activeTab === 'media' ? gallery : null}
          {activeTab === 'settings' ? (
            <Card className="space-y-3 p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Paramètres produit</p>
              <Input label="SKU" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
              <Input label="Nom" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              <div className="space-y-1">
                <label className="text-sm text-[var(--text-secondary)]">Description</label>
                <textarea
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text-primary)]"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <Input
                label="Prix (€)"
                type="text"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: sanitizeEuroInput(e.target.value) }))}
              />
              <Input
                label="Coût (€)"
                type="text"
                inputMode="decimal"
                value={form.purchasePrice}
                onChange={(e) =>
                  setForm((p) => ({ ...p, purchasePrice: sanitizeEuroInput(e.target.value) }))
                }
              />
              <Input label="Unité" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
              {formError ? <p className="text-sm text-rose-500">{formError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => void loadProduct()}>
                  Réinitialiser
                </Button>
                <Button onClick={saveProduct} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </ProPageShell>
  );
}
