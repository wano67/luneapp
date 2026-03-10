"use client";

import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { sanitizeEuroInput } from '@/lib/money';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountItem = { id: string; name: string; currency: string };
type CategoryItem = { id: string; name: string };

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

type RequiredFields = {
  account: boolean;
  type: boolean;
  date: boolean;
  amount: boolean;
  label: boolean;
};

export type TransactionFormModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  // Form values
  accountId: string;
  type: TxType;
  date: string;
  amountEuro: string;
  currency: string;
  label: string;
  note: string;
  categoryId: string;
  // Validation
  required: RequiredFields;
  isValid: boolean;
  attemptedSubmit: boolean;
  amountPreview: string | null;
  // Data
  accounts: AccountItem[];
  categories: CategoryItem[];
  loadingCategories: boolean;
  // State
  loading: boolean;
  error: string | null;
  submitLabel: string;
  loadingLabel: string;
  amountRef: RefObject<HTMLInputElement | null>;
  // Handlers
  onAccountChange: (v: string) => void;
  onTypeChange: (v: TxType) => void;
  onDateChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onSubmit: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputOk = 'border-[var(--border)]';
const inputBad = 'border-[var(--danger-border)] ring-2 ring-[var(--danger-border)]';

function fieldCls(ok: boolean, attempted: boolean) {
  return attempted && !ok ? inputBad : inputOk;
}

const TYPE_LABELS: Record<TxType, string> = {
  EXPENSE: 'Dépense',
  INCOME: 'Revenu',
  TRANSFER: 'Virement',
};

const TYPE_ACTIVE_CLASS: Record<TxType, string> = {
  EXPENSE: 'bg-[var(--danger)] text-white border-[var(--danger)]',
  INCOME: 'bg-[var(--success)] text-white border-[var(--success)]',
  TRANSFER: 'bg-[var(--shell-accent)] text-white border-[var(--shell-accent)]',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TransactionFormModal({
  open,
  onClose,
  title,
  description,
  accountId,
  type,
  date,
  amountEuro,
  currency,
  label,
  note,
  categoryId,
  required,
  isValid,
  attemptedSubmit,
  amountPreview,
  accounts,
  categories,
  loadingCategories,
  loading,
  error,
  submitLabel,
  loadingLabel,
  amountRef,
  onAccountChange,
  onTypeChange,
  onDateChange,
  onAmountChange,
  onCurrencyChange,
  onLabelChange,
  onNoteChange,
  onCategoryChange,
  onSubmit,
}: TransactionFormModalProps) {
  return (
    <Modal
      open={open}
      onCloseAction={() => (loading ? null : onClose())}
      title={title}
      description={description}
    >
      <div className="space-y-5">
        {/* Montant */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
          <p className="text-xs text-[var(--text-faint)]">Montant</p>
          <div
            className={[
              'mt-2 flex items-center gap-3 rounded-2xl border bg-[var(--surface)] px-4 py-3',
              fieldCls(required.amount, attemptedSubmit),
            ].join(' ')}
            onClick={() => amountRef.current?.focus()}
            role="button"
            tabIndex={0}
          >
            <input
              ref={amountRef}
              value={amountEuro}
              onChange={(e) => onAmountChange(sanitizeEuroInput(e.target.value))}
              placeholder="0,00"
              className="w-full bg-transparent text-4xl font-semibold tracking-tight text-[var(--text)] outline-none"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              data-autofocus="true"
            />
            <span className="text-sm text-[var(--text-faint)]">{(currency || 'EUR').toUpperCase()}</span>
          </div>
          {amountPreview != null ? (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-[var(--text-muted)]">Saisie rapide. Clavier numérique sur mobile.</p>
              <p className="text-xs text-[var(--text-muted)]">Aperçu: {amountPreview}</p>
            </div>
          ) : null}
        </div>

        {/* Type */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
          <p className="text-sm font-semibold text-[var(--text)]">Type</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => {
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTypeChange(t)}
                  className={[
                    'h-12 rounded-2xl border px-3 text-sm font-semibold transition-colors',
                    active
                      ? TYPE_ACTIVE_CLASS[t]
                      : 'border-[var(--border)] bg-transparent text-[var(--text-faint)] hover:bg-[var(--surface)]/60',
                    attemptedSubmit && !required.type
                      ? 'ring-2 ring-[var(--danger-border)] border-[var(--danger-border)]'
                      : '',
                  ].join(' ')}
                >
                  {TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Dépense = enregistré en négatif, Revenu = positif.
          </p>
        </div>

        {/* Infos */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
          <p className="text-sm font-semibold text-[var(--text)]">Infos</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-[var(--text-faint)]">Compte</label>
              <Select
                value={accountId}
                onChange={(e) => onAccountChange(e.target.value)}
                className={fieldCls(required.account, attemptedSubmit)}
                disabled={loading}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className={['h-12 rounded-2xl', fieldCls(required.date, attemptedSubmit)].join(' ')}
                disabled={loading}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Libellé"
                value={label}
                onChange={(e) => onLabelChange(e.target.value)}
                placeholder="ex: Courses, Loyer, Salaire…"
                className={['h-12 rounded-2xl', fieldCls(required.label, attemptedSubmit)].join(' ')}
                disabled={loading}
              />
            </div>

            <div>
              <Input
                label="Devise"
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
                className="h-12 rounded-2xl"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-[var(--text-faint)]">Catégorie (optionnel)</label>
              <Select
                value={categoryId}
                onChange={(e) => onCategoryChange(e.target.value)}
                disabled={loading || loadingCategories}
              >
                <option value="">Aucune catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {loadingCategories ? 'Chargement des catégories…' : 'Optionnel'}
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm text-[var(--text-faint)]">Note (optionnel)</label>
              <textarea
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="Détails…"
                className="min-h-[110px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-base text-[var(--text)] outline-none"
                disabled={loading}
              />
            </div>

            {error ? (
              <div className="sm:col-span-2 rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={loading || !isValid}>
            {loading ? loadingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
