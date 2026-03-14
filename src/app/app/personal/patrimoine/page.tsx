'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmpty } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { Plus, Trash2, Pencil, TrendingUp, X } from 'lucide-react';

type AssetItem = {
  id: string;
  type: string;
  name: string;
  institution: string | null;
  purchasePriceCents: string | null;
  currentValueCents: string | null;
  quantity: number | null;
  currency: string;
  purchaseDate: string | null;
  notes: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  REAL_ESTATE: 'Immobilier',
  STOCK: 'Actions',
  CRYPTO: 'Crypto',
  BOND: 'Obligations',
  CASH: 'Liquidités',
  SCPI: 'SCPI',
  LIFE_INSURANCE: 'Assurance-vie',
  OTHER: 'Autre',
};

const TYPES = Object.entries(TYPE_LABELS);

export default function PatrimoinePage() {
  usePageTitle('Patrimoine');
  const basePath = '/api/personal/assets';

  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [type, setType] = useState('STOCK');
  const [institution, setInstitution] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<{ items: AssetItem[] }>(basePath);
      if (res.ok && res.data?.items) {
        setItems(res.data.items);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setName(''); setType('STOCK'); setInstitution('');
    setPurchasePrice(''); setCurrentValue(''); setQuantity('');
    setNotes(''); setEditingId(null); setShowForm(false);
  }

  function startEdit(item: AssetItem) {
    setEditingId(item.id);
    setName(item.name);
    setType(item.type);
    setInstitution(item.institution ?? '');
    setPurchasePrice(item.purchasePriceCents ? (parseInt(item.purchasePriceCents) / 100).toString() : '');
    setCurrentValue(item.currentValueCents ? (parseInt(item.currentValueCents) / 100).toString() : '');
    setQuantity(item.quantity?.toString() ?? '');
    setNotes(item.notes ?? '');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      type,
      institution: institution || undefined,
      notes: notes || undefined,
    };
    if (purchasePrice) payload.purchasePriceCents = Math.round(parseFloat(purchasePrice) * 100);
    if (currentValue) payload.currentValueCents = Math.round(parseFloat(currentValue) * 100);
    if (quantity) payload.quantity = parseFloat(quantity);

    if (editingId) {
      const res = await fetchJson<{ item: AssetItem }>(`${basePath}/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && res.data?.item) {
        setItems((prev) => prev.map((i) => (i.id === editingId ? res.data!.item : i)));
      } else {
        setError(res.error ?? 'Mise à jour impossible.');
      }
    } else {
      const res = await fetchJson<{ item: AssetItem }>(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && res.data?.item) {
        setItems((prev) => [res.data!.item, ...prev]);
      } else {
        setError(res.error ?? 'Création impossible.');
      }
    }

    setSaving(false);
    resetForm();
  }

  async function deleteItem(item: AssetItem) {
    if (!window.confirm(`Supprimer "${item.name}" ?`)) return;
    const res = await fetchJson<{ ok: boolean }>(`${basePath}/${item.id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const totalValue = items.reduce((sum, i) => sum + (i.currentValueCents ? parseInt(i.currentValueCents) : 0), 0);
  const totalPurchase = items.reduce((sum, i) => sum + (i.purchasePriceCents ? parseInt(i.purchasePriceCents) : 0), 0);
  const pnl = totalValue - totalPurchase;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-semibold">Patrimoine</h1>
            <p className="text-sm text-[var(--text-faint)]">
              Suivez tous vos actifs : immobilier, actions, crypto, assurance-vie...
            </p>
          </div>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter un actif
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{formatCents(totalValue)}</p>
          <p className="text-xs text-[var(--text-faint)]">Valeur totale</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{items.length}</p>
          <p className="text-xs text-[var(--text-faint)]">Actifs</p>
        </Card>
        <Card className="p-4 text-center">
          <p className={`text-2xl font-bold ${pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {pnl >= 0 ? '+' : ''}{formatCents(pnl)}
          </p>
          <p className="text-xs text-[var(--text-faint)]">Plus/moins-value</p>
        </Card>
      </div>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{editingId ? 'Modifier l\'actif' : 'Nouvel actif'}</h2>
            <button onClick={resetForm} className="text-[var(--text-faint)] hover:text-[var(--text)]"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Nom</label>
                <Input required placeholder="Ex: PEA Boursorama" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)} disabled={saving}>
                  {TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Établissement</label>
                <Input placeholder="Ex: Boursorama" value={institution} onChange={(e) => setInstitution(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Prix d&apos;achat (EUR)</label>
                <Input type="number" step="0.01" min="0" placeholder="10000.00" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Valeur actuelle (EUR)</label>
                <Input type="number" step="0.01" min="0" placeholder="12500.00" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Quantité</label>
                <Input type="number" step="0.0001" min="0" placeholder="10" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input placeholder="Notes optionnelles" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? 'En cours...' : editingId ? 'Enregistrer' : 'Ajouter'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Actif</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Établissement</TableHead>
              <TableHead>Prix d&apos;achat</TableHead>
              <TableHead>Valeur actuelle</TableHead>
              <TableHead>+/- Value</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableEmpty>Chargement...</TableEmpty>}
            {!loading && items.length === 0 && <TableEmpty>Aucun actif. Ajoutez vos premiers investissements.</TableEmpty>}
            {!loading && items.map((item) => {
              const cv = item.currentValueCents ? parseInt(item.currentValueCents) : 0;
              const pp = item.purchasePriceCents ? parseInt(item.purchasePriceCents) : 0;
              const diff = cv - pp;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell><Badge variant="neutral">{TYPE_LABELS[item.type] ?? item.type}</Badge></TableCell>
                  <TableCell className="text-sm">{item.institution ?? '—'}</TableCell>
                  <TableCell className="font-mono text-sm">{pp ? formatCents(pp) : '—'}</TableCell>
                  <TableCell className="font-mono text-sm">{cv ? formatCents(cv) : '—'}</TableCell>
                  <TableCell className={`font-mono text-sm ${diff >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {pp && cv ? `${diff >= 0 ? '+' : ''}${formatCents(diff)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => deleteItem(item)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
