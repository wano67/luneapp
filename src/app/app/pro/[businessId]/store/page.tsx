'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTabSync } from '@/lib/hooks/useTabSync';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmpty } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import {
  Plus, Trash2, Pencil, Eye, EyeOff, ShoppingBag, Package, X,
} from 'lucide-react';

type StoreProductItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  isPublished: boolean;
  stockCount: number;
  createdAt: string;
};

type StoreOrderItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  status: string;
  createdAt: string;
  items: { productName: string; quantity: number; unitPriceCents: number }[];
};

const ORDER_STATUS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

export default function StorePage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const productsPath = `/api/pro/businesses/${businessId}/store/products`;
  const ordersPath = `/api/pro/businesses/${businessId}/store/orders`;

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const [tab, setTab] = useTabSync<'products' | 'orders'>(['products', 'orders']);
  usePageTitle('Boutique');
  const [products, setProducts] = useState<StoreProductItem[]>([]);
  const [orders, setOrders] = useState<StoreOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Product form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockCount, setStockCount] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<{ items: StoreProductItem[] }>(productsPath);
      if (res.ok && res.data?.items) setProducts(res.data.items);
    } finally {
      setLoading(false);
    }
  }, [businessId, productsPath]);

  const loadOrders = useCallback(async () => {
    if (!businessId) return;
    const res = await fetchJson<{ items: StoreOrderItem[] }>(ordersPath);
    if (res.ok && res.data?.items) setOrders(res.data.items);
  }, [businessId, ordersPath]);

  useEffect(() => { void loadProducts(); void loadOrders(); }, [loadProducts, loadOrders]);

  function resetForm() {
    setName(''); setDescription(''); setPrice(''); setStockCount('');
    setEditingId(null); setShowForm(false);
  }

  function startEdit(p: StoreProductItem) {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description ?? '');
    setPrice((p.priceCents / 100).toString());
    setStockCount(p.stockCount.toString());
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!priceCents || priceCents < 0) { setError('Prix invalide.'); return; }

    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      description: description || undefined,
      priceCents,
      stockCount: stockCount ? parseInt(stockCount) : 0,
    };

    if (editingId) {
      const res = await fetchJson<{ item: StoreProductItem }>(`${productsPath}/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && res.data?.item) setProducts((prev) => prev.map((i) => (i.id === editingId ? res.data!.item : i)));
      else setError(res.error ?? 'Mise à jour impossible.');
    } else {
      const res = await fetchJson<{ item: StoreProductItem }>(productsPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && res.data?.item) setProducts((prev) => [res.data!.item, ...prev]);
      else setError(res.error ?? 'Création impossible.');
    }

    setSaving(false);
    resetForm();
  }

  async function togglePublish(p: StoreProductItem) {
    const res = await fetchJson<{ item: StoreProductItem }>(`${productsPath}/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !p.isPublished }),
    });
    if (res.ok && res.data?.item) setProducts((prev) => prev.map((i) => (i.id === p.id ? res.data!.item : i)));
  }

  async function deleteProduct(p: StoreProductItem) {
    if (!window.confirm(`Supprimer "${p.name}" ?`)) return;
    const res = await fetchJson<{ ok: boolean }>(`${productsPath}/${p.id}`, { method: 'DELETE' });
    if (res.ok) setProducts((prev) => prev.filter((i) => i.id !== p.id));
  }

  async function updateOrderStatus(orderId: string, status: string) {
    const res = await fetchJson<{ item: StoreOrderItem }>(`${ordersPath}/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok && res.data?.item) setOrders((prev) => prev.map((o) => (o.id === orderId ? res.data!.item : o)));
  }

  const publishedCount = products.filter((p) => p.isPublished).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-semibold">Boutique en ligne</h1>
            <p className="text-sm text-[var(--text-faint)]">
              Gérez votre catalogue produits et commandes.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === 'products' ? 'primary' : 'outline'} onClick={() => setTab('products')}>
            <Package className="w-4 h-4 mr-1" /> Produits ({products.length})
          </Button>
          <Button size="sm" variant={tab === 'orders' ? 'primary' : 'outline'} onClick={() => setTab('orders')}>
            <ShoppingBag className="w-4 h-4 mr-1" /> Commandes ({orders.length})
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{products.length}</p>
          <p className="text-xs text-[var(--text-faint)]">Produits</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{publishedCount}</p>
          <p className="text-xs text-[var(--text-faint)]">Publiés</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{orders.length}</p>
          <p className="text-xs text-[var(--text-faint)]">Commandes</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{formatCents(orders.reduce((s, o) => s + o.totalCents, 0))}</p>
          <p className="text-xs text-[var(--text-faint)]">CA total</p>
        </Card>
      </div>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <>
          {isAdmin && !showForm && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-1" /> Nouveau produit
              </Button>
            </div>
          )}

          {showForm && (
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{editingId ? 'Modifier le produit' : 'Nouveau produit'}</h2>
                <button onClick={resetForm} className="text-[var(--text-faint)] hover:text-[var(--text)]"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Nom</label>
                    <Input required placeholder="Ex: T-shirt Logo" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Prix (EUR)</label>
                    <Input required type="number" step="0.01" min="0" placeholder="29.90" value={price} onChange={(e) => setPrice(e.target.value)} disabled={saving} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Stock</label>
                    <Input type="number" min="0" placeholder="100" value={stockCount} onChange={(e) => setStockCount(e.target.value)} disabled={saving} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input placeholder="Description courte" value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>Annuler</Button>
                  <Button type="submit" disabled={saving}>{saving ? 'En cours...' : editingId ? 'Enregistrer' : 'Créer'}</Button>
                </div>
              </form>
            </Card>
          )}

          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableEmpty>Chargement...</TableEmpty>}
                {!loading && products.length === 0 && <TableEmpty>Aucun produit. Ajoutez votre premier article.</TableEmpty>}
                {!loading && products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{p.name}</span>
                        {p.description && <p className="text-xs text-[var(--text-faint)]">{p.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{formatCents(p.priceCents)}</TableCell>
                    <TableCell>{p.stockCount}</TableCell>
                    <TableCell>
                      <Badge variant={p.isPublished ? 'pro' : 'neutral'}>
                        {p.isPublished ? 'Publié' : 'Brouillon'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => togglePublish(p)} title={p.isPublished ? 'Masquer' : 'Publier'}>
                            {p.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => deleteProduct(p)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <Card className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commande</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 && <TableEmpty>Aucune commande.</TableEmpty>}
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">#{o.orderNumber}</TableCell>
                  <TableCell className="text-sm">{o.customerName}</TableCell>
                  <TableCell className="font-mono font-medium">{formatCents(o.totalCents)}</TableCell>
                  <TableCell className="text-sm">{o.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}</TableCell>
                  <TableCell>
                    <Badge variant={o.status === 'DELIVERED' ? 'pro' : o.status === 'CANCELLED' || o.status === 'REFUNDED' ? 'danger' : 'neutral'}>
                      {ORDER_STATUS[o.status] ?? o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(o.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="text-right">
                    {o.status === 'PENDING' && isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, 'CONFIRMED')}>Confirmer</Button>
                    )}
                    {o.status === 'CONFIRMED' && isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, 'SHIPPED')}>Expédier</Button>
                    )}
                    {o.status === 'SHIPPED' && isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, 'DELIVERED')}>Livrée</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
