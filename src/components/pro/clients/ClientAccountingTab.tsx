import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';

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

type QuoteItem = {
  id: string;
  number: string | null;
  status: string;
  totalCents: number;
  issuedAt: string | null;
  currency: string;
  pdfUrl: string;
};

type InvoiceItem = {
  id: string;
  number: string | null;
  status: string;
  totalCents: number;
  issuedAt: string | null;
  currency: string;
  pdfUrl: string;
};

type DocumentsResponse = {
  invoices?: InvoiceItem[];
  quotes?: QuoteItem[];
  warning?: string;
};

type Props = {
  businessId: string;
  clientId: string;
  initialData?: SummaryResponse | null;
  alreadyLoaded?: boolean;
  onSummaryChange?: (data: SummaryResponse | null) => void;
};

function formatDate(value: string | null | undefined) {
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
  if (status === 'SIGNED') return 'Signé';
  if (status === 'ACCEPTED') return 'Accepté';
  if (status === 'EXPIRED') return 'Expiré';
  return status || '—';
}

function formatAmount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatCurrencyEUR(value);
}

export function ClientAccountingTab({ businessId, clientId, initialData, alreadyLoaded, onSummaryChange }: Props) {
  const [summary, setSummary] = useState<SummaryResponse | null>(initialData ?? null);
  const [summaryLoading, setSummaryLoading] = useState(!(alreadyLoaded && initialData));
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentsResponse | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setSummary(initialData);
      setSummaryLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    if (alreadyLoaded && initialData) return;
    let cancelled = false;
    async function load() {
      try {
        setSummaryLoading(true);
        setSummaryError(null);
        const res = await fetchJson<SummaryResponse>(
          `/api/pro/businesses/${businessId}/accounting/client/${clientId}/summary`,
          { cache: 'no-store' },
        );
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setSummaryError(res.error ?? 'Résumé facturation indisponible');
          setSummary(null);
          onSummaryChange?.(null);
          return;
        }
        setSummary(res.data);
        onSummaryChange?.(res.data);
      } catch (err) {
        if (cancelled) return;
        setSummaryError(getErrorMessage(err));
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [alreadyLoaded, businessId, clientId, initialData, onSummaryChange]);

  useEffect(() => {
    let cancelled = false;
    async function loadDocuments() {
      try {
        setDocumentsLoading(true);
        setDocumentsError(null);
        const res = await fetchJson<DocumentsResponse>(
          `/api/pro/businesses/${businessId}/clients/${clientId}/documents`,
          { cache: 'no-store' },
        );
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setDocumentsError(res.error ?? 'Devis et factures indisponibles');
          setDocuments(null);
          return;
        }
        setDocuments(res.data);
      } catch (err) {
        if (cancelled) return;
        setDocumentsError(getErrorMessage(err));
      } finally {
        if (!cancelled) setDocumentsLoading(false);
      }
    }
    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [businessId, clientId]);

  const quotes = documents?.quotes ?? [];
  const invoices = documents?.invoices ?? [];

  const totalQuotedCents = useMemo(() => {
    const quoteItems = documents?.quotes;
    if (!quoteItems) return null;
    return quoteItems.reduce((sum, q) => sum + (Number.isFinite(q.totalCents) ? q.totalCents : 0), 0);
  }, [documents]);

  const totals = summary?.totals ?? null;

  return (
    <div className="space-y-4">
      {summaryError ? (
        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 text-sm text-rose-500 shadow-sm">
          {summaryError}
        </Card>
      ) : null}
      {documentsError ? (
        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 text-sm text-rose-500 shadow-sm">
          {documentsError}
        </Card>
      ) : null}

      <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Facturation</p>
            <p className="text-xs text-[var(--text-secondary)]">Synthèse client</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem
            label="Total devis"
            value={documentsLoading ? '—' : formatAmount(totalQuotedCents)}
          />
          <SummaryItem
            label="Total facturé"
            value={summaryLoading ? '—' : formatAmount(totals?.invoicedCents)}
          />
          <SummaryItem
            label="Total payé"
            value={summaryLoading ? '—' : formatAmount(totals?.paidCents)}
          />
          <SummaryItem
            label="Reste à encaisser"
            value={summaryLoading ? '—' : formatAmount(totals?.outstandingCents)}
          />
        </div>
      </Card>

      <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Devis</p>
            <p className="text-xs text-[var(--text-secondary)]">Derniers devis disponibles</p>
          </div>
        </div>
        {documentsLoading ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-12 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />
            ))}
          </div>
        ) : quotes.length ? (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_100px_120px_120px_80px] gap-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              <span>Numéro</span>
              <span>Date</span>
              <span>Statut</span>
              <span className="text-right">Montant</span>
              <span className="text-right">PDF</span>
            </div>
            {quotes.map((quote) => (
              <div
                key={quote.id}
                className="grid grid-cols-[minmax(0,1fr)_100px_120px_120px_80px] items-center gap-3 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-hover)]/40 px-3 py-2 text-sm"
              >
                <span className="truncate font-semibold text-[var(--text-primary)]">
                  {quote.number ?? `DEV-${quote.id}`}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">{formatDate(quote.issuedAt)}</span>
                <span className="text-xs text-[var(--text-secondary)]">{formatStatus(quote.status)}</span>
                <span className="text-right font-semibold text-[var(--text-primary)]">
                  {formatAmount(quote.totalCents)}
                </span>
                <div className="text-right">
                  <Link
                    href={quote.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[var(--text-primary)] underline underline-offset-4"
                  >
                    Voir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 p-4 text-sm text-[var(--text-secondary)]">
            Aucun devis disponible pour ce client.
          </div>
        )}
      </Card>

      <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Factures</p>
            <p className="text-xs text-[var(--text-secondary)]">Dernières factures disponibles</p>
          </div>
        </div>
        {documentsLoading ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-12 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />
            ))}
          </div>
        ) : invoices.length ? (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_100px_120px_120px_80px] gap-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              <span>Numéro</span>
              <span>Date</span>
              <span>Statut</span>
              <span className="text-right">Montant</span>
              <span className="text-right">PDF</span>
            </div>
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-[minmax(0,1fr)_100px_120px_120px_80px] items-center gap-3 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-hover)]/40 px-3 py-2 text-sm"
              >
                <span className="truncate font-semibold text-[var(--text-primary)]">
                  {invoice.number ?? `INV-${invoice.id}`}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">{formatDate(invoice.issuedAt)}</span>
                <span className="text-xs text-[var(--text-secondary)]">{formatStatus(invoice.status)}</span>
                <span className="text-right font-semibold text-[var(--text-primary)]">
                  {formatAmount(invoice.totalCents)}
                </span>
                <div className="text-right">
                  <Link
                    href={invoice.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[var(--text-primary)] underline underline-offset-4"
                  >
                    Voir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 p-4 text-sm text-[var(--text-secondary)]">
            Aucune facture disponible pour ce client.
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-hover)]/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
