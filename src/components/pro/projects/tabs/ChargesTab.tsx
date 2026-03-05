'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { fmtKpi } from '@/lib/format';
import { parseEuroToCents, sanitizeEuroInput } from '@/lib/money';

/* ═══ Types ═══ */

type Charge = {
  id: string;
  type: string;
  amountCents: string;
  category: string;
  vendor: string | null;
  method: string | null;
  date: string;
  note: string | null;
};

type LaborCost = {
  membershipId: string;
  userName: string;
  jobTitle: string | null;
  hourlyCostCents: string | null;
  totalEstimatedMinutes: number;
  totalLaborCostCents: string;
};

type ChargesPayload = {
  charges: Charge[];
  laborCosts: LaborCost[];
  totals: {
    totalChargesCents: string;
    totalLaborCostCents: string;
    grandTotalCents: string;
  };
};

type Props = {
  businessId: string;
  projectId: string;
  isAdmin: boolean;
};

const METHOD_LABELS: Record<string, string> = {
  WIRE: 'Virement',
  CARD: 'Carte',
  CHECK: 'Chèque',
  CASH: 'Espèces',
  OTHER: 'Autre',
};

function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

function fmtHours(minutes: number) {
  if (minutes === 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function fmtHourlyCost(cents: string | null) {
  if (!cents) return '—';
  const val = Number(cents) / 100;
  return `${val.toFixed(2)} €/h`;
}

/* ═══ Component ═══ */

export function ChargesTab({ businessId, projectId, isAdmin }: Props) {
  const [data, setData] = useState<ChargesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add charge modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', category: 'Autre', vendor: '', date: '', note: '', method: 'WIRE' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Charge | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCharges = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<ChargesPayload>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/charges`,
    );
    if (res.ok && res.data) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error ?? 'Impossible de charger les charges.');
    }
    setLoading(false);
  }, [businessId, projectId]);

  useEffect(() => { void loadCharges(); }, [loadCharges]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.date) return;
    setCreating(true);
    setFormError(null);

    const amountCents = parseEuroToCents(form.amount);
    if (!Number.isFinite(amountCents) || amountCents === 0) {
      setFormError('Montant invalide.');
      setCreating(false);
      return;
    }

    const res = await fetchJson(`/api/pro/businesses/${businessId}/finances`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'EXPENSE',
        amount: Math.abs(amountCents) / 100,
        category: form.category || 'Autre',
        vendor: form.vendor || undefined,
        date: form.date,
        note: form.note || undefined,
        method: form.method || undefined,
        projectId,
      }),
    });

    if (res.ok) {
      setModalOpen(false);
      setForm({ amount: '', category: 'Autre', vendor: '', date: '', note: '', method: 'WIRE' });
      void loadCharges();
    } else {
      setFormError(res.error ?? 'Erreur lors de la création.');
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetchJson(`/api/pro/businesses/${businessId}/finances/${deleteTarget.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setDeleteTarget(null);
      void loadCharges();
    }
    setDeleting(false);
  };

  return (
    <div className="flex flex-col gap-5 p-1">
      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <KpiCard label="Charges directes" value={fmtKpi(data?.totals.totalChargesCents)} loading={loading} delay={0} />
        <KpiCard label="Coût équipe" value={fmtKpi(data?.totals.totalLaborCostCents)} loading={loading} delay={50} />
        <KpiCard label="Total projet" value={fmtKpi(data?.totals.grandTotalCents)} loading={loading} delay={100} />
      </div>

      {error && (
        <Card className="p-4">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </Card>
      )}

      {/* Direct charges section */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 pb-0">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Charges directes</h3>
          {isAdmin && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={14} />
              Ajouter
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              {isAdmin && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && data?.charges.length ? (
              data.charges.map((c) => {
                const amt = BigInt(c.amountCents);
                const absAmt = amt < 0n ? -amt : amt;
                return (
                  <TableRow key={c.id}>
                    <TableCell>{fmtDate(c.date)}</TableCell>
                    <TableCell>{c.category}</TableCell>
                    <TableCell>{c.vendor ?? '—'}</TableCell>
                    <TableCell>{c.method ? METHOD_LABELS[c.method] ?? c.method : '—'}</TableCell>
                    <TableCell className="text-right font-medium" style={{ color: 'var(--danger)' }}>
                      {fmtKpi(absAmt.toString())}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          className="text-[var(--text-faint)] hover:text-[var(--danger)] transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            ) : (
              <TableEmpty>
                {loading ? 'Chargement…' : 'Aucune charge directe.'}
              </TableEmpty>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Labor costs section */}
      <Card className="overflow-hidden">
        <div className="p-4 pb-0">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Coût de l&apos;équipe</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Calculé à partir des heures estimées et du taux horaire de chaque membre.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead className="text-right">Heures estimées</TableHead>
              <TableHead className="text-right">Taux horaire</TableHead>
              <TableHead className="text-right">Coût total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && data?.laborCosts.length ? (
              data.laborCosts.map((lc) => (
                <TableRow key={lc.membershipId}>
                  <TableCell className="font-medium">{lc.userName}</TableCell>
                  <TableCell>{lc.jobTitle ?? '—'}</TableCell>
                  <TableCell className="text-right">{fmtHours(lc.totalEstimatedMinutes)}</TableCell>
                  <TableCell className="text-right">{fmtHourlyCost(lc.hourlyCostCents)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {fmtKpi(lc.totalLaborCostCents)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty>
                {loading ? 'Chargement…' : 'Aucun membre avec des tâches estimées.'}
              </TableEmpty>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add charge modal */}
      <Modal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        title="Nouvelle charge"
        description="Ajoutez une dépense liée à ce projet."
      >
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs text-[var(--text-secondary)]">Montant (€)</span>
              <Input
                name="amount"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: sanitizeEuroInput(e.target.value) }))}
                placeholder="0,00"
                required
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-secondary)]">Date</span>
              <Input
                type="date"
                name="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </label>
          </div>
          <label className="text-sm">
            <span className="text-xs text-[var(--text-secondary)]">Catégorie</span>
            <Input
              name="category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Ex: Logiciel, Matériel..."
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-[var(--text-secondary)]">Fournisseur</span>
            <Input
              name="vendor"
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              placeholder="Nom du fournisseur"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-[var(--text-secondary)]">Méthode de paiement</span>
            <Select
              name="method"
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
            >
              <option value="WIRE">Virement</option>
              <option value="CARD">Carte</option>
              <option value="CHECK">Chèque</option>
              <option value="CASH">Espèces</option>
              <option value="OTHER">Autre</option>
            </Select>
          </label>
          <label className="text-sm">
            <span className="text-xs text-[var(--text-secondary)]">Note</span>
            <Input
              name="note"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Optionnel"
            />
          </label>

          {formError && <p className="text-xs text-[var(--danger)]">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? 'Création…' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onCloseAction={() => setDeleteTarget(null)}
        title="Supprimer la charge"
        description="Cette action est irréversible."
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
            Annuler
          </Button>
          <Button type="button" size="sm" onClick={handleDelete} disabled={deleting} className="!bg-[var(--danger)] !text-white !border-0">
            {deleting ? 'Suppression…' : 'Supprimer'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
