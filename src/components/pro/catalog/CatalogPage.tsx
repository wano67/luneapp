"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { fetchJson } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { formatCentsToEuroInput, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';

type Service = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  type: string | null;
  billingType?: 'ONE_OFF' | 'RECURRING';
  recurrenceInterval?: string | null;
  recurrenceDayOfMonth?: number | null;
  defaultPriceCents: string | null;
  vatRate: number | null;
  createdAt?: string;
  updatedAt?: string;
  isArchived?: boolean;
  templateCount?: number;
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
  billingType: 'ONE_OFF' | 'RECURRING';
  recurrenceInterval: string;
  recurrenceDayOfMonth: string;
};

type ProductForm = {
  id?: string | null;
  sku: string;
  name: string;
  description: string;
  price: string;
  unit: string;
};

export function CatalogPage({
  businessId,
  initialTab,
}: {
  businessId: string;
  initialTab?: ItemKind;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [tab, setTab] = useState<ItemKind>(initialTab ?? 'services');
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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
    billingType: 'ONE_OFF',
    recurrenceInterval: 'MONTH',
    recurrenceDayOfMonth: '',
  });
  const [productForm, setProductForm] = useState<ProductForm>({
    sku: '',
    name: '',
    description: '',
    price: '',
    unit: 'PIECE',
  });
  const handledEditRef = useRef<{ service?: string; product?: string }>({});

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
    const q = searchTerm.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [searchTerm, services]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [searchTerm, products]);

  useEffect(() => {
    const handle = setTimeout(() => setSearchTerm(search), 250);
    return () => clearTimeout(handle);
  }, [search]);

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
        billingType: 'ONE_OFF',
        recurrenceInterval: 'MONTH',
        recurrenceDayOfMonth: '',
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

  const openEditService = useCallback((svc: Service) => {
    setServiceForm({
      id: svc.id,
      code: svc.code,
      name: svc.name,
      description: svc.description ?? '',
      price: formatCentsToEuroInput(svc.defaultPriceCents),
      vatRate: svc.vatRate ? String(svc.vatRate) : '',
      type: svc.type ?? '',
      billingType: svc.billingType ?? 'ONE_OFF',
      recurrenceInterval: svc.recurrenceInterval ?? 'MONTH',
      recurrenceDayOfMonth: svc.recurrenceDayOfMonth ? String(svc.recurrenceDayOfMonth) : '',
    });
    setTab('services');
    setModalOpen(true);
  }, []);

  const openEditProduct = useCallback((p: Product) => {
    setProductForm({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description ?? '',
      price: formatCentsToEuroInput(p.salePriceCents),
      unit: p.unit ?? 'PIECE',
    });
    setTab('products');
    setModalOpen(true);
  }, []);


  async function saveService() {
    if (!serviceForm.name.trim() || !serviceForm.code.trim()) {
      setModalError('Code et nom sont requis.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const priceCents = serviceForm.price.trim() ? parseEuroToCents(serviceForm.price) : null;
    if (serviceForm.price.trim() && !Number.isFinite(priceCents)) {
      setModalError('Prix invalide.');
      setSaving(false);
      return;
    }
    const body = {
      code: serviceForm.code.trim(),
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      defaultPriceCents: Number.isFinite(priceCents ?? NaN) ? (priceCents as number) : null,
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
    const priceCents = productForm.price.trim() ? parseEuroToCents(productForm.price) : null;
    if (productForm.price.trim() && !Number.isFinite(priceCents)) {
      setModalError('Prix invalide.');
      setSaving(false);
      return;
    }
    const body = {
      sku: productForm.sku.trim(),
      name: productForm.name.trim(),
      description: productForm.description.trim() || null,
      salePriceCents: Number.isFinite(priceCents ?? NaN) ? (priceCents as number) : null,
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
    const billing = svc.billingType === 'RECURRING' ? 'Abonnement mensuel' : 'Ponctuel';
    return (
      <Link key={svc.id} href={`/app/pro/${businessId}/catalog/services/${svc.id}`} className="block">
        <Card className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{svc.name}</p>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{svc.description || 'Pas de description.'}</p>
            </div>
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
              {billing}
            </span>
          </div>
          <div className="space-y-1 text-xs text-[var(--text-secondary)]">
            <p>
              {price} {svc.type ? `· ${svc.type}` : ''}
            </p>
            <p>TVA: {svc.vatRate ?? '—'}%</p>
            <p>Code: {svc.code}</p>
            <p>Templates: {svc.templateCount ?? 0}</p>
            <p>Statut: {svc.isArchived ? 'Archivé' : 'Actif'}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); openEditService(svc); }}>
              Modifier
            </Button>
          </div>
        </Card>
      </Link>
    );
  };

  const renderProductCard = (p: Product) => {
    const price = p.salePriceCents ? formatCurrencyEUR(Number(p.salePriceCents), { minimumFractionDigits: 0 }) : '—';
    return (
      <Link key={p.id} href={`/app/pro/${businessId}/catalog/products/${p.id}`} className="block">
        <Card className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-sm">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{p.name}</p>
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{p.description || 'Pas de description.'}</p>
          </div>
          <div className="space-y-1 text-xs text-[var(--text-secondary)]">
            <p>
              {price} {p.unit ? `· ${p.unit}` : ''}
            </p>
            <p>SKU: {p.sku}</p>
            <p>Statut: {p.isArchived ? 'Archivé' : 'Actif'}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); openEditProduct(p); }}>
              Modifier
            </Button>
          </div>
        </Card>
      </Link>
    );
  };

  const list = tab === 'services' ? filteredServices : filteredProducts;

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'services' || tabParam === 'products') setTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    const editServiceId = searchParams?.get('editService');
    const editProductId = searchParams?.get('editProduct');
    if (editServiceId && handledEditRef.current.service !== editServiceId) {
      const svc = services.find((s) => s.id === editServiceId);
      if (svc) {
        openEditService(svc);
        handledEditRef.current.service = editServiceId;
      }
    }
    if (editProductId && handledEditRef.current.product !== editProductId) {
      const prod = products.find((p) => p.id === editProductId);
      if (prod) {
        openEditProduct(prod);
        handledEditRef.current.product = editProductId;
      }
    }
  }, [openEditProduct, openEditService, products, searchParams, services]);

  const handleTabChange = (key: string) => {
    if (key !== 'services' && key !== 'products') return;
    setTab(key);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Catalogue"
      subtitle="Services et produits utilisés pour vos projets et factures."
      actions={
        <Button size="sm" className="gap-2" onClick={openCreate} data-testid="catalog-new">
          <Plus size={16} />
          Nouveau
        </Button>
      }
      tabs={[
        { key: 'services', label: 'Services' },
        { key: 'products', label: 'Produits' },
      ]}
      activeTab={tab}
      onTabChange={handleTabChange}
    >
      <div className="space-y-4">
        <KpiCirclesBlock items={kpis} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
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
      </div>

      <Modal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        title={
          tab === 'services'
            ? serviceForm.id
              ? 'Modifier le service'
              : 'Nouveau service'
            : productForm.id
              ? 'Modifier le produit'
              : 'Nouveau produit'
        }
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
                label="Prix (€)"
                type="text"
                inputMode="decimal"
                value={serviceForm.price}
                onChange={(e) =>
                  setServiceForm((prev) => ({ ...prev, price: sanitizeEuroInput(e.target.value) }))
                }
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
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
                  Billing type
                  <select
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    value={serviceForm.billingType}
                    onChange={(e) =>
                      setServiceForm((prev) => ({ ...prev, billingType: e.target.value as ServiceForm['billingType'] }))
                    }
                  >
                    <option value="ONE_OFF">Ponctuel</option>
                    <option value="RECURRING">Abonnement</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
                  Intervalle
                  <select
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    value={serviceForm.recurrenceInterval}
                    onChange={(e) => setServiceForm((prev) => ({ ...prev, recurrenceInterval: e.target.value }))}
                    disabled={serviceForm.billingType !== 'RECURRING'}
                  >
                    <option value="MONTH">Mensuel</option>
                  </select>
                </label>
              </div>
              {serviceForm.billingType === 'RECURRING' ? (
                <Input
                  label="Jour du mois (1-28)"
                  type="number"
                  min={1}
                  max={28}
                  value={serviceForm.recurrenceDayOfMonth}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, recurrenceDayOfMonth: e.target.value }))}
                />
              ) : null}
              <p className="text-xs text-[var(--text-secondary)]">
                Les paramètres d’abonnement sont affichés à titre informatif et envoyés uniquement si l’API les accepte.
              </p>
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
                label="Prix de vente (€)"
                type="text"
                inputMode="decimal"
                value={productForm.price}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, price: sanitizeEuroInput(e.target.value) }))
                }
              />
              <Input
                label="Unité"
                value={productForm.unit}
                onChange={(e) => setProductForm((prev) => ({ ...prev, unit: e.target.value }))}
              />
            </>
          )}
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
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
    </ProPageShell>
  );
}
