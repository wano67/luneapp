// src/app/app/pro/[businessId]/finances/payments/page.tsx
'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
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
} from '../../../pro-data';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { KpiCard } from '@/components/ui/kpi-card';

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

export default function PaymentsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

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
  const [info, setInfo] = useState<string | null>(null);

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
    const encaissements = monthPaid.reduce((sum, p) => sum + p.amount, 0);
    const late = payments.filter((p) => p.status === 'LATE');
    const lateAmount = late.reduce((sum, p) => sum + p.amount, 0);
    const delays = payments
      .filter((p) => p.status !== 'PENDING' && p.receivedAt)
      .map((p) => (buildPaymentDate(p).getTime() - new Date(p.expectedAt).getTime()) / (1000 * 60 * 60 * 24));
    const avgDelay = delays.length
      ? `${Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)} j`
      : '—';
    const overdueAmount = payments
      .filter((p) => p.status !== 'PAID' && new Date(p.expectedAt) < now)
      .reduce((sum, p) => sum + p.amount, 0);

    return [
      { label: 'Encaissements mois', value: formatCurrency(encaissements) },
      { label: 'Impayés', value: late.length.toString() },
      { label: 'Délai moyen paiement', value: avgDelay },
      { label: 'Montant en retard', value: formatCurrency(overdueAmount) },
      { label: 'Montant impayé', value: formatCurrency(lateAmount) },
    ];
  }, [payments]);

  function resetForm() {
    setForm({
      clientName: '',
      project: '',
      amount: '',
      method: 'VIREMENT',
      receivedAt: '',
      expectedAt: '',
      status: 'PAID',
      note: '',
    });
    setFormError(null);
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setInfo(null);

    const amount = Number(form.amount);
    if (!form.clientName.trim()) {
      setFormError('Client requis');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Montant invalide');
      return;
    }
    if (!form.expectedAt && !form.receivedAt) {
      setFormError('Date attendue ou reçue requise');
      return;
    }

    const receivedAt = form.receivedAt ? new Date(form.receivedAt).toISOString() : '';
    const expectedAt = form.expectedAt
      ? new Date(form.expectedAt).toISOString()
      : receivedAt || new Date().toISOString();
    const dateForFinance = receivedAt || expectedAt;

    try {
      const res = await fetchJson<{ item: FinanceApiItem }>(
        `/api/pro/businesses/${businessId}/finances`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'INCOME',
            amount,
            category: 'PAYMENT',
            date: dateForFinance,
            metadata: {
              clientName: form.clientName.trim(),
              project: form.project.trim() || undefined,
              method: form.method,
              status: form.status,
              expectedAt,
              receivedAt,
              currency: 'EUR',
              note: form.note.trim() || undefined,
            },
          }),
        }
      );

      setRequestId(res.requestId);
      if (!res.ok || !res.data) {
        setFormError(res.requestId ? `${res.error ?? 'Création impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Création impossible.');
        return;
      }

      setInfo('Paiement ajouté.');
      setCreateOpen(false);
      resetForm();
      await loadPayments();
      setSelectedId(res.data.item.id);
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Finances · Payments
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Paiements</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Suis les encaissements et les retards pour Business #{businessId}.
        </p>
        {error ? <p className="text-xs text-rose-500">{error}</p> : null}
        {requestId ? <p className="text-[10px] text-[var(--text-secondary)]">Req: {requestId}</p> : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Liste des paiements</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Table, filtres, tri et pagination.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Enregistrer un paiement
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInfo('Export CSV simulé.')}
            >
              Export CSV
            </Button>
            {info ? <span className="text-[10px] text-emerald-500">{info}</span> : null}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <Input
            label="Recherche"
            placeholder="Client, facture, projet…"
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Statut"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as PaymentStatus | 'ALL');
              setPage(1);
            }}
          >
            <option value="ALL">Tous</option>
            <option value="PAID">Payé</option>
            <option value="PENDING">En attente</option>
            <option value="LATE">En retard</option>
          </Select>
          <Select
            label="Méthode"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value as PaymentMethod | 'ALL');
              setPage(1);
            }}
          >
            <option value="ALL">Toutes</option>
            <option value="VIREMENT">Virement</option>
            <option value="CARTE">Carte</option>
            <option value="CHEQUE">Chèque</option>
            <option value="ESPECES">Espèces</option>
          </Select>
          <Select label="Tri" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="date">Date</option>
            <option value="amount">Montant</option>
            <option value="status">Statut</option>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableEmpty>Chargement des paiements…</TableEmpty>
            ) : pageItems.length === 0 ? (
              <TableEmpty>Aucun paiement ne correspond au filtre.</TableEmpty>
            ) : (
              pageItems.map((payment) => (
                <TableRow
                  key={payment.id}
                  className={payment.id === displaySelectedId ? 'bg-[var(--surface-2)]' : ''}
                  onClick={() => setSelectedId(payment.id)}
                >
                  <TableCell className="font-medium text-[var(--text-primary)]">
                    {payment.clientName}
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {payment.invoiceId ?? 'Sans facture'}
                    </p>
                  </TableCell>
                  <TableCell>{payment.project ?? '—'}</TableCell>
                  <TableCell>{formatDate(payment.receivedAt || payment.expectedAt)}</TableCell>
                  <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                  <TableCell>{METHOD_LABELS[payment.method]}</TableCell>
                  <TableCell>
                    <Badge
                      variant="neutral"
                      className={
                        payment.status === 'LATE'
                          ? 'bg-rose-100 text-rose-700'
                          : payment.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }
                    >
                      {STATUS_LABELS[payment.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Page précédente
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Page suivante
            </Button>
          </div>
          <p>
            Page {page}/{totalPages}
          </p>
        </div>
      </Card>

      {selected ? (
        <Card className="space-y-3 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Détail paiement · {selected.clientName}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {selected.project ?? 'Sans projet'} — {selected.invoiceId ?? 'Sans facture'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{STATUS_LABELS[selected.status]}</Badge>
              <Button size="sm" variant="outline">
                Relancer
              </Button>
              <Button size="sm" variant="outline">
                Exporter reçu
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Montant</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCurrency(selected.amount, selected.currency)}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Méthode {METHOD_LABELS[selected.method]}
              </p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Échéance</p>
              <p className="text-sm text-[var(--text-primary)]">
                Attendu le {formatDate(selected.expectedAt)}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Reçu le {selected.receivedAt ? formatDate(selected.receivedAt) : '—'}
              </p>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Relations</p>
              <p className="text-sm text-[var(--text-primary)]">
                {selected.invoiceId ?? 'Pas de facture'}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Projet {selected.project ?? '—'}
              </p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Historique</p>
              <p className="text-sm text-[var(--text-primary)]">
                Créé le {formatDate(buildPaymentDate(selected).toISOString())}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">Note: {selected.note ?? '—'}</p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">KPI</p>
              <p className="text-sm text-[var(--text-primary)]">
                Retard {Math.max(0, Math.round((buildPaymentDate(selected).getTime() - new Date(selected.expectedAt).getTime()) / (1000 * 60 * 60 * 24)))} j
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">Méthode {METHOD_LABELS[selected.method]}</p>
            </Card>
          </div>
        </Card>
      ) : null}

      <Modal
        open={createOpen}
        onCloseAction={() => {
          setCreateOpen(false);
          resetForm();
        }}
        title="Enregistrer un paiement"
        description="Saisie rapide pour suivre l’encaissement."
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Client"
            value={form.clientName}
            onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
          />
          <Input
            label="Projet (optionnel)"
            value={form.project}
            onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Montant"
              type="number"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
            <Select
              label="Méthode"
              value={form.method}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))
              }
            >
              <option value="VIREMENT">Virement</option>
              <option value="CARTE">Carte</option>
              <option value="CHEQUE">Chèque</option>
              <option value="ESPECES">Espèces</option>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Reçu le"
              type="date"
              value={form.receivedAt}
              onChange={(e) => setForm((prev) => ({ ...prev, receivedAt: e.target.value }))}
            />
            <Input
              label="Attendu le"
              type="date"
              value={form.expectedAt}
              onChange={(e) => setForm((prev) => ({ ...prev, expectedAt: e.target.value }))}
            />
          </div>
          <Select
            label="Statut"
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, status: e.target.value as PaymentStatus }))
            }
          >
            <option value="PAID">Payé</option>
            <option value="PENDING">En attente</option>
            <option value="LATE">En retard</option>
          </Select>
          <label className="space-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Note</span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
              rows={3}
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Référence, relance, banque…"
            />
          </label>
          <div className="flex items-center justify-between">
            {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
