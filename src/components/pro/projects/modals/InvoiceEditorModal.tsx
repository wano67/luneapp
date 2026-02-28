"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

export type InvoiceEditorModalLine = {
  id: string;
  label: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

export type InvoiceEditorModalState = {
  invoiceId: string;
  status: string;
  number: string | null;
  issuedAt: string;
  dueAt: string;
  note: string;
  lines: InvoiceEditorModalLine[];
};

export type InvoiceEditorModalProps = {
  editor: InvoiceEditorModalState | null;
  isAdmin: boolean;
  canEditMeta: boolean;
  canEditLines: boolean;
  editing: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onAddLine: () => void;
  onRemoveLine: (lineId: string) => void;
  onChangeIssuedAt: (value: string) => void;
  onChangeDueAt: (value: string) => void;
  onChangeNote: (value: string) => void;
  onChangeLine: (lineId: string, patch: Partial<InvoiceEditorModalLine>) => void;
};

export function InvoiceEditorModal({
  editor,
  isAdmin,
  canEditMeta,
  canEditLines,
  editing,
  error,
  onClose,
  onSave,
  onAddLine,
  onRemoveLine,
  onChangeIssuedAt,
  onChangeDueAt,
  onChangeNote,
  onChangeLine,
}: InvoiceEditorModalProps) {
  return (
    <Modal
      open={Boolean(editor)}
      onCloseAction={onClose}
      title="Modifier la facture"
      description="Mets à jour les dates, notes et lignes de la facture."
    >
      <div className="space-y-3">
        {!canEditMeta ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Facture verrouillée (payée/annulée). Les modifications sont désactivées.
          </p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Émission"
            type="date"
            value={editor?.issuedAt ?? ''}
            onChange={(e) => onChangeIssuedAt(e.target.value)}
            disabled={!isAdmin || !canEditMeta || editing}
          />
          <Input
            label="Échéance"
            type="date"
            value={editor?.dueAt ?? ''}
            onChange={(e) => onChangeDueAt(e.target.value)}
            disabled={!isAdmin || !canEditMeta || editing}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-[var(--text-secondary)]">Note</label>
          <textarea
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            rows={3}
            value={editor?.note ?? ''}
            onChange={(e) => onChangeNote(e.target.value)}
            disabled={!isAdmin || !canEditMeta || editing}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Lignes</p>
            <Button size="sm" variant="outline" onClick={onAddLine} disabled={!isAdmin || !canEditLines}>
              Ajouter une ligne
            </Button>
          </div>
          {editor?.lines.map((line) => (
            <div key={line.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_120px_140px_auto] md:items-end">
                <Input
                  label="Libellé"
                  value={line.label}
                  onChange={(e) => onChangeLine(line.id, { label: e.target.value })}
                  disabled={!isAdmin || !canEditLines || editing}
                />
                <Input
                  label="Qté"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => onChangeLine(line.id, { quantity: e.target.value })}
                  disabled={!isAdmin || !canEditLines || editing}
                />
                <Input
                  label="Prix (€)"
                  type="text"
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(e) => onChangeLine(line.id, { unitPrice: e.target.value })}
                  disabled={!isAdmin || !canEditLines || editing}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveLine(line.id)}
                  disabled={!isAdmin || !canEditLines || editing}
                >
                  Supprimer
                </Button>
              </div>
              <div className="mt-2 space-y-1">
                <label className="text-xs text-[var(--text-secondary)]">Description</label>
                <textarea
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  rows={2}
                  value={line.description}
                  onChange={(e) => onChangeLine(line.id, { description: e.target.value })}
                  disabled={!isAdmin || !canEditLines || editing}
                />
              </div>
            </div>
          ))}
        </div>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={!isAdmin || !canEditMeta || editing}>
            {editing ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
