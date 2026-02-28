"use client";

import { cn } from '@/lib/cn';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import Select from '@/components/ui/select';
import { formatDate, PAYMENT_METHOD_LABELS, UI } from '@/components/pro/projects/workspace-ui';

export type PaymentModalInvoice = {
  id: string;
  number: string | null;
  status: string;
};

export type PaymentModalItem = {
  id: string;
  amountCents: string;
  paidAt: string;
  method: string;
  reference: string | null;
  note: string | null;
  createdBy?: { id: string; name?: string | null; email?: string | null } | null;
};

export type PaymentFormState = {
  amount: string;
  paidAt: string;
  method: string;
  reference: string;
  note: string;
};

export type PaymentModalProps = {
  open: boolean;
  invoice: PaymentModalInvoice | null;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  notice: string | null;
  loading: boolean;
  items: PaymentModalItem[];
  isAdmin: boolean;
  deletingId: string | null;
  form: PaymentFormState;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onDeletePayment: (paymentId: string) => void;
  onFormChange: (patch: Partial<PaymentFormState>) => void;
  onApplyShortcut: (ratio: number) => void;
  onSave: () => void;
};

export function PaymentModal({
  open,
  invoice,
  totalCents,
  paidCents,
  remainingCents,
  notice,
  loading,
  items,
  isAdmin,
  deletingId,
  form,
  saving,
  error,
  onClose,
  onDeletePayment,
  onFormChange,
  onApplyShortcut,
  onSave,
}: PaymentModalProps) {
  return (
    <Modal
      open={open}
      onCloseAction={onClose}
      title="Paiements"
      description="Ajoute un règlement et consulte l'historique."
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">
          {invoice
            ? `${invoice.number ?? `Facture #${invoice.id}`} · Total ${formatCurrencyEUR(totalCents, {
                minimumFractionDigits: 0,
              })}`
            : 'Facture sélectionnée'}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className={cn(UI.sectionSoft, 'text-right')}>
            <p className={UI.label}>Total</p>
            <p className={UI.value}>{formatCurrencyEUR(totalCents, { minimumFractionDigits: 0 })}</p>
          </div>
          <div className={cn(UI.sectionSoft, 'text-right')}>
            <p className={UI.label}>Payé</p>
            <p className={UI.value}>{formatCurrencyEUR(paidCents, { minimumFractionDigits: 0 })}</p>
          </div>
          <div className={cn(UI.sectionSoft, 'text-right')}>
            <p className={UI.label}>Reste</p>
            <p className={UI.value}>{formatCurrencyEUR(remainingCents, { minimumFractionDigits: 0 })}</p>
          </div>
        </div>
        {notice ? <Alert variant="success" title={notice} /> : null}

        <div className="space-y-2">
          <p className={UI.label}>Historique</p>
          {loading ? (
            <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>Chargement…</div>
          ) : items.length ? (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {formatCurrencyEUR(Number(item.amountCents), { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {formatDate(item.paidAt)} · {PAYMENT_METHOD_LABELS[item.method] ?? item.method}
                      {item.reference ? ` · ${item.reference}` : ''}
                    </p>
                    {item.note || item.createdBy?.name || item.createdBy?.email ? (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {item.note ? item.note : ''}
                        {item.note && (item.createdBy?.name || item.createdBy?.email) ? ' · ' : ''}
                        {item.createdBy?.name || item.createdBy?.email
                          ? `par ${item.createdBy?.name ?? item.createdBy?.email}`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeletePayment(item.id)}
                    disabled={!isAdmin || deletingId === item.id || invoice?.status === 'CANCELLED'}
                  >
                    Supprimer
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>
              Aucun paiement enregistré.
            </div>
          )}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <Input
            label="Montant (€)"
            type="text"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => onFormChange({ amount: e.target.value })}
            disabled={!isAdmin || saving}
          />
          <Input
            label="Date de paiement"
            type="date"
            value={form.paidAt}
            onChange={(e) => onFormChange({ paidAt: e.target.value })}
            disabled={!isAdmin || saving}
          />
          <Select
            label="Mode"
            value={form.method}
            onChange={(e) => onFormChange({ method: e.target.value })}
            disabled={!isAdmin || saving}
          >
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Référence"
            value={form.reference}
            onChange={(e) => onFormChange({ reference: e.target.value })}
            disabled={!isAdmin || saving}
          />
          <Input
            label="Note"
            value={form.note}
            onChange={(e) => onFormChange({ note: e.target.value })}
            disabled={!isAdmin || saving}
          />
        </div>
        {remainingCents > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className={UI.label}>Raccourcis</span>
            {[0.25, 0.5, 1].map((ratio) => (
              <Button
                key={ratio}
                size="sm"
                variant="ghost"
                onClick={() => onApplyShortcut(ratio)}
                disabled={!isAdmin || saving}
              >
                {Math.round(ratio * 100)}%
              </Button>
            ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={!isAdmin || saving || remainingCents <= 0}>
            {saving ? 'Enregistrement…' : 'Enregistrer le paiement'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
