import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';

type DocumentItem = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  createdAt: string;
  viewUrl: string;
  downloadUrl: string;
};

type InvoiceItem = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  issuedAt: string;
  currency?: string;
  pdfUrl?: string;
};
type QuoteItem = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  issuedAt: string;
  currency?: string;
  pdfUrl?: string;
};

type DocumentsResponse = {
  uploads: DocumentItem[];
  invoices: InvoiceItem[];
  quotes: QuoteItem[];
};

type Props = {
  businessId: string;
  clientId: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} ko`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} Mo`;
}

export function ClientDocumentsTab({ businessId, clientId }: Props) {
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [viewer, setViewer] = useState<
    | { type: 'invoice'; item: InvoiceItem }
    | { type: 'quote'; item: QuoteItem }
    | { type: 'upload'; item: DocumentItem }
    | null
  >(null);
  const [shareInfo, setShareInfo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchJson<DocumentsResponse>(
          `/api/pro/businesses/${businessId}/clients/${clientId}/documents`,
          { cache: 'no-store' },
        );
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setError(res.error ?? 'Documents indisponibles');
          setData(null);
          return;
        }
        setData(res.data);
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
  }, [businessId, clientId]);

  async function refresh() {
    const res = await fetchJson<DocumentsResponse>(
      `/api/pro/businesses/${businessId}/clients/${clientId}/documents`,
      { cache: 'no-store' },
    );
    if (res.ok && res.data) setData(res.data);
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    if (!file) {
      setUploadError('Fichier requis');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    if (title.trim()) formData.append('title', title.trim());
    try {
      setUploading(true);
      const res = await fetch(`/api/pro/businesses/${businessId}/clients/${clientId}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setUploadError(payload?.error ?? 'Import impossible');
        return;
      }
      setModalOpen(false);
      setTitle('');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      await refresh();
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const invoices = data?.invoices ?? [];
  const quotes = data?.quotes ?? [];
  const uploads = data?.uploads ?? [];

  function previewUrl() {
    if (!viewer) return null;
    if (viewer.type === 'invoice') return viewer.item.pdfUrl ?? null;
    if (viewer.type === 'quote') return viewer.item.pdfUrl ?? null;
    return viewer.item.viewUrl;
  }

  function downloadUrl() {
    if (!viewer) return null;
    if (viewer.type === 'invoice') return viewer.item.pdfUrl ?? null;
    if (viewer.type === 'quote') return viewer.item.pdfUrl ?? null;
    return viewer.item.downloadUrl;
  }

  function canInlinePreview() {
    if (!viewer) return false;
    if (viewer.type === 'invoice' || viewer.type === 'quote') return true;
    const mime = viewer.item.mimeType.toLowerCase();
    return mime.startsWith('image/') || mime === 'application/pdf';
  }

  async function handleCopyLink() {
    const url = previewUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setShareInfo('Lien copié');
      setTimeout(() => setShareInfo(null), 2000);
    } catch {
      setShareInfo('Impossible de copier le lien');
      setTimeout(() => setShareInfo(null), 2000);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Documents</p>
          <p className="text-xs text-[var(--text-secondary)]">Factures, devis et fichiers du client</p>
        </div>
        <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(true)}>
          Importer un fichier
        </Button>
      </div>

      {error ? (
        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 text-sm text-[var(--danger)] shadow-sm">
          {error}
        </Card>
      ) : null}

      <div className="space-y-4">
        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Factures</p>
              <p className="text-xs text-[var(--text-secondary)]">10 dernières</p>
            </div>
            <Link
              href={`/app/pro/${businessId}/finances`}
              className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Ouvrir finances
            </Link>
          </div>
          {loading ? (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-14 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />
              ))}
            </div>
          ) : invoices.length ? (
            <div className="mt-3 space-y-2">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-1 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-hover)]/40 px-3 py-2 transition hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewer({ type: 'invoice', item: inv })}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setViewer({ type: 'invoice', item: inv })}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{inv.number}</p>
                    <p className="text-[12px] text-[var(--text-secondary)]">{formatDate(inv.issuedAt)}</p>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {formatCurrencyEUR(inv.totalCents)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 p-4 text-sm text-[var(--text-secondary)]">
              Aucune facture pour ce client.
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Devis</p>
              <p className="text-xs text-[var(--text-secondary)]">10 derniers</p>
            </div>
          </div>
          {loading ? (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-14 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />
              ))}
            </div>
          ) : quotes.length ? (
            <div className="mt-3 space-y-2">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="flex flex-col gap-1 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-hover)]/40 px-3 py-2 transition hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewer({ type: 'quote', item: quote })}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setViewer({ type: 'quote', item: quote })}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{quote.number}</p>
                    <p className="text-[12px] text-[var(--text-secondary)]">{formatDate(quote.issuedAt)}</p>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {formatCurrencyEUR(quote.totalCents)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 p-4 text-sm text-[var(--text-secondary)]">
              Aucun devis pour ce client.
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Fichiers</p>
              <p className="text-xs text-[var(--text-secondary)]">Imports manuels</p>
            </div>
          </div>
          {loading ? (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-14 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />
              ))}
            </div>
          ) : uploads.length ? (
            <div className="mt-3 space-y-2">
              {uploads.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-1 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-hover)]/40 px-3 py-2 transition hover:bg-[var(--surface-hover)] sm:flex-row sm:items-center sm:justify-between"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewer({ type: 'upload', item: doc })}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setViewer({ type: 'upload', item: doc })}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{doc.title}</p>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      {formatDate(doc.createdAt)} · {formatSize(doc.sizeBytes)}
                    </p>
                  </div>
                  <span className="text-[12px] text-[var(--text-secondary)]">{doc.mimeType}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 p-4 text-sm text-[var(--text-secondary)]">
              Aucun fichier importé pour ce client.
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onCloseAction={() => (!uploading ? setModalOpen(false) : null)}
        title="Importer un fichier"
        description="Ajoutez un document sécurisé pour ce client."
      >
        <form className="space-y-3" onSubmit={handleUpload}>
          <Input
            label="Titre (optionnel)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contrat signé"
          />
          <div className="space-y-1 text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Fichier</span>
            <input
              ref={inputRef}
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            />
          </div>
          {uploadError ? <p className="text-xs text-[var(--danger)]">{uploadError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={uploading}>
              Annuler
            </Button>
            <Button type="submit" disabled={uploading} className="bg-neutral-900 text-white hover:bg-neutral-800">
              {uploading ? 'Import…' : 'Importer'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!viewer}
        onCloseAction={() => setViewer(null)}
        title={
          viewer
            ? viewer.type === 'upload'
              ? viewer.item.title
              : viewer.item.number
            : ''
        }
        description={
          viewer
            ? viewer.type === 'upload'
              ? `${formatDate(viewer.item.createdAt)} · ${formatSize(viewer.item.sizeBytes)}`
              : formatDate(viewer.item.issuedAt)
            : ''
        }
      >
        {viewer ? (
          <div className="space-y-3">
            {canInlinePreview() ? (
              <iframe
                title="Prévisualisation"
                src={previewUrl() ?? undefined}
                className="h-72 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)]"
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/60 p-4 text-sm text-[var(--text-secondary)]">
                Aperçu indisponible pour ce type de fichier.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {downloadUrl() ? (
                <Link
                  href={downloadUrl()!}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  Télécharger
                </Link>
              ) : null}
              {previewUrl() ? (
                <Button size="sm" variant="outline" onClick={handleCopyLink}>
                  Copier le lien
                </Button>
              ) : null}
              {shareInfo ? <span className="text-xs text-[var(--text-secondary)]">{shareInfo}</span> : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
