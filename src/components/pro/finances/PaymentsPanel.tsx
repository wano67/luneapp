'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  formatCurrency,
  formatDate,
  paginate,
  type PaymentMethod,
  type PaymentRow,
  type PaymentStatus,
} from '@/app/app/pro/pro-data';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/app/app/components/PageHeader';

type SortKey = 'date' | 'amount' | 'status';

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: 'Payé',
  PENDING: 'En attente',
  LATE: 'En retard',
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  VIREMENT: 'Virement',
  CARTE: 'Carte',
  CHEQUE: 'Chèque',
  ESPECES: 'Espèces',
};

function buildPaymentDate(p: PaymentRow) {
  return new Date(p.receivedAt || p.expectedAt);
}

type FinanceApiItem = {
  id: string;
  businessId: string;
  amountCents: string;
  amount: number;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  note?: string | null;
  projectName?: string | null;
  metadata?: Partial<{
    clientName: string;
    project: string;
    invoiceId: string;
    method: string;
    status: string;
    expectedAt: string;
    receivedAt: string;
    currency: string;
    note: string;
  }>;
};

type FinanceListResponse = {
  items: FinanceApiItem[];
};

export function PaymentsPanel({ businessId }: { businessId: string }) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortKey>('date');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{
    clientName: string;
    project: string;
    amount: string;
    method: PaymentMethod;
    receivedAt: string;
    expectedAt: string;
    status: PaymentStatus;
    note: string;
  }>({
    clientName: '',
    project: '',
    amount: '',
    method: 'VIREMENT',
    receivedAt: '',
    expectedAt: '',
    status: 'PAID',
    note: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  function toPaymentRow(item: FinanceApiItem): PaymentRow {
    const meta = item.metadata ?? {};
    const receivedAt = meta.receivedAt || item.date;
    const expectedAt = meta.expectedAt || item.date;
    const status = (meta.status as PaymentStatus) || (meta.receivedAt ? 'PAID' : 'PENDING');
    const method = (meta.method as PaymentMethod) || 'VIREMENT';
    const currency = meta.currency || 'EUR';
    const clientName = meta.clientName || 'Client';

    return {
      id: item.id,
      businessId: item.businessId,
      invoiceId: meta.invoiceId,
      clientName,
      project: meta.project || item.projectName || undefined,
      amount: Number(item.amountCents) / 100,
      currency,
      receivedAt,
      expectedAt,
      method,
      status,
      note: meta.note || item.note || undefined,
    };
  }

  async function loadPayments() {
    try {
      setLoading(true);
      setError(null);
      setRequestId(null);
      const res = await fetchJson<FinanceListResponse>(
        `/api/pro/businesses/${businessId}/finances?type=INCOME&category=PAYMENT`
      );

      setRequestId(res.requestId);
      if (!res.ok || !res.data) {
        setError(res.requestId ? `${res.error ?? 'Chargement impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Chargement impossible.');
        setPayments([]);
        return;
      }
      setPayments(res.data.items.map(toPaymentRow));
    } catch (err) {
      setError(getErrorMessage(err));
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!businessId) return;
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = payments;
    if (statusFilter !== 'ALL') list = list.filter((p) => p.status === statusFilter);
    if (methodFilter !== 'ALL') list = list.filter((p) => p.method === methodFilter);
    if (term) {
      list = list.filter(
        (p) =>
          p.clientName.toLowerCase().includes(term) ||
          (p.invoiceId ?? '').toLowerCase().includes(term) ||
          (p.project ?? '').toLowerCase().includes(term)
      );
    }

    return [...list].sort((a, b) => {
      if (sort === 'amount') return b.amount - a.amount;
      if (sort === 'status') return a.status.localeCompare(b.status);
      return buildPaymentDate(b).getTime() - buildPaymentDate(a).getTime();
    });
  }, [methodFilter, payments, search, sort, statusFilter]);

  const { pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page]
  );

  const displaySelectedId = selectedId ?? pageItems[0]?.id ?? null;
  const selected = payments.find((p) => p.id === displaySelectedId) ?? null;

  const kpis = useMemo(() => {
    const now = new Date();
    const monthPaid = payments.filter(
      (p) =>
        p.status === 'PAID' &&
        p.receivedAt &&
        new Date(p.receivedAt).getMonth() === now.getMonth() &&
        new Date(p.receivedAt).getFullYear() === now.getFullYear()
    );
    const overdue = payments.filter((p) => p.status === 'LATE');
    return {
      paidThisMonth: monthPaid.reduce((acc, p) => acc + p.amount, 0),
      overdueCount: overdue.length,
      pending: payments.filter((p) => p.status === 'PENDING').length,
    };
  }, [payments]);

  function onSearch(e: ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
  }

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('Création non implémentée (placeholder).');
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={`/app/pro/${businessId}/finances`}
        backLabel="Finances"
        title="Paiements"
        subtitle="Suivi des encaissements/échéances issus des écritures financières."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Payés ce mois" value={formatCurrency(kpis.paidThisMonth)} trend="neutral" />
        <KpiCard
          label="En retard"
          value={`${kpis.overdueCount}`}
          trend={kpis.overdueCount > 0 ? 'down' : 'neutral'}
        />
        <KpiCard label="En attente" value={`${kpis.pending}`} trend="neutral" />
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Rechercher" value={search} onChange={onSearch} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'ALL')}>
            <option value="ALL">Tous statuts</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | 'ALL')}>
            <option value="ALL">Tous moyens</option>
            {Object.entries(METHOD_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="date">Date</option>
            <option value="amount">Montant</option>
            <option value="status">Statut</option>
          </Select>
        </div>

        {loading ? <p className="text-xs text-[var(--text-secondary)]">Chargement…</p> : null}
        {error ? <p className="text-xs text-rose-500">{error}</p> : null}
        {requestId ? <p className="text-[10px] text-[var(--text-secondary)]">Req: {requestId}</p> : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Projet</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Échéance/Réception</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="cursor-pointer hover:bg-[var(--surface-hover)]"
                  data-selected={selectedId === p.id}
                >
                  <TableCell className="font-semibold">{p.clientName}</TableCell>
                  <TableCell>{p.project ?? '—'}</TableCell>
                  <TableCell>{formatCurrency(p.amount)}</TableCell>
                  <TableCell>{METHOD_LABELS[p.method]}</TableCell>
                  <TableCell>
                    {p.receivedAt ? (
                      <span className="text-xs text-emerald-700">Reçu le {formatDate(p.receivedAt)}</span>
                    ) : (
                      <span className="text-xs text-[var(--text-secondary)]">Échéance {formatDate(p.expectedAt)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'PAID' ? 'pro' : p.status === 'LATE' ? 'performance' : 'neutral'}>
                      {STATUS_LABELS[p.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {pageItems.length === 0 ? (
                <TableEmpty>
                  <div className="space-y-1">
                    <p className="font-semibold">Aucun paiement</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Aucune écriture de paiement trouvée pour l’instant.
                    </p>
                  </div>
                </TableEmpty>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div>
            Page {page} / {totalPages || 1}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
              disabled={page >= totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      </Card>

      {selected ? (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.clientName}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {selected.project ?? '—'} · {selected.status === 'PAID' ? 'Payé' : 'En attente'}
              </p>
            </div>
            <p className="text-sm font-semibold">{formatCurrency(selected.amount)}</p>
          </div>
          {selected.note ? <p className="text-xs text-[var(--text-secondary)]">{selected.note}</p> : null}
        </Card>
      ) : null}

      <Modal open={createOpen} onCloseAction={() => setCreateOpen(false)} title="Nouvel encaissement" description="Placeholder (non implémenté).">
        <form className="space-y-3" onSubmit={onCreate}>
          <Input label="Client" value={form.clientName} onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))} />
          <Input label="Projet" value={form.project} onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))} />
          <Input label="Montant" type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
          <Select value={form.method} onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))}>
            {Object.entries(METHOD_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
