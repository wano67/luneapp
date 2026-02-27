"use client";

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { SectionCard, SectionHeader, KebabMenu, UI, formatDate } from '@/components/pro/projects/workspace-ui';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { getInvoiceStatusLabelFR, getPaymentStatusLabelFR } from '@/lib/billingStatus';

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

// Helpers — mirrored from ProjectWorkspace (pure functions, no external deps)
function normalizePaymentStatus(value?: string | null): 'UNPAID' | 'PARTIAL' | 'PAID' | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === 'PARTIALLY_PAID' || upper === 'PARTIAL') return 'PARTIAL';
  if (upper === 'PAID') return 'PAID';
  if (upper === 'UNPAID') return 'UNPAID';
  return null;
}

function getInvoicePaidCents(invoice: InvoiceItem): number {
  const paid = invoice.paidCents != null ? Number(invoice.paidCents) : NaN;
  if (Number.isFinite(paid)) return paid;
  return invoice.status === 'PAID' ? Number(invoice.totalCents) : 0;
}

function getInvoiceRemainingCents(invoice: InvoiceItem): number {
  const remaining = invoice.remainingCents != null ? Number(invoice.remainingCents) : NaN;
  if (Number.isFinite(remaining)) return Math.max(0, remaining);
  return Math.max(0, Number(invoice.totalCents) - getInvoicePaidCents(invoice));
}

function getInvoicePaymentStatus(invoice: InvoiceItem): 'UNPAID' | 'PARTIAL' | 'PAID' {
  const normalized = normalizePaymentStatus(invoice.paymentStatus);
  if (normalized) return normalized;
  const paid = getInvoicePaidCents(invoice);
  const total = Number(invoice.totalCents);
  if (paid >= total && total > 0) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'UNPAID';
}

export type BillingInvoicesSectionProps = {
  invoices: InvoiceItem[];
  isAdmin: boolean;
  isBillingEmpty: boolean;
  summaryTotalCents: number;
  remainingToInvoiceCents: number;
  invoiceActionId: string | null;
  businessId: string;
  onOpenStagedInvoiceModal: (kind: 'DEPOSIT' | 'MID' | 'FINAL') => void;
  onOpenPaymentModal: (invoice: InvoiceItem, remainingCents?: number) => void;
  onOpenInvoiceEditor: (invoiceId: string) => void;
  onOpenInvoiceDateModal: (invoice: InvoiceItem) => void;
  onInvoiceStatus: (invoiceId: string, status: 'SENT' | 'CANCELLED') => void;
  onDeleteInvoice: (invoiceId: string) => void;
};

