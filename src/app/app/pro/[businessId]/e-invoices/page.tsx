'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmpty } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { Plus, Trash2, Send, FileText } from 'lucide-react';

type EInvoiceItem = {
  id: string;
  invoiceId: string;
  format: string;
  status: string;
  pdpTrackingId: string | null;
  siren: string | null;
  recipientSiren: string | null;
  transmittedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  invoiceNumber: string | null;
  invoiceTotalCents: number;
  clientName: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente',
  TRANSMITTED: 'Transmise',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Rejetée',
  ERROR: 'Erreur',
};

const STATUS_VARIANT: Record<string, 'neutral' | 'pro' | 'danger'> = {
  DRAFT: 'neutral',
  PENDING: 'neutral',
  TRANSMITTED: 'pro',
  ACCEPTED: 'pro',
  REJECTED: 'danger',
  ERROR: 'danger',
};

export default function EInvoicesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const basePath = `/api/pro/businesses/${businessId}/e-invoices`;

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const [items, setItems] = useState<EInvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [invoiceId, setInvoiceId] = useState('');
  const [format, setFormat] = useState('FACTUR_X');
  const [siren, setSiren] = useState('');
  const [recipientSiren, setRecipientSiren] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<{ items: EInvoiceItem[] }>(basePath);
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
    if (!invoiceId.trim()) { setError('ID facture requis.'); return; }
    setSaving(true);
    setError(null);
    const res = await fetchJson<{ item: EInvoiceItem }>(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: invoiceId.trim(),
        format,
        siren: siren || undefined,
        recipientSiren: recipientSiren || undefined,
      }),
    });
    setSaving(false);
    if (res.ok && res.data?.item) {
      setItems((prev) => [res.data!.item, ...prev]);
      setShowForm(false);
      setInvoiceId('');
      setSiren('');
      setRecipientSiren('');
    } else {
      setError(res.error ?? 'Création impossible.');
    }
  }

  async function transmit(id: string) {
    const res = await fetchJson<{ item: EInvoiceItem }>(`${basePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'TRANSMITTED' }),
    });
    if (res.ok && res.data?.item) {
      setItems((prev) => prev.map((i) => (i.id === id ? res.data!.item : i)));
    }
  }

  async function deleteItem(id: string) {
    if (!window.confirm('Supprimer cette e-facture ?')) return;
    const res = await fetchJson<{ ok: boolean }>(`${basePath}/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const draftCount = items.filter((i) => i.status === 'DRAFT').length;
  const transmittedCount = items.filter((i) => i.status === 'TRANSMITTED' || i.status === 'ACCEPTED').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-semibold">Facturation électronique</h1>
            <p className="text-sm text-[var(--text-faint)]">
              Gérez vos e-factures au format Factur-X / UBL / CII.
            </p>
          </div>
        </div>
        {isAdmin && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouvelle e-facture
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{items.length}</p>
          <p className="text-xs text-[var(--text-faint)]">Total e-factures</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{draftCount}</p>
          <p className="text-xs text-[var(--text-faint)]">Brouillons</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{transmittedCount}</p>
          <p className="text-xs text-[var(--text-faint)]">Transmises / Acceptées</p>
        </Card>
      </div>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">ID Facture</label>
                <Input required placeholder="ID de la facture" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Format</label>
                <select className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" value={format} onChange={(e) => setFormat(e.target.value)} disabled={saving}>
                  <option value="FACTUR_X">Factur-X</option>
                  <option value="UBL">UBL</option>
                  <option value="CII">CII</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">SIREN émetteur</label>
                <Input placeholder="123456789" value={siren} onChange={(e) => setSiren(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">SIREN destinataire</label>
                <Input placeholder="987654321" value={recipientSiren} onChange={(e) => setRecipientSiren(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? 'En cours...' : 'Créer'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Facture</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableEmpty>Chargement...</TableEmpty>}
            {!loading && items.length === 0 && <TableEmpty>Aucune e-facture.</TableEmpty>}
            {!loading && items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.invoiceNumber ?? item.invoiceId}</TableCell>
                <TableCell className="text-sm">{item.clientName ?? '—'}</TableCell>
                <TableCell className="font-mono font-medium">{formatCents(item.invoiceTotalCents)}</TableCell>
                <TableCell><Badge variant="neutral">{item.format}</Badge></TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[item.status] ?? 'neutral'}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{new Date(item.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell className="text-right space-x-1">
                  {item.status === 'DRAFT' && isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => transmit(item.id)} title="Transmettre">
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {(item.status === 'DRAFT' || item.status === 'ERROR') && isAdmin && (
                    <Button size="sm" variant="danger" onClick={() => deleteItem(item.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
