import { useMemo } from 'react';
import { formatDate } from '@/components/pro/projects/workspace-ui';
import { formatCurrencyEUR } from '@/lib/formatCurrency';

// ─── Types ──────────────────────────────────────────────────────────────────────

type BillingSummary = {
  source: 'QUOTE' | 'PRICING';
  referenceQuoteId: string | null;
  currency: string;
  totalCents: string;
  depositPercent: number;
  depositCents: string;
  balanceCents: string;
  alreadyInvoicedCents: string;
  alreadyPaidCents: string;
  remainingToCollectCents: string;
  remainingCents: string;
};

type QuoteItem = {
  id: string;
  status: string;
  number: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  depositPercent: number;
  currency: string;
  issuedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
  items?: Array<{
    id: string;
    serviceId: string | null;
    label: string;
    description?: string | null;
    quantity: number;
    unitPriceCents: string;
    totalCents: string;
  }>;
};

type InvoiceItem = {
  id: string;
  status: string;
  number: string | null;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  paidCents?: string;
  remainingCents?: string;
  paymentStatus?: string | null;
  lastPaidAt?: string | null;
  createdAt: string;
  quoteId: string | null;
};

type PricingLine = {
  id: string;
  totalCents: number;
  originalUnitPriceCents: number | null;
  billingUnit: string;
  unitLabel: string;
  missingPrice: boolean;
  priceSource: string;
};

export type SummaryTotals = {
  totalCents: number;
  totalTtcCents: number;
  vatCents: number;
  depositCents: number;
  balanceCents: number;
  depositPercent: number;
  sourceLabel: string;
};

