'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import { parseEuroToCents, absCents, formatCentsToEuroInput } from '@/lib/money';
import { TransactionFormModal } from '../../transactions/TransactionFormModal';

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
type CategoryItem = { id: string; name: string };

type Txn = {
  id: string;
  type: TxType;
  date: string;
  amountCents: string;
  currency: string;
  label: string;
  note?: string | null;
  category: { id: string; name: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  accountName: string;
  accountCurrency: string;
  editTxn?: Txn | null;
};

function isoDateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toISOFromDateOnly(value: string) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function buildAmountCents(amountEuro: string, type: TxType): string | null {
  const cents = parseEuroToCents(amountEuro);
  if (!Number.isFinite(cents)) return null;
  let amount = BigInt(String(cents));
  if (amount === 0n) return null;
  if (type === 'EXPENSE' && amount > 0n) amount = -amount;
  if (type === 'INCOME' && amount < 0n) amount = -amount;
  return amount.toString();
}

export default function InlineTransactionModal({
  open,
  onClose,
  onSuccess,
  accountId,
  accountName,
  accountCurrency,
  editTxn,
}: Props) {
  const isEdit = !!editTxn;

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [fType, setFType] = useState<TxType>('EXPENSE');
  const [fDate, setFDate] = useState(isoDateOnly(new Date()));
  const [fAmountEuro, setFAmountEuro] = useState('');
  const [fCurrency, setFCurrency] = useState(accountCurrency || 'EUR');
  const [fLabel, setFLabel] = useState('');
  const [fNote, setFNote] = useState('');
  const [fCategoryId, setFCategoryId] = useState('');
  const amountRef = useRef<HTMLInputElement | null>(null);

  // Reset form when opening or when editTxn changes
  useEffect(() => {
    if (!open) return;
    setError(null);
    setAttemptedSubmit(false);
    if (editTxn) {
      setFType(editTxn.type);
      setFDate(isoDateOnly(new Date(editTxn.date)));
      setFAmountEuro(formatCentsToEuroInput(absCents(editTxn.amountCents)));
      setFCurrency(editTxn.currency || accountCurrency);
      setFLabel(editTxn.label);
      setFNote(editTxn.note ?? '');
      setFCategoryId(editTxn.category?.id ?? '');
    } else {
      setFType('EXPENSE');
      setFDate(isoDateOnly(new Date()));
      setFAmountEuro('');
      setFCurrency(accountCurrency || 'EUR');
      setFLabel('');
      setFNote('');
      setFCategoryId('');
    }
  }, [open, editTxn, accountCurrency]);

  // Load categories once
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingCategories(true);
      try {
        const res = await fetchJson<{ items: CategoryItem[] }>('/api/personal/categories');
        if (!cancelled && res.ok && res.data) setCategories(res.data.items ?? []);
      } catch {
        // Categories optional
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const amountCentsRaw = useMemo(() => {
    const c = parseEuroToCents(fAmountEuro);
    return Number.isFinite(c) ? String(c) : null;
  }, [fAmountEuro]);

  const dateIso = useMemo(() => (fDate ? toISOFromDateOnly(fDate) : ''), [fDate]);

  const required = useMemo(() => ({
    account: true,
    type: !!fType,
    date: !!dateIso,
    amount: !!amountCentsRaw,
    label: !!fLabel.trim(),
  }), [fType, dateIso, amountCentsRaw, fLabel]);

  const isValid = required.type && required.date && required.amount && required.label;

  async function handleSubmit() {
    setAttemptedSubmit(true);
    if (!isValid) return;

    const cents = buildAmountCents(fAmountEuro, fType);
    if (!cents) return;

    const payload = {
      accountId,
      type: fType,
      date: dateIso,
      amountCents: cents,
      currency: fCurrency || 'EUR',
      label: fLabel.trim(),
      note: fNote.trim() || null,
      categoryId: fCategoryId || null,
    };

    setLoading(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/personal/transactions/${encodeURIComponent(editTxn!.id)}`
        : '/api/personal/transactions';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(res.error ?? (isEdit ? 'Modification impossible.' : 'Création impossible.'));
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError(isEdit ? 'Modification impossible.' : 'Création impossible.');
    } finally {
      setLoading(false);
    }
  }

  const accounts = useMemo(() => [{ id: accountId, name: accountName, currency: accountCurrency }], [accountId, accountName, accountCurrency]);

  return (
    <TransactionFormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier la transaction' : 'Nouvelle transaction'}
      description={accountName}
      accountId={accountId}
      type={fType}
      date={fDate}
      amountEuro={fAmountEuro}
      currency={fCurrency}
      label={fLabel}
      note={fNote}
      categoryId={fCategoryId}
      required={required}
      isValid={isValid}
      attemptedSubmit={attemptedSubmit}
      amountPreview={null}
      accounts={accounts}
      categories={categories}
      loadingCategories={loadingCategories}
      loading={loading}
      error={error}
      submitLabel={isEdit ? 'Enregistrer' : 'Créer'}
      loadingLabel={isEdit ? 'Modification…' : 'Création…'}
      amountRef={amountRef}
      onAccountChange={() => {}}
      onTypeChange={setFType}
      onDateChange={setFDate}
      onAmountChange={setFAmountEuro}
      onCurrencyChange={setFCurrency}
      onLabelChange={setFLabel}
      onNoteChange={setFNote}
      onCategoryChange={setFCategoryId}
      onSubmit={handleSubmit}
    />
  );
}
