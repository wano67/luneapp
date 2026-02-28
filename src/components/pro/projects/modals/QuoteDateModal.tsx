"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

export type QuoteDateEditorState = {
  quoteId: string;
  number: string | null;
  status: string;
  signedAt: string;
};

export type QuoteDateModalProps = {
  editor: QuoteDateEditorState | null;
  isAdmin: boolean;
  saving: boolean;
  error: string | null;
  onChangeSignedAt: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function QuoteDateModal({
  editor,
  isAdmin,
  saving,
  error,
  onChangeSignedAt,
  onClose,
  onSave,
}: QuoteDateModalProps) {
  return (
    <Modal
      open={Boolean(editor)}
      onCloseAction={onClose}
      title="Date de signature"
      description="Modifie la date de validation du devis."
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">
          {editor?.number ?? `Devis #${editor?.quoteId ?? ''}`} · Statut {editor?.status ?? '—'}
        </p>
        <Input
          label="Date de signature"
          type="date"
          value={editor?.signedAt ?? ''}
          onChange={(e) => onChangeSignedAt(e.target.value)}
          disabled={!isAdmin || saving}
        />
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={!isAdmin || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
