"use client";

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { SectionCard, SectionHeader, KebabMenu, UI, formatDate } from '@/components/pro/projects/workspace-ui';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { getQuoteStatusLabelFR } from '@/lib/billingStatus';

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
};

export type BillingQuotesSectionProps = {
  quotes: QuoteItem[];
  isAdmin: boolean;
  isBillingEmpty: boolean;
  servicesCount: number;
  missingPriceCount: number;
  creatingQuote: boolean;
  quoteActionId: string | null;
  invoiceActionId: string | null;
  invoiceByQuoteId: Map<string, string>;
  billingReferenceId: string | null;
  referenceUpdatingId: string | null;
  businessId: string;
  onCreateQuote: () => void;
  onOpenQuoteEditor: (quote: QuoteItem) => void;
  onOpenQuoteDateModal: (quote: QuoteItem) => void;
  onSetBillingReference: (quoteId: string) => void;
  onQuoteStatus: (quoteId: string, status: 'SENT' | 'SIGNED' | 'EXPIRED') => void;
  onOpenCancelQuoteModal: (quote: QuoteItem) => void;
  onCreateInvoice: (quoteId: string) => void;
  onDeleteQuote: (quoteId: string) => void;
};

export function BillingQuotesSection({
  quotes,
  isAdmin,
  isBillingEmpty,
  servicesCount,
  missingPriceCount,
  creatingQuote,
  quoteActionId,
  invoiceActionId,
  invoiceByQuoteId,
  billingReferenceId,
  referenceUpdatingId,
  businessId,
  onCreateQuote,
  onOpenQuoteEditor,
  onOpenQuoteDateModal,
  onSetBillingReference,
  onQuoteStatus,
  onOpenCancelQuoteModal,
  onCreateInvoice,
  onDeleteQuote,
}: BillingQuotesSectionProps) {
  return (
    <SectionCard>
      <SectionHeader
        title="Devis"
        subtitle="Crée et gère les devis du projet."
        actions={
          isBillingEmpty ? null : (
            <Button
              size="sm"
              variant="outline"
              onClick={onCreateQuote}
              disabled={!servicesCount || missingPriceCount > 0 || creatingQuote || !isAdmin}
            >
              {creatingQuote ? 'Création…' : 'Nouveau devis'}
            </Button>
          )
        }
      />
      {missingPriceCount > 0 ? (
        <p className="mt-2 text-xs text-[var(--danger)]">
          Renseigne les tarifs manquants pour créer un devis.
        </p>
      ) : null}
      {quotes.length ? (
        <div className="mt-4 space-y-2">
          <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] md:gap-3">
            <span className={UI.label}>Devis</span>
            <span className={UI.label}>Statut</span>
            <span className={cn(UI.label, 'text-right')}>Total</span>
            <span className={cn(UI.label, 'text-right')}>Actions</span>
          </div>
          {quotes.map((quote) => {
            const statusLabel = getQuoteStatusLabelFR(quote.status);
            const dateLabel = formatDate(quote.issuedAt ?? quote.createdAt);
            const pdfUrl = `/api/pro/businesses/${businessId}/quotes/${quote.id}/pdf`;
            const canSend = quote.status === 'DRAFT';
            const canSign = quote.status === 'SENT';
            const canCancel =
              quote.status === 'DRAFT' || quote.status === 'SENT' || quote.status === 'SIGNED';
            const canEdit = quote.status === 'DRAFT' || quote.status === 'SENT';
            const canEditSignedDate = quote.status === 'SIGNED';
            const canDelete =
              (quote.status === 'DRAFT' || quote.status === 'CANCELLED') &&
              !invoiceByQuoteId.has(quote.id);
            const canInvoice =
              (quote.status === 'SENT' || quote.status === 'SIGNED') &&
              !invoiceByQuoteId.has(quote.id);
            const isReference = billingReferenceId === quote.id;
            const canSetReference = quote.status === 'SIGNED' && !isReference;
            return (
              <div
                key={quote.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 px-3 py-3 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] md:items-center md:gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {quote.number ?? `Devis #${quote.id}`}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">{dateLabel}</p>
                  {isReference ? (
                    <span className="mt-1 inline-flex rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                      Référence
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--text-secondary)] md:text-sm">{statusLabel}</div>
                <div className="text-right text-sm font-semibold text-[var(--text-primary)]">
                  {formatCurrencyEUR(Number(quote.totalCents), { minimumFractionDigits: 0 })}
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <KebabMenu
                    ariaLabel="Actions devis"
                    items={[
                      { label: 'PDF', href: pdfUrl, newTab: true },
                      {
                        label: 'Modifier',
                        onClick: () => onOpenQuoteEditor(quote),
                        disabled: !isAdmin || !canEdit || quoteActionId === quote.id,
                      },
                      {
                        label: 'Date signature',
                        onClick: () => onOpenQuoteDateModal(quote),
                        disabled: !isAdmin || !canEditSignedDate,
                      },
                      ...(quote.status === 'SIGNED'
                        ? [
                            {
                              label: isReference ? 'Référence' : 'Définir référence',
                              onClick: () => onSetBillingReference(quote.id),
                              disabled:
                                !isAdmin || !canSetReference || referenceUpdatingId === quote.id,
                            },
                          ]
                        : []),
                      ...(canSend
                        ? [
                            {
                              label: 'Envoyer',
                              onClick: () => onQuoteStatus(quote.id, 'SENT'),
                              disabled: !isAdmin || quoteActionId === quote.id,
                            },
                          ]
                        : []),
                      ...(canSign
                        ? [
                            {
                              label: 'Signer',
                              onClick: () => onQuoteStatus(quote.id, 'SIGNED'),
                              disabled: !isAdmin || quoteActionId === quote.id,
                            },
                          ]
                        : []),
                      ...(canCancel
                        ? [
                            {
                              label: 'Annuler',
                              onClick: () => onOpenCancelQuoteModal(quote),
                              disabled: !isAdmin || quoteActionId === quote.id,
                            },
                          ]
                        : []),
                      {
                        label: invoiceByQuoteId.has(quote.id) ? 'Facture créée' : 'Créer facture',
                        onClick: () => onCreateInvoice(quote.id),
                        disabled: !canInvoice || !isAdmin || invoiceActionId === quote.id,
                      },
                      {
                        label: 'Supprimer',
                        onClick: () => onDeleteQuote(quote.id),
                        disabled: !isAdmin || !canDelete || quoteActionId === quote.id,
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
          Aucun devis existant.
        </div>
      )}
    </SectionCard>
  );
}