export function BillingInvoicesSection({
  invoices,
  isAdmin,
  isBillingEmpty,
  summaryTotalCents,
  remainingToInvoiceCents,
  invoiceActionId,
  businessId,
  onOpenStagedInvoiceModal,
  onOpenPaymentModal,
  onOpenInvoiceEditor,
  onOpenInvoiceDateModal,
  onInvoiceStatus,
  onDeleteInvoice,
}: BillingInvoicesSectionProps) {
  return (
    <SectionCard>
      <SectionHeader
        title="Factures"
        subtitle="Générées à partir des devis envoyés/signés ou en facturation par étapes."
        actions={
          isBillingEmpty ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenStagedInvoiceModal('DEPOSIT')}
                disabled={!isAdmin || summaryTotalCents <= 0}
              >
                Facture d&apos;acompte
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenStagedInvoiceModal('MID')}
                disabled={!isAdmin || summaryTotalCents <= 0}
              >
                Facture intermédiaire
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenStagedInvoiceModal('FINAL')}
                disabled={!isAdmin || remainingToInvoiceCents <= 0}
              >
                Facture finale
              </Button>
            </div>
          )
        }
      />
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        Reste à facturer : {formatCurrencyEUR(remainingToInvoiceCents, { minimumFractionDigits: 0 })}
      </p>
      {invoices.length ? (
        <div className="mt-4 space-y-2">
          <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] md:gap-3">
            <span className={UI.label}>Facture</span>
            <span className={UI.label}>Statut</span>
            <span className={cn(UI.label, 'text-right')}>Total</span>
            <span className={cn(UI.label, 'text-right')}>Actions</span>
          </div>
          {invoices.map((invoice) => {
            const statusLabel = getInvoiceStatusLabelFR(invoice.status);
            const paymentStatusLabel = getPaymentStatusLabelFR(getInvoicePaymentStatus(invoice));
            const dateLabel = formatDate(invoice.issuedAt ?? invoice.createdAt);
            const pdfUrl = `/api/pro/businesses/${businessId}/invoices/${invoice.id}/pdf`;
            const detailUrl = `/app/pro/${businessId}/finances/invoices/${invoice.id}`;
            const paidCents = getInvoicePaidCents(invoice);
            const remainingCents = getInvoiceRemainingCents(invoice);
            const canSend = invoice.status === 'DRAFT';
            const canCancel = invoice.status === 'DRAFT' || invoice.status === 'SENT';
            const canEdit = invoice.status === 'DRAFT' || invoice.status === 'SENT';
            const canEditPaidDate = invoice.status === 'PAID';
            const canDelete = invoice.status === 'DRAFT' || invoice.status === 'CANCELLED';
            const canManagePayments = invoice.status === 'SENT' || invoice.status === 'PAID';
            const canMarkPaid = canManagePayments && remainingCents > 0;
            return (
              <div
                key={invoice.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 px-3 py-3 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] md:items-center md:gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {invoice.number ?? `Facture #${invoice.id}`}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">{dateLabel}</p>
                </div>
                <div className="text-xs text-[var(--text-secondary)] md:text-sm">
                  <span>{statusLabel}</span>
                  <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">
                    {paymentStatusLabel}
                  </span>
                </div>
                <div className="text-right text-sm font-semibold text-[var(--text-primary)]">
                  {formatCurrencyEUR(Number(invoice.totalCents), { minimumFractionDigits: 0 })}
                  <div className="mt-1 text-[11px] font-normal text-[var(--text-secondary)]">
                    Payé {formatCurrencyEUR(paidCents, { minimumFractionDigits: 0 })} · Reste{' '}
                    {formatCurrencyEUR(remainingCents, { minimumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <KebabMenu
                    ariaLabel="Actions facture"
                    items={[
                      { label: 'PDF', href: pdfUrl, newTab: true },
                      ...(canManagePayments
                        ? [
                            {
                              label: 'Paiements',
                              onClick: () => onOpenPaymentModal(invoice),
                              disabled: !isAdmin,
                            },
                          ]
                        : []),
                      {
                        label: 'Modifier',
                        onClick: () => onOpenInvoiceEditor(invoice.id),
                        disabled: !isAdmin || !canEdit || invoiceActionId === invoice.id,
                      },
                      {
                        label: 'Date paiement',
                        onClick: () => onOpenInvoiceDateModal(invoice),
                        disabled: !isAdmin || !canEditPaidDate,
                      },
                      ...(canSend
                        ? [
                            {
                              label: 'Envoyer',
                              onClick: () => onInvoiceStatus(invoice.id, 'SENT'),
                              disabled: !isAdmin || invoiceActionId === invoice.id,
                            },
                          ]
                        : []),
                      ...(canMarkPaid
                        ? [
                            {
                              label: 'Solder la facture',
                              onClick: () => onOpenPaymentModal(invoice, remainingCents),
                              disabled: !isAdmin || invoiceActionId === invoice.id,
                            },
                          ]
                        : []),
                      ...(canCancel
                        ? [
                            {
                              label: 'Annuler',
                              onClick: () => onInvoiceStatus(invoice.id, 'CANCELLED'),
                              disabled: !isAdmin || invoiceActionId === invoice.id,
                            },
                          ]
                        : []),
                      { label: 'Voir', href: detailUrl },
                      {
                        label: 'Supprimer',
                        onClick: () => onDeleteInvoice(invoice.id),
                        disabled: !isAdmin || !canDelete || invoiceActionId === invoice.id,
                        tone: 'danger' as const,
                      },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cn(UI.sectionSoft, 'mt-4 text-xs text-[var(--text-secondary)]')}>
          Aucune facture pour le moment.
        </div>
      )}
    </SectionCard>
  );
}
