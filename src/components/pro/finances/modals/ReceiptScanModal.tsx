'use client';

import { useCallback, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { Camera, Upload, Check, AlertCircle } from 'lucide-react';

type OcrExtracted = {
  vendor: string | null;
  date: string | null;
  amountTtc: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  amountHt: number | null;
  category: string | null;
  accountCode: string | null;
  pieceRef: string | null;
  note: string | null;
  type: 'EXPENSE' | 'INCOME';
  confidence: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  businessId: string;
  onExtracted: (data: OcrExtracted) => void;
};

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf';

export function ReceiptScanModal({ open, onClose, businessId, onExtracted }: Props) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<OcrExtracted | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setScanning(false);
    setError(null);
    setPreview(null);
    setFileName(null);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setFileName(file.name);

    // Preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }

    setScanning(true);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchJson<{ extracted: OcrExtracted }>(
      `/api/pro/businesses/${businessId}/finances/scan`,
      { method: 'POST', body: formData }
    );

    setScanning(false);

    if (!res.ok || !res.data) {
      setError(res.error ?? 'Impossible d\'analyser le document.');
      return;
    }

    setResult(res.data.extracted);
  }, [businessId]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const handleUse = useCallback(() => {
    if (result) {
      onExtracted(result);
      handleClose();
    }
  }, [result, onExtracted, handleClose]);

  const vatRateLabel = (rate: number | null) => {
    if (rate == null) return '—';
    return `${rate}%`;
  };

  return (
    <Modal
      open={open}
      onCloseAction={handleClose}
      title="Scanner un justificatif"
      description="Photo ou PDF de ticket, facture, reçu — les informations seront extraites automatiquement."
    >
      <div className="space-y-4">
        {/* Upload zone */}
        {!result ? (
          <div
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={handleDrop}
            className="relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6 transition-colors hover:border-[var(--border-strong)]"
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              capture="environment"
              onChange={handleInputChange}
              className="hidden"
            />

            {scanning ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-primary)]" />
                <p className="text-sm text-[var(--text-secondary)]">Analyse en cours…</p>
                {fileName ? <p className="text-xs text-[var(--text-secondary)]">{fileName}</p> : null}
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-secondary)]">
                    <Camera size={20} />
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-secondary)]">
                    <Upload size={20} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Prendre une photo ou déposer un fichier
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    PDF, PNG, JPEG, WEBP — max 10 Mo
                  </p>
                </div>
                {fileName ? (
                  <p className="text-xs text-[var(--text-secondary)]">Dernier : {fileName}</p>
                ) : null}
              </>
            )}

            {preview ? (
              <img
                src={preview}
                alt="Aperçu"
                className="mt-2 max-h-48 rounded-lg object-contain"
              />
            ) : null}
          </div>
        ) : null}

        {/* Error */}
        {error ? (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] dark:bg-red-950/20">
            <AlertCircle size={16} />
            {error}
          </div>
        ) : null}

        {/* Results */}
        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-600" />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Données extraites
              </span>
              <span className="ml-auto text-xs text-[var(--text-secondary)]">
                Confiance : {result.confidence}%
              </span>
            </div>

            {preview ? (
              <img
                src={preview}
                alt="Aperçu"
                className="max-h-32 rounded-lg object-contain"
              />
            ) : null}

            <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface)]/40 p-3">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Field label="Type" value={result.type === 'INCOME' ? 'Revenu' : 'Dépense'} />
                <Field label="Fournisseur" value={result.vendor} />
                <Field label="Date" value={result.date} />
                <Field label="Montant TTC" value={result.amountTtc != null ? `${result.amountTtc.toFixed(2)} €` : null} />
                <Field label="TVA" value={result.vatRate != null ? `${vatRateLabel(result.vatRate)} (${result.vatAmount?.toFixed(2) ?? '—'} €)` : null} />
                <Field label="Montant HT" value={result.amountHt != null ? `${result.amountHt.toFixed(2)} €` : null} />
                <Field label="Catégorie" value={result.accountCode ? `${result.accountCode} — ${result.category}` : result.category} />
                <Field label="N° pièce" value={result.pieceRef} />
                {result.note ? (
                  <div className="sm:col-span-2">
                    <Field label="Note" value={result.note} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={reset}>
                Rescanner
              </Button>
              <Button type="button" onClick={handleUse}>
                Utiliser ces données
              </Button>
            </div>
          </div>
        ) : null}

        {/* Close if no result yet */}
        {!result ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <p className="font-medium text-[var(--text-primary)]">{value ?? '—'}</p>
    </div>
  );
}
