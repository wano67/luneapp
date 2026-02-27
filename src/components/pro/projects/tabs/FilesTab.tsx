"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { UI, SectionCard, SectionHeader, formatDate } from '@/components/pro/projects/workspace-ui';
import { getInvoiceStatusLabelFR, getQuoteStatusLabelFR } from '@/lib/billingStatus';
import { formatCurrencyEUR } from '@/lib/formatCurrency';

type FilesTabQuote = {
  id: string;
  status: string;
  number: string | null;
  totalCents: string;
  issuedAt: string | null;
  createdAt: string;
};

type FilesTabInvoice = {
  id: string;
  status: string;
  number: string | null;
  totalCents: string;
  issuedAt: string | null;
  createdAt: string;
};

export type FilesTabProps = {
  quotes: FilesTabQuote[];
  invoices: FilesTabInvoice[];
  businessId: string;
  projectId: string;
};

export function FilesTab({ quotes, invoices, businessId, projectId }: FilesTabProps) {
  return (
    <div className="space-y-5">
      <SectionCard>
        <SectionHeader
          title="Documents générés"
          subtitle="Devis et factures exportables du projet."
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/pro/${businessId}/projects/${projectId}?tab=billing`}>
                Ouvrir la facturation
              </Link>
            </Button>
          }
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className={UI.label}>Devis</p>
            {quotes.length ? (
              quotes.map((quote) => {
                const statusLabel = getQuoteStatusLabelFR(quote.status);
                const dateLabel = formatDate(quote.issuedAt ?? quote.createdAt);
                const pdfUrl = `/api/pro/businesses/${businessId}/quotes/${quote.id}/pdf`;
                return (
                  <div key={quote.id} className={cn(UI.sectionSoft, 'flex items-center justify-between gap-2')}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {quote.number ?? `Devis #${quote.id}`}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {statusLabel} · {dateLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrencyEUR(Number(quote.totalCents), { minimumFractionDigits: 0 })}
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <a href={pdfUrl} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>
                Aucun devis généré.
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className={UI.label}>Factures</p>
            {invoices.length ? (
              invoices.map((invoice) => {
                const statusLabel = getInvoiceStatusLabelFR(invoice.status);
                const dateLabel = formatDate(invoice.issuedAt ?? invoice.createdAt);
                const pdfUrl = `/api/pro/businesses/${businessId}/invoices/${invoice.id}/pdf`;
                return (
                  <div key={invoice.id} className={cn(UI.sectionSoft, 'flex items-center justify-between gap-2')}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {invoice.number ?? `Facture #${invoice.id}`}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {statusLabel} · {dateLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrencyEUR(Number(invoice.totalCents), { minimumFractionDigits: 0 })}
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <a href={pdfUrl} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>
                Aucune facture générée.
              </div>
            )}
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="Administratif" actions={<Button size="sm" variant="outline">Upload</Button>} />
        <p className={UI.sectionSubtitle}>Aucun document administratif.</p>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="Projet" actions={<Button size="sm" variant="outline">Upload</Button>} />
        <p className={UI.sectionSubtitle}>Aucun document projet pour l&apos;instant.</p>
      </SectionCard>
    </div>
  );
}
