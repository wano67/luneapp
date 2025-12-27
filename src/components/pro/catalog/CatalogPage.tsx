"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { TabsPills } from '@/components/pro/TabsPills';
import { fetchJson } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';

type Service = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  type: string | null;
  defaultPriceCents: string | null;
  vatRate: number | null;
  createdAt?: string;
  updatedAt?: string;
  isArchived?: boolean;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string | null;
  salePriceCents: string | null;
  isArchived: boolean;
};

type ItemKind = 'services' | 'products';

type ServiceForm = {
  id?: string | null;
  code: string;
  name: string;
  description: string;
  price: string;
  vatRate: string;
  type: string;
};

type ProductForm = {
  id?: string | null;
  sku: string;
  name: string;
  description: string;
  price: string;
  unit: string;
};

export function CatalogPage({ businessId }: { businessId: string }) {
  const [tab, setTab] = useState<ItemKind>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    code: '',
    name: '',
    description: '',
    price: '',
    vatRate: '',
    type: '',
  });
  const [productForm, setProductForm] = useState<ProductForm>({
    sku: '',
    name: '',
    description: '',
    price: '',
    unit: 'PIECE',
  });

  const fetchServices = useCallback(
    async (q?: string) => {
      const qs = q ? `?q=${encodeURIComponent(q)}` : '';
      const res = await fetchJson<{ items: Service[] }>(`/api/pro/businesses/${businessId}/services${qs}`);
      if (res.ok && res.data) setServices(res.data.items);
      else if (!res.ok) setError(res.error ?? 'Impossible de charger les services.');
    },
    [businessId]
  );

  const fetchProducts = useCallback(async () => {
    const res = await fetchJson<{ items: Product[] }>(`/api/pro/businesses/${businessId}/products`);
    if (res.ok && res.data) setProducts(res.data.items);
    else if (!res.ok) setError(res.error ?? 'Impossible de charger les produits.');
  }, [businessId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      await Promise.all([fetchServices(), fetchProducts()]);
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchProducts, fetchServices]);

  const kpis = useMemo(() => {
    const serviceCount = services.length;
    const productCount = products.length;
    const activeCount = serviceCount + productCount;
    return [
      { label: 'Services', value: serviceCount },
      { label: 'Produits', value: productCount },
      { label: 'Actifs', value: activeCount },
    ];
  }, [services.length, products.length]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [search, services]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [search, products]);

  const openCreate = () => {
    setModalError(null);
    if (tab === 'services') {
      setServiceForm({
        code: `SER-${Date.now()}`,
        name: '',
        description: '',
        price: '',
        vatRate: '',
        type: '',
      });
    } else {
      setProductForm({
        sku: `PRD-${Date.now()}`,
        name: '',
        description: '',
        price: '',
        unit: 'PIECE',
      });
    }
    setModalOpen(true);
  };

  const openEditService = (svc: Service) => {
    setServiceForm({
      id: svc.id,
      code: svc.code,
      name: svc.name,
      description: svc.description ?? '',
      price: svc.defaultPriceCents ? String(Number(svc.defaultPriceCents)) : '',
      vatRate: svc.vatRate ? String(svc.vatRate) : '',
      type: svc.type ?? '',
    });
    setTab('services');
    setModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setProductForm({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description ?? '',
      price: p.salePriceCents ? String(Number(p.salePriceCents)) : '',
      unit: p.unit ?? 'PIECE',
    });
    setTab('products');
    setModalOpen(true);
  };

  async function saveService() {
    if (!serviceForm.name.trim() || !serviceForm.code.trim()) {
      setModalError('Code et nom sont requis.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const body = {
      code: serviceForm.code.trim(),
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      defaultPriceCents: serviceForm.price ? Number(serviceForm.price) : null,
      vatRate: serviceForm.vatRate ? Number(serviceForm.vatRate) : null,
      type: serviceForm.type.trim() || null,
    };
    const url = serviceForm.id
      ? `/api/pro/businesses/${businessId}/services/${serviceForm.id}`
      : `/api/pro/businesses/${businessId}/services`;
    const method = serviceForm.id ? 'PATCH' : 'POST';
    const res = await fetchJson(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Enregistrement impossible.');
      return;
    }
    await fetchServices();
    setModalOpen(false);
  }

  async function saveProduct() {
    if (!productForm.name.trim() || !productForm.sku.trim()) {
      setModalError('SKU et nom sont requis.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const body = {
      sku: productForm.sku.trim(),
      name: productForm.name.trim(),
      description: productForm.description.trim() || null,
      salePriceCents: productForm.price ? Number(productForm.price) : null,
      unit: productForm.unit || 'PIECE',
    };
    const url = productForm.id
      ? `/api/pro/businesses/${businessId}/products/${productForm.id}`
      : `/api/pro/businesses/${businessId}/products`;
    const method = productForm.id ? 'PATCH' : 'POST';
    const res = await fetchJson(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Enregistrement impossible.');
      return;
    }
    await fetchProducts();
    setModalOpen(false);
  }

  const renderServiceCard = (svc: Service) => {
    const price = svc.defaultPriceCents ? formatCurrencyEUR(Number(svc.defaultPriceCents), { minimumFractionDigits: 0 }) : '—';
    return (
      <Card
        key={svc.id}
        className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{svc.name}</p>
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{svc.description || 'Pas de description.'}</p>
        </div>
        <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
          <p>{price} {svc.type ? `· ${svc.type}` : ''}</p>
          <p>TVA: {svc.vatRate ?? '—'}%</p>
          <p>Code: {svc.code}</p>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => openEditService(svc)}>
            Modifier
          </Button>
        </div>
      </Card>
    );
  };

  const renderProductCard = (p: Product) => {
    const price = p.salePriceCents ? formatCurrencyEUR(Number(p.salePriceCents), { minimumFractionDigits: 0 }) : '—';
    return (
      <Card
        key={p.id}
        className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{p.name}</p>
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{p.description || 'Pas de description.'}</p>
        </div>
        <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
          <p>{price} {p.unit ? `· ${p.unit}` : ''}</p>
          <p>SKU: {p.sku}</p>
          <p>Statut: {p.isArchived ? 'Archivé' : 'Actif'}</p>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => openEditProduct(p)}>
            Modifier
          </Button>
        </div>
      </Card>
    );
  };

  const list = tab === 'services' ? filteredServices : filteredProducts;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/app/pro/${businessId}`}>
              <ArrowLeft size={16} />
              Dashboard
            </Link>
          </Button>
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus size={16} />
            Nouveau
          </Button>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Catalogue</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Services et produits utilisés pour vos projets et votre facturation.
        </p>
      </div>

      <KpiCirclesBlock items={kpis} />

      <TabsPills
        items={[
          { key: 'services', label: 'Services' },
          { key: 'products', label: 'Produits' },
        ]}
        value={tab}
        onChange={(key) => setTab(key as ItemKind)}
        ariaLabel="Onglets catalogue"
        className="-mx-1 px-1"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      </div>

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        </Card>
      ) : list.length === 0 ? (
        <Card className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Aucun élément.</p>
          <Button size="sm" onClick={openCreate}>
            Créer {tab === 'services' ? 'un service' : 'un produit'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tab === 'services'
            ? filteredServices.map(renderServiceCard)
            : filteredProducts.map(renderProductCard)}
        </div>
      )}

      <Modal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        title={tab === 'services' ? (serviceForm.id ? 'Modifier le service' : 'Nouveau service') : productForm.id ? 'Modifier le produit' : 'Nouveau produit'}
      >
        <div className="space-y-3">
          {tab === 'services' ? (
            <>
              <Input
                label="Code"
                value={serviceForm.code}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, code: e.target.value }))}
              />
              <Input
                label="Nom"
                value={serviceForm.name}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                label="Description"
                value={serviceForm.description}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <Input
                label="Prix (cents)"
                type="number"
                value={serviceForm.price}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
              />
              <Input
                label="TVA (%)"
                type="number"
                value={serviceForm.vatRate}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, vatRate: e.target.value }))}
              />
              <Input
                label="Type"
                value={serviceForm.type}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, type: e.target.value }))}
              />
            </>
          ) : (
            <>
              <Input
                label="SKU"
                value={productForm.sku}
                onChange={(e) => setProductForm((prev) => ({ ...prev, sku: e.target.value }))}
              />
              <Input
                label="Nom"
                value={productForm.name}
                onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                label="Description"
                value={productForm.description}
                onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <Input
                label="Prix de vente (cents)"
                type="number"
                value={productForm.price}
                onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
              />
              <Input
                label="Unité"
                value={productForm.unit}
                onChange={(e) => setProductForm((prev) => ({ ...prev, unit: e.target.value }))}
              />
            </>
          )}
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={tab === 'services' ? saveService : saveProduct} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
