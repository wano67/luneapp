"use client";

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { UI, SectionCard, SectionHeader, formatDate } from '@/components/pro/projects/workspace-ui';
import { getInvoiceStatusLabelFR, getQuoteStatusLabelFR } from '@/lib/billingStatus';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import type { ProjectDocument } from '@/components/pro/projects/hooks/useProjectDataLoaders';

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
  projectDocuments: ProjectDocument[];
  uploading: boolean;
  isAdmin: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function FileUploadZone({
  label,
  uploading,
  disabled,
  onFile,
}: {
  label: string;
  uploading: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || disabled) return;
      onFile(files[0]);
    },
    [disabled, onFile]
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        'flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors',
        dragOver
          ? 'border-[var(--accent)] bg-[var(--surface-hover)] text-[var(--text-primary)]'
          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]',
        disabled ? 'cursor-not-allowed opacity-60' : ''
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.docx,.xlsx,.zip,.txt"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        disabled={disabled}
        className="hidden"
      />
      {uploading ? 'Upload en cours…' : label}
    </div>
  );
}

export function FilesTab({
  quotes,
  invoices,
  businessId,
  projectId,
  projectDocuments,
  uploading,
  isAdmin,
  onUpload,
  onDelete,
}: FilesTabProps) {
  const downloadUrl = (docId: string) =>
    `/api/pro/businesses/${businessId}/projects/${projectId}/documents/${docId}`;

  return (
    <div className="space-y-5">
      {/* Documents générés (quotes/invoices PDFs) */}
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
                        <a href={pdfUrl} target="_blank" rel="noreferrer">PDF</a>
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
                        <a href={pdfUrl} target="_blank" rel="noreferrer">PDF</a>
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

      {/* Documents projet (uploaded files) */}
      <SectionCard>
        <SectionHeader
          title="Documents projet"
          subtitle="Charte graphique, logos, briefs, etc."
          actions={
            isAdmin ? (
              <FileUploadZone
                label="Ajouter un fichier"
                uploading={uploading}
                disabled={uploading}
                onFile={(file) => void onUpload(file)}
              />
            ) : null
          }
        />
        {projectDocuments.length ? (
          <div className="mt-3 space-y-2">
            {projectDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={16} className="shrink-0 text-[var(--text-secondary)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{doc.title}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild size="sm" variant="ghost">
                    <a href={downloadUrl(doc.id)} download title="Télécharger">
                      <Download size={14} />
                    </a>
                  </Button>
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void onDelete(doc.id)}
                      title="Supprimer"
                    >
                      <Trash2 size={14} className="text-[var(--danger)]" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Aucun document projet pour l&apos;instant.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
