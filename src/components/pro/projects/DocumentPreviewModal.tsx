'use client';

import { Download, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

const PREVIEWABLE = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

type DocumentInfo = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  document: DocumentInfo | null;
  viewUrl: (docId: string) => string;
  downloadUrl: (docId: string) => string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function DocumentPreviewModal({ open, onClose, document: doc, viewUrl, downloadUrl }: Props) {
  if (!doc) return null;

  const isPreviewable = PREVIEWABLE.has(doc.mimeType);
  const isImage = doc.mimeType.startsWith('image/');
  const isPdf = doc.mimeType === 'application/pdf';

  return (
    <Modal open={open} title={doc.title || doc.filename} size="xl" onCloseAction={onClose}>
      <div className="flex flex-col gap-4">
        {isPreviewable ? (
          <div className="flex items-center justify-center rounded-lg overflow-hidden" style={{ background: 'var(--surface-2)', minHeight: 400 }}>
            {isPdf ? (
              <iframe
                src={viewUrl(doc.id)}
                title={doc.filename}
                className="w-full border-0"
                style={{ height: 'min(70vh, 600px)' }}
              />
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewUrl(doc.id)}
                alt={doc.filename}
                className="max-w-full max-h-[70vh] object-contain"
              />
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-12 rounded-lg" style={{ background: 'var(--surface-2)' }}>
            <div className="rounded-full p-4" style={{ background: 'var(--surface-hover)' }}>
              <Download size={32} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{doc.filename}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {formatBytes(doc.sizeBytes)} &middot; {doc.mimeType}
              </p>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              Aperçu non disponible pour ce type de fichier.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={14} className="mr-1" />
            Fermer
          </Button>
          <Button asChild size="sm">
            <a href={downloadUrl(doc.id)} download>
              <Download size={14} className="mr-1" />
              Télécharger
            </a>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
