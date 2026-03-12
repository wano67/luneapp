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
import { Plus, Trash2, Send, FileText, X } from 'lucide-react';

type PayslipItem = {
  id: string;
  userId: string;
  period: string;
  grossCents: number;
  netCents: number;
  employerChargesCents: number;
  status: string;
  sentAt: string | null;
  employeeName: string | null;
  employeeEmail: string | null;
  createdAt: string;
};

type TeamMember = {
  userId: string;
  name: string;
  email: string;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validée',
  SENT: 'Envoyée',
};

export default function PayslipsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const basePath = `/api/pro/businesses/${businessId}/payslips`;

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const [items, setItems] = useState<PayslipItem[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [selectedUserId, setSelectedUserId] = useState('');
  const [period, setPeriod] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [chargesAmount, setChargesAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [payslipsRes, membersRes] = await Promise.all([
        fetchJson<{ items: PayslipItem[] }>(basePath),
        fetchJson<{ members: TeamMember[] }>(`/api/pro/businesses/${businessId}/team`),
      ]);
      if (payslipsRes.ok && payslipsRes.data?.items) setItems(payslipsRes.data.items);
      if (membersRes.ok && membersRes.data?.members) setMembers(membersRes.data.members);
    } finally {
      setLoading(false);
    }
  }, [businessId, basePath]);

  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setSelectedUserId(''); setPeriod(''); setGrossAmount('');
    setNetAmount(''); setChargesAmount(''); setShowForm(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !period) { setError('Employé et période requis.'); return; }

    const grossCents = Math.round(parseFloat(grossAmount) * 100);
    const netCents = Math.round(parseFloat(netAmount) * 100);
    const employerChargesCents = Math.round(parseFloat(chargesAmount) * 100);
    if (!grossCents || !netCents) { setError('Montants invalides.'); return; }

    setSaving(true);
    setError(null);
    const res = await fetchJson<{ item: PayslipItem }>(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedUserId, period, grossCents, netCents, employerChargesCents: employerChargesCents || 0 }),
    });
    setSaving(false);
    if (res.ok && res.data?.item) {
      setItems((prev) => [res.data!.item, ...prev]);
      resetForm();
    } else {
      setError(res.error ?? 'Création impossible.');
    }
  }

  async function validatePayslip(id: string) {
    const res = await fetchJson<{ item: PayslipItem }>(`${basePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VALIDATED' }),
    });
    if (res.ok && res.data?.item) setItems((prev) => prev.map((i) => (i.id === id ? res.data!.item : i)));
  }

  async function sendPayslip(id: string) {
    const res = await fetchJson<{ item: PayslipItem }>(`${basePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SENT' }),
    });
    if (res.ok && res.data?.item) setItems((prev) => prev.map((i) => (i.id === id ? res.data!.item : i)));
  }

  async function deletePayslip(id: string) {
    if (!window.confirm('Supprimer cette fiche de paie ?')) return;
    const res = await fetchJson<{ ok: boolean }>(`${basePath}/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const totalNet = items.reduce((s, i) => s + i.netCents, 0);

  // Default period to current month
  const defaultPeriod = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-semibold">Fiches de paie</h1>
            <p className="text-sm text-[var(--text-faint)]">
              Générez et envoyez les bulletins de paie simplifiés.
            </p>
          </div>
        </div>
        {isAdmin && !showForm && (
          <Button size="sm" onClick={() => { setPeriod(defaultPeriod); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nouvelle fiche
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{items.length}</p>
          <p className="text-xs text-[var(--text-faint)]">Fiches de paie</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{formatCents(totalNet)}</p>
          <p className="text-xs text-[var(--text-faint)]">Total net</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{items.filter((i) => i.status === 'SENT').length}</p>
          <p className="text-xs text-[var(--text-faint)]">Envoyées</p>
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
            <h2 className="font-medium">Nouvelle fiche de paie</h2>
            <button onClick={resetForm} className="text-[var(--text-faint)] hover:text-[var(--text)]"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Employé</label>
                <select className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={saving} required>
                  <option value="">Sélectionner...</option>
                  {members.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Période (YYYY-MM)</label>
                <Input required type="month" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Brut (EUR)</label>
                <Input required type="number" step="0.01" min="0" placeholder="3500.00" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Net (EUR)</label>
                <Input required type="number" step="0.01" min="0" placeholder="2730.00" value={netAmount} onChange={(e) => setNetAmount(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Charges employeur (EUR)</label>
                <Input type="number" step="0.01" min="0" placeholder="1400.00" value={chargesAmount} onChange={(e) => setChargesAmount(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? 'En cours...' : 'Créer'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Brut</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Charges</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableEmpty>Chargement...</TableEmpty>}
            {!loading && items.length === 0 && <TableEmpty>Aucune fiche de paie.</TableEmpty>}
            {!loading && items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-sm">{item.employeeName ?? item.employeeEmail ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm">{item.period}</TableCell>
                <TableCell className="font-mono text-sm">{formatCents(item.grossCents)}</TableCell>
                <TableCell className="font-mono font-medium">{formatCents(item.netCents)}</TableCell>
                <TableCell className="font-mono text-sm">{formatCents(item.employerChargesCents)}</TableCell>
                <TableCell>
                  <Badge variant={item.status === 'SENT' ? 'pro' : item.status === 'VALIDATED' ? 'pro' : 'neutral'}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {item.status === 'DRAFT' && isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => validatePayslip(item.id)} title="Valider">
                      Valider
                    </Button>
                  )}
                  {item.status === 'VALIDATED' && isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => sendPayslip(item.id)} title="Envoyer">
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {item.status === 'DRAFT' && isAdmin && (
                    <Button size="sm" variant="danger" onClick={() => deletePayslip(item.id)}>
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
