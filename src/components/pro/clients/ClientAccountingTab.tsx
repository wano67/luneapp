import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';

type SummaryResponse = {
  totals: { invoicedCents: number; paidCents: number; outstandingCents: number };
  invoices: Array<{
    id: string;
    number: string | null;
    status: string;
    totalCents: number;
    currency: string;
    issuedAt: string | null;
    dueAt: string | null;
    projectName: string | null;
  }>;
  payments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    paidAt: string;
    reference: string | null;
  }>;
};

type Props = {
  businessId: string;
  clientId: string;
  initialData?: SummaryResponse | null;
  alreadyLoaded?: boolean;
  onSummaryChange?: (data: SummaryResponse | null) => void;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

function formatStatus(status: string) {
  if (status === 'PAID') return 'Payée';
  if (status === 'SENT') return 'Envoyée';
  if (status === 'DRAFT') return 'Brouillon';
  if (status === 'CANCELLED') return 'Annulée';
  return status ?? '—';
}

export function ClientAccountingTab({ businessId, clientId, initialData, alreadyLoaded, onSummaryChange }: Props) {
  const [data, setData] = useState<SummaryResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!(alreadyLoaded && initialData));
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<{ invoiceId: string; amount: string; date: string }>({
    invoiceId: '',
    amount: '',
    date: '',
  });

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    if (alreadyLoaded && initialData) return;
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchJson<SummaryResponse>(
          `/api/pro/businesses/${businessId}/accounting/client/${clientId}/summary`,
          { cache: 'no-store' },
        );
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setError(res.error ?? 'Comptabilité indisponible');
          setData(null);
          onSummaryChange?.(null);
          return;
        }
        setData(res.data);
        onSummaryChange?.(res.data);
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [alreadyLoaded, businessId, clientId, initialData, onSummaryChange]);

  const invoiceOptions = useMemo(() => data?.invoices ?? [], [data]);

  const refreshSummary = useCallback(async () => {
    const res = await fetchJson<SummaryResponse>(
      `/api/pro/businesses/${businessId}/accounting/client/${clientId}/summary`,
      { cache: 'no-store' },
    );
    if (res.ok && res.data) {
      setData(res.data);
      onSummaryChange?.(res.data);
    }
    return res.ok;
  }, [businessId, clientId, onSummaryChange]);

  async function handlePaymentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const amountNumber = Number(form.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setFormError('Montant invalide');
      return;
    }
    const body: Record<string, unknown> = {
      clientId,
      invoiceId: form.invoiceId || undefined,
      amount: amountNumber,
      date: form.date || undefined,
    };
    try {
      setSaving(true);
      const res = await fetchJson(`/api/pro/businesses/${businessId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setFormError(res.error ?? 'Paiement impossible');
        return;
      }
      setModalOpen(false);
      setForm({ invoiceId: '', amount: '', date: '' });
      await refreshSummary();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 text-sm text-rose-500 shadow-sm">
          {error}
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Factures</p>
              <p className="text-xs text-[var(--text-secondary)]">12 derniers mois · 10 récentes</p>
            </div>
            <Link
              href={`/app/pro/${businessId}/finances`}
              className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Voir finances
            </Link>
          </div>

          {loading ? (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-14 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />
              ))}
            </div>
          ) : data?.invoices?.length ? (
            <div className="mt-3 space-y-2">
              {data.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-1 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-hover)]/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {inv.number ?? `Facture #${inv.id}`}
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      {inv.projectName ? `${inv.projectName} · ` : ''}
                      {formatDate(inv.issuedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm sm:justify-end">
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                      {formatStatus(inv.status)}
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatCurrencyEUR(inv.totalCents)}
                    </span>
                    {inv.status !== 'PAID' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          const res = await fetchJson(`/api/pro/businesses/${businessId}/invoices/${inv.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'PAID' }),
                          });
                          if (res.ok) {
                            await refreshSummary();
                          }
                        }}
                      >
                        Marquer payé
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 p-4 text-sm text-[var(--text-secondary)]">
              Aucune facture récente pour ce client.
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Paiements</p>
              <p className="text-xs text-[var(--text-secondary)]">Basés sur factures payées</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setModalOpen(true)}
            >
              Ajouter un paiement
            </Button>
          </div>
          {loading ? (
            <div className="mt-3 space-y-2">
              {[0, 1].map((key) => (
                <div key={key} className="h-14 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />
              ))}
            </div>
          ) : data?.payments?.length ? (
            <div className="mt-3 space-y-2">
              {data.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-1 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-hover)]/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {p.reference ?? `Paiement #${p.id}`}
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)]">{formatDate(p.paidAt)}</p>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {formatCurrencyEUR(p.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 p-4 text-sm text-[var(--text-secondary)]">
              Aucun paiement enregistré pour ce client.
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onCloseAction={() => (!saving ? setModalOpen(false) : null)}
        title="Ajouter un paiement"
        description="Associez le paiement à une facture pour le suivi."
      >
        <form className="space-y-3" onSubmit={handlePaymentSubmit}>
          <Input
            label="Montant (€)"
            type="number"
            required
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            min="0"
            step="0.01"
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
          />
          <label className="space-y-1 text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Facture (optionnel)</span>
            <select
              value={form.invoiceId}
              onChange={(e) => setForm((prev) => ({ ...prev, invoiceId: e.target.value }))}
              className="w-full cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <option value="">Sans facture</option>
              {invoiceOptions.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number ?? `Facture #${inv.id}`} — {formatCurrencyEUR(inv.totalCents)}
                </option>
              ))}
            </select>
          </label>
          {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className="bg-neutral-900 text-white hover:bg-neutral-800">
              {saving ? 'Enregistrement…' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
