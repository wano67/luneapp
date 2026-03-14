'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import {
  Plus, Trash2, Copy, Ban, CreditCard,
} from 'lucide-react';

type PaymentLinkItem = {
  id: string;
  amountCents: number;
  currency: string;
  description: string | null;
  status: string;
  invoiceNumber: string | null;
  clientName: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  payUrl?: string; // only returned at creation (POST)
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  PAID: 'Payé',
  EXPIRED: 'Expiré',
  CANCELLED: 'Annulé',
};

export default function PaymentLinksPage() {
  usePageTitle('Liens de paiement');
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const basePath = `/api/pro/businesses/${businessId}/payment-links`;

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const [items, setItems] = useState<PaymentLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<{ items: PaymentLinkItem[] }>(basePath);
      if (res.ok && res.data?.items) {
        setItems(res.data.items);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, basePath]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!amountCents || amountCents <= 0) {
      setError('Montant invalide.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetchJson<{ item: PaymentLinkItem }>(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents, description: description || undefined }),
    });
    setSaving(false);
    if (res.ok && res.data?.item) {
      setItems((prev) => [res.data!.item, ...prev]);
      setShowForm(false);
      setAmount('');
      setDescription('');
    } else {
      setError(res.error ?? 'Création impossible.');
    }
  }

  async function cancelLink(id: string) {
    const res = await fetchJson<{ item: PaymentLinkItem }>(`${basePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    if (res.ok && res.data?.item) {
      setItems((prev) => prev.map((i) => (i.id === id ? res.data!.item : i)));
    }
  }

  async function deleteLink(id: string) {
    if (!window.confirm('Supprimer ce lien ?')) return;
    const res = await fetchJson<{ ok: boolean }>(`${basePath}/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function copyUrl(payUrl: string) {
    const fullUrl = `${window.location.origin}${payUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setInfo('Lien copié dans le presse-papier.');
    setTimeout(() => setInfo(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-semibold">Liens de paiement</h1>
            <p className="text-sm text-[var(--text-faint)]">
              Créez des liens de paiement à partager avec vos clients.
            </p>
          </div>
        </div>
        {isAdmin && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouveau lien
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">
          {error}
        </div>
      )}
      {info && (
        <div className="text-sm text-[var(--success)] bg-[var(--success-bg)] border border-[var(--success-border)] px-3 py-2 rounded">
          {info}
        </div>
      )}

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Montant (EUR)</label>
                <Input required type="number" step="0.01" min="0.01" placeholder="150.00" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input placeholder="Ex: Acompte projet X" value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? 'En cours...' : 'Créer le lien'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Montant</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableEmpty>Chargement...</TableEmpty>}
            {!loading && items.length === 0 && <TableEmpty>Aucun lien de paiement.</TableEmpty>}
            {!loading && items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-medium">{formatCents(item.amountCents)}</TableCell>
                <TableCell className="text-sm">{item.description ?? '—'}</TableCell>
                <TableCell className="text-sm">{item.clientName ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={item.status === 'PAID' ? 'pro' : item.status === 'ACTIVE' ? 'neutral' : 'danger'}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{new Date(item.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell className="text-right space-x-1">
                  {item.status === 'ACTIVE' && (
                    <>
                      {item.payUrl && (
                        <Button size="sm" variant="outline" onClick={() => copyUrl(item.payUrl!)} title="Copier le lien">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => cancelLink(item.id)} disabled={!isAdmin} title="Annuler">
                        <Ban className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="danger" onClick={() => deleteLink(item.id)} disabled={!isAdmin}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
