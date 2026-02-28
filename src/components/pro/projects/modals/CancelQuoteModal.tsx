"use client";

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export type CancelQuoteEditorState = {
  quoteId: string;
  number: string | null;
  status: string;
  reason: string;
};

export type CancelQuoteModalProps = {
  editor: CancelQuoteEditorState | null;
  isAdmin: boolean;
  saving: boolean;
  error: string | null;
  onChangeReason: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function CancelQuoteModal({
  editor,
  isAdmin,
  saving,
  error,
  onChangeReason,
  onClose,
  onConfirm,
}: CancelQuoteModalProps) {
  return (
    <Modal
      open={Boolean(editor)}
      onCloseAction={onClose}
      title="Annuler le devis"
      description="L'annulation requiert une raison et bloque le devis."
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">
          {editor?.number ?? `Devis #${editor?.quoteId ?? ''}`} · Statut {editor?.status ?? '—'}
        </p>
        <label className="text-xs font-medium text-[var(--text-secondary)]">Raison</label>
        <textarea
          className="min-h-[120px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          value={editor?.reason ?? ''}
          onChange={(e) => onChangeReason(e.target.value)}
          disabled={!isAdmin || saving}
        />
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={!isAdmin || saving}>
            {saving ? 'Annulation…' : 'Confirmer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