type BillingSettings = {
  cgvText?: string | null;
  paymentTermsText?: string | null;
  lateFeesText?: string | null;
  fixedIndemnityText?: string | null;
  legalMentionsText?: string | null;
  paymentTermsDays?: number | null;
  depositPercent?: number | null;
  [key: string]: unknown;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getInvoicePaidCents(invoice: InvoiceItem): number {
  const paid = invoice.paidCents != null ? Number(invoice.paidCents) : NaN;
  if (Number.isFinite(paid)) return paid;
  return invoice.status === 'PAID' ? Number(invoice.totalCents) : 0;
}

function latestByDate<T extends { issuedAt: string | null; createdAt: string }>(items: T[]): T | null {
  return items.reduce<T | null>((acc, item) => {
    if (!acc) return item;
    const accDate = acc.issuedAt ? new Date(acc.issuedAt).getTime() : new Date(acc.createdAt).getTime();
    const itemDate = item.issuedAt ? new Date(item.issuedAt).getTime() : new Date(item.createdAt).getTime();
    return itemDate > accDate ? item : acc;
  }, null);
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

type UseBillingComputedInput = {
  project: {
    billingSummary?: BillingSummary | null;
    billingQuoteId?: string | null;
    quoteStatus?: string | null;
    depositStatus?: string | null;
    depositPaidAt?: string | null;
    valueCents?: string | null;
    endDate: string | null;
  } | null;
  quotes: QuoteItem[];
  invoices: InvoiceItem[];
  services: Array<{ id: string; [key: string]: unknown }>;
  billingSettings: BillingSettings | null;
  pricingTotals: { totalCents: number; depositCents: number; balanceCents: number; missingCount: number };
  pricingLines: PricingLine[];
  effectiveDepositPercent: number;
  vatEnabled: boolean;
  vatRatePercent: number;
  businessId: string;
  progressPct: number;
};

export function useBillingComputed(input: UseBillingComputedInput) {
  const {
    project,
    quotes,
    invoices,
    services,
    billingSettings,
    pricingTotals,
    pricingLines,
    effectiveDepositPercent,
    vatEnabled,
    vatRatePercent,
    businessId,
    progressPct,
  } = input;

  const billingSummary = project?.billingSummary ?? null;
  const billingReferenceId = billingSummary?.referenceQuoteId ?? project?.billingQuoteId ?? null;

  const billingReferenceQuote = useMemo(() => {
    if (billingReferenceId) {
      return quotes.find((quote) => quote.id === billingReferenceId) ?? null;
    }
    const candidates = quotes.filter((quote) => quote.status === 'SIGNED');
    const canUseLatest =
      project?.quoteStatus === 'SIGNED' || project?.quoteStatus === 'ACCEPTED';
    const pool = candidates.length ? candidates : canUseLatest ? quotes : [];
    if (!pool.length) return null;
    return pool.sort((a, b) => {
      const aDate = a.issuedAt ? new Date(a.issuedAt).getTime() : new Date(a.createdAt).getTime();
      const bDate = b.issuedAt ? new Date(b.issuedAt).getTime() : new Date(b.createdAt).getTime();
      return bDate - aDate;
    })[0];
  }, [billingReferenceId, project?.quoteStatus, quotes]);

  const summaryTotals: SummaryTotals = useMemo(() => {
    if (billingSummary) {
      const totalCents = Number(billingSummary.totalCents);
      const depositCents = Number(billingSummary.depositCents);
      const balanceCents = Number(billingSummary.balanceCents);
      const depositPercentValue = billingSummary.depositPercent;
      const vatCents = vatEnabled ? Math.round(totalCents * (vatRatePercent / 100)) : 0;
      const totalTtcCents = totalCents + vatCents;
      return {
        totalCents, vatCents, totalTtcCents,
        depositPercent: depositPercentValue, depositCents, balanceCents,
        sourceLabel: billingSummary.source === 'QUOTE' ? 'Devis signé' : 'Services projet',
      };
    }
    const signedTotal = billingReferenceQuote ? Number(billingReferenceQuote.totalCents) : null;
    const totalCents = Number.isFinite(signedTotal ?? NaN) ? (signedTotal as number) : pricingTotals.totalCents;
    const depositPercentValue = billingReferenceQuote?.depositPercent ?? effectiveDepositPercent;
    const depositCents = billingReferenceQuote ? Number(billingReferenceQuote.depositCents) : pricingTotals.depositCents;
    const balanceCents = billingReferenceQuote ? Number(billingReferenceQuote.balanceCents) : pricingTotals.balanceCents;
    const vatCents = vatEnabled ? Math.round(totalCents * (vatRatePercent / 100)) : 0;
    const totalTtcCents = totalCents + vatCents;
    return {
      totalCents, vatCents, totalTtcCents,
      depositPercent: depositPercentValue, depositCents, balanceCents,
      sourceLabel: billingReferenceQuote ? 'Devis signé' : 'Services projet',
    };
  }, [billingSummary, billingReferenceQuote, effectiveDepositPercent, pricingTotals.balanceCents, pricingTotals.depositCents, pricingTotals.totalCents, vatEnabled, vatRatePercent]);

  const depositPercentLabel = Number.isFinite(summaryTotals.depositPercent) ? `${summaryTotals.depositPercent}%` : '—';
  const depositPaidLabel = formatDate(project?.depositPaidAt ?? null);
  const canEditDepositPaidDate = project?.depositStatus === 'PAID';

  const alreadyInvoicedCents = useMemo(() => {
    if (billingSummary) return Number(billingSummary.alreadyInvoicedCents);
    return invoices
      .filter((inv) => inv.status !== 'CANCELLED')
      .reduce((sum, inv) => sum + Number(inv.totalCents), 0);
  }, [billingSummary, invoices]);

  const alreadyPaidCents = useMemo(() => {
    if (billingSummary) return Number(billingSummary.alreadyPaidCents);
    return invoices.reduce((sum, inv) => sum + getInvoicePaidCents(inv), 0);
  }, [billingSummary, invoices]);

  const remainingToCollectCents = billingSummary
    ? Number(billingSummary.remainingToCollectCents)
    : Math.max(0, alreadyInvoicedCents - alreadyPaidCents);

  const remainingToInvoiceCents = billingSummary
    ? Number(billingSummary.remainingCents)
    : Math.max(0, summaryTotals.totalCents - alreadyInvoicedCents);

  const latestQuote = useMemo(() => latestByDate(quotes), [quotes]);
  const latestInvoice = useMemo(() => latestByDate(invoices), [invoices]);

  const latestPdf = useMemo(() => {
    if (!latestQuote && !latestInvoice) return null;
    const quoteDate = latestQuote
      ? latestQuote.issuedAt ? new Date(latestQuote.issuedAt).getTime() : new Date(latestQuote.createdAt).getTime()
      : 0;
    const invoiceDate = latestInvoice
      ? latestInvoice.issuedAt ? new Date(latestInvoice.issuedAt).getTime() : new Date(latestInvoice.createdAt).getTime()
      : 0;
    if (latestInvoice && invoiceDate >= quoteDate) {
      return { url: `/api/pro/businesses/${businessId}/invoices/${latestInvoice.id}/pdf`, label: latestInvoice.number ?? `Facture #${latestInvoice.id}` };
    }
    if (latestQuote) {
      return { url: `/api/pro/businesses/${businessId}/quotes/${latestQuote.id}/pdf`, label: latestQuote.number ?? `Devis #${latestQuote.id}` };
    }
    return null;
  }, [businessId, latestInvoice, latestQuote]);

  const legalBlocks = useMemo(() => {
    const blocks = [
      { label: 'CGV', value: billingSettings?.cgvText },
      { label: 'Paiement', value: billingSettings?.paymentTermsText },
      { label: 'Pénalités', value: billingSettings?.lateFeesText },
      { label: 'Indemnité', value: billingSettings?.fixedIndemnityText },
      { label: 'Mentions', value: billingSettings?.legalMentionsText },
    ];
    const filled = blocks.filter((block) => (block.value ?? '').trim()).length;
    return { blocks, filled, total: blocks.length };
  }, [billingSettings]);

  const legalConfigured = Boolean((billingSettings?.cgvText ?? '').trim());

  const invoiceByQuoteId = useMemo(() => {
    const map = new Map<string, string>();
    invoices.forEach((inv) => { if (inv.quoteId) map.set(inv.quoteId, inv.id); });
    return map;
  }, [invoices]);

  const pricingByServiceId = useMemo(() => {
    return new Map(pricingLines.map((line) => [line.id, line]));
  }, [pricingLines]);

  const projectValueCents = useMemo(() => {
    const raw = project?.valueCents ?? project?.billingSummary?.totalCents;
    if (raw != null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (services.length) return pricingTotals.totalCents;
    return null;
  }, [project?.billingSummary?.totalCents, project?.valueCents, pricingTotals.totalCents, services.length]);

  const kpis = useMemo(() => {
    return [
      { label: 'Avancement', value: `${Math.min(100, Math.max(0, progressPct))}%` },
      { label: 'Valeur', value: projectValueCents !== null ? formatCurrencyEUR(projectValueCents, { minimumFractionDigits: 0 }) : '—' },
      { label: 'Échéance', value: formatDate(project?.endDate ?? null) },
    ];
  }, [projectValueCents, progressPct, project?.endDate]);

  return {
    billingReferenceId,
    billingReferenceQuote,
    summaryTotals,
    depositPercentLabel,
    depositPaidLabel,
    canEditDepositPaidDate,
    alreadyInvoicedCents,
    alreadyPaidCents,
    remainingToCollectCents,
    remainingToInvoiceCents,
    latestQuote,
    latestInvoice,
    latestPdf,
    legalBlocks,
    legalConfigured,
    invoiceByQuoteId,
    pricingByServiceId,
    projectValueCents,
    kpis,
  };
}
