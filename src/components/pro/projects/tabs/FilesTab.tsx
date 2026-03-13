"use client";

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Trash2, Download, FolderOpen, FolderPlus, ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUploadZone } from '@/components/ui/file-upload-zone';
import { cn } from '@/lib/cn';
import { UI, SectionCard, SectionHeader, formatDate } from '@/components/pro/projects/workspace-ui';
import { getInvoiceStatusLabelFR, getQuoteStatusLabelFR } from '@/lib/billingStatus';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { DocumentPreviewModal } from '@/components/pro/projects/DocumentPreviewModal';
import { useFolderNavigation } from '@/components/pro/projects/hooks/useFolderNavigation';
import type { FolderDocument } from '@/components/pro/projects/hooks/useFolderNavigation';

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
  uploading: boolean;
  isAdmin: boolean;
  onUpload: (file: File, folderId?: string | null) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const PREVIEWABLE_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

export function FilesTab({
  quotes,
  invoices,
  businessId,
  projectId,
  uploading,
  isAdmin,
  onUpload,
  onDelete,
}: FilesTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<FolderDocument | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleError = useCallback((msg: string | null) => setError(msg), []);

  const {
    currentFolderId,
    folderPath,
    folders,
    documents,
    loading,
    navigateToFolder,
    navigateToBreadcrumb,
    createFolder,
    renameFolder,
    deleteFolder,
    refresh,
  } = useFolderNavigation({ businessId, projectId, onError: handleError });

  const viewUrl = (docId: string) =>
    `/api/pro/businesses/${businessId}/documents/${docId}/view`;
  const downloadUrl = (docId: string) =>
    `/api/pro/businesses/${businessId}/projects/${projectId}/documents/${docId}`;

  function handleDocumentClick(doc: FolderDocument) {
    if (PREVIEWABLE_MIMES.has(doc.mimeType)) {
      setPreviewDoc(doc);
    } else {
      window.open(downloadUrl(doc.id), '_blank');
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const ok = await createFolder(name);
    if (ok) {
      setCreatingFolder(false);
      setNewFolderName('');
    }
  }

  async function handleRenameFolder(folderId: string) {
    const name = renameValue.trim();
    if (!name) return;
    const ok = await renameFolder(folderId, name);
    if (ok) {
      setRenamingFolder(null);
      setRenameValue('');
    }
  }

  async function handleDeleteDocument(docId: string) {
    await onDelete(docId);
    refresh();
  }

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

      {/* Documents projet (folder-based) */}
      <SectionCard>
        <SectionHeader
          title="Documents projet"
          subtitle="Charte graphique, logos, briefs, etc."
          actions={
            isAdmin ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setCreatingFolder(true); setNewFolderName(''); }}>
                  <FolderPlus size={14} className="mr-1" />
                  Dossier
                </Button>
                <FileUploadZone
                  label="Ajouter un fichier"
                  uploading={uploading}
                  disabled={uploading}
                  onFile={(file) => void onUpload(file, currentFolderId)}
                />
              </div>
            ) : null
          }
        />

        {error && (
          <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>
        )}

        {/* Breadcrumb */}
        {folderPath.length > 1 && (
          <div className="mt-3 flex items-center gap-1 text-xs flex-wrap">
            {folderPath.map((crumb, i) => (
              <span key={crumb.id ?? 'root'} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={10} className="text-[var(--text-faint)]" />}
                <button
                  type="button"
                  onClick={() => navigateToBreadcrumb(i)}
                  className={cn(
                    'px-1.5 py-0.5 rounded transition-colors',
                    i === folderPath.length - 1
                      ? 'font-semibold text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  )}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Create folder inline */}
        {creatingFolder && (
          <div className="mt-3 flex items-center gap-2">
            <FolderOpen size={16} className="shrink-0 text-[var(--text-secondary)]" />
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateFolder();
                if (e.key === 'Escape') setCreatingFolder(false);
              }}
              placeholder="Nom du dossier"
              className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
              style={{ color: 'var(--text-primary)' }}
            />
            <Button size="sm" onClick={() => void handleCreateFolder()} disabled={!newFolderName.trim()}>
              Créer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreatingFolder(false)}>
              Annuler
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="mt-3 flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--text-faint)] border-t-[var(--accent)]" />
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            {/* Folders */}
            {folders.map((folder) => (
              <div
                key={`f-${folder.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
              >
                {renamingFolder === folder.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <FolderOpen size={16} className="shrink-0 text-[var(--accent)]" />
                    <input
                      type="text"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRenameFolder(folder.id);
                        if (e.key === 'Escape') setRenamingFolder(null);
                      }}
                      className="flex-1 rounded border border-[var(--border)] bg-transparent px-1.5 py-0.5 text-sm outline-none focus:border-[var(--accent)]"
                      style={{ color: 'var(--text-primary)' }}
                    />
                    <Button size="sm" variant="ghost" onClick={() => void handleRenameFolder(folder.id)}>OK</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenamingFolder(null)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <>
                    <div
                      className="flex flex-1 min-w-0 items-center gap-2"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigateToFolder(folder.id, folder.name)}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigateToFolder(folder.id, folder.name); }}
                    >
                      <FolderOpen size={16} className="shrink-0 text-[var(--accent)]" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{folder.name}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {folder._count.children > 0 ? `${folder._count.children} dossier${folder._count.children > 1 ? 's' : ''}` : ''}
                          {folder._count.children > 0 && folder._count.documents > 0 ? ' \u00b7 ' : ''}
                          {folder._count.documents > 0 ? `${folder._count.documents} fichier${folder._count.documents > 1 ? 's' : ''}` : ''}
                          {folder._count.children === 0 && folder._count.documents === 0 ? 'Vide' : ''}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); setRenamingFolder(folder.id); setRenameValue(folder.name); }}
                          title="Renommer"
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); void deleteFolder(folder.id); }}
                          title="Supprimer"
                        >
                          <Trash2 size={12} className="text-[var(--danger)]" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Documents */}
            {documents.map((doc) => (
              <div
                key={`d-${doc.id}`}
                role="button"
                tabIndex={0}
                onClick={() => handleDocumentClick(doc)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDocumentClick(doc); }}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
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
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a href={downloadUrl(doc.id)} download title="T\u00e9l\u00e9charger">
                      <Download size={14} />
                    </a>
                  </Button>
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); void handleDeleteDocument(doc.id); }}
                      title="Supprimer"
                    >
                      <Trash2 size={14} className="text-[var(--danger)]" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}

            {/* Empty state */}
            {folders.length === 0 && documents.length === 0 && (
              <p className="py-4 text-center text-xs text-[var(--text-secondary)]">
                {currentFolderId ? 'Ce dossier est vide.' : 'Aucun document projet pour l\u0027instant.'}
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* Preview modal */}
      <DocumentPreviewModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        viewUrl={viewUrl}
        downloadUrl={downloadUrl}
      />
    </div>
  );
}
