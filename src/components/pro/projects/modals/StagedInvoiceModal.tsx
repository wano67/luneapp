"use client";

import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import Select from '@/components/ui/select';

export type StagedInvoiceKind = 'DEPOSIT' | 'MID' | 'FINAL';
export type StagedInvoiceMode = 'PERCENT' | 'AMOUNT';

export type StagedInvoiceModalState = {
  kind: StagedInvoiceKind;
  mode: StagedInvoiceMode;
  value: string;
};

export type StagedInvoiceModalProps = {
  editor: StagedInvoiceModalState | null;
  totalCents: number;
  remainingCents: number;
  previewCents: number;
  previewTooHigh: boolean;
  error: string | null;
  loading: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onModeChange: (mode: StagedInvoiceMode) => void;
  onValueChange: (value: string) => void;
  onCreate: () => void;
};

export function StagedInvoiceModal({
  editor,
  totalCents,
  remainingCents,
  previewCents,
  previewTooHigh,
  error,
  loading,
  isAdmin,
  onClose,
  onModeChange,
  onValueChange,
  onCreate,
}: StagedInvoiceModalProps) {
  return (
    <Modal
      open={Boolean(editor)}
      onCloseAction={onClose}
      title="Créer une facture d'étape"
      description="Définis le montant à facturer pour cette étape."
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">
          Total projet : {formatCurrencyEUR(totalCents, { minimumFractionDigits: 0 })} · Reste :{' '}
          {formatCurrencyEUR(remainingCents, { minimumFractionDigits: 0 })}
        </p>
        {editor?.kind === 'FINAL' ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Cette facture finalise le projet. Le montant correspond au reste à facturer.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Mode de facturation"
              value={editor?.mode ?? 'PERCENT'}
              onChange={(e) => onModeChange(e.target.value as StagedInvoiceMode)}
              disabled={!isAdmin || loading}
            >
              <option value="PERCENT">Pourcentage</option>
              <option value="AMOUNT">Montant fixe</option>
            </Select>
            <Input
              label={editor?.mode === 'AMOUNT' ? 'Montant (€)' : 'Pourcentage (%)'}
              type={editor?.mode === 'AMOUNT' ? 'text' : 'number'}
              inputMode={editor?.mode === 'AMOUNT' ? 'decimal' : 'numeric'}
              min={editor?.mode === 'AMOUNT' ? undefined : 0}
              step={editor?.mode === 'AMOUNT' ? undefined : '1'}
              value={editor?.value ?? ''}
              onChange={(e) => onValueChange(e.target.value)}
              disabled={!isAdmin || loading}
            />
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">Montant estimé</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {formatCurrencyEUR(previewCents, { minimumFractionDigits: 0 })}
          </p>
          {previewTooHigh ? <p className="text-xs text-rose-500">Le montant dépasse le reste à facturer.</p> : null}
        </div>

        {error ? <p className="text-xs text-rose-500">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button type="button" onClick={onCreate} disabled={!isAdmin || loading || previewTooHigh}>
            {loading ? 'Création…' : 'Créer la facture'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
