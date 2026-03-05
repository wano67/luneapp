'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '@/components/ui/modal';
import { type AccountItem } from './AccountCard';

const TYPE_DISPLAY: Record<AccountItem['type'], string> = {
  CURRENT: 'Compte courant',
  SAVINGS: 'Épargne',
  INVEST: 'Investissement',
  CASH: 'Espèces',
  LOAN: 'Prêt',
};

function eurosToCentsBigInt(input: string): bigint | null {
  const cleaned = String(input ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');
  if (!cleaned) return null;
  const sign = cleaned.startsWith('-') ? -1n : 1n;
  const unsigned = cleaned.replace(/^[+-]/, '');
  if (!/^\d+(\.\d{0,2})?$/.test(unsigned)) return null;
  const [intPartRaw, decPartRaw = ''] = unsigned.split('.');
  try {
    const intPart = BigInt(intPartRaw || '0');
    const decPart = BigInt((decPartRaw + '00').slice(0, 2));
    return sign * (intPart * 100n + decPart);
  } catch {
    return null;
  }
}

function centsToEUR(centsStr: string) {
  try {
    const b = BigInt(centsStr);
    const sign = b < 0n ? '-' : '';
    const abs = b < 0n ? -b : b;
    const euros = abs / 100n;
    const rem = abs % 100n;
    return `${sign}${euros.toString()}.${rem.toString().padStart(2, '0')}`;
  } catch {
    return '0.00';
  }
}

type EditFormErrors = {
  name?: string;
  initialEuros?: string;
  iban?: string;
  form?: string;
};

type Props = {
  open: boolean;
  account: AccountItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function AccountEditModal({ open, account, onClose, onSaved }: Props) {
  const [editName, setEditName] = useState('');
  const [editInitialEuros, setEditInitialEuros] = useState('0.00');
  const [editIban, setEditIban] = useState('');
  const [editRatePct, setEditRatePct] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editErrors, setEditErrors] = useState<EditFormErrors>({});

  useEffect(() => {
    if (account && open) {
      setEditName(account.name);
      setEditInitialEuros(centsToEUR(account.initialCents));
      setEditIban(account.iban ?? '');
      setEditRatePct(account.interestRateBps ? (account.interestRateBps / 100).toFixed(2) : '');
      setEditErrors({});
    }
  }, [account, open]);

  function handleClose() {
    if (editLoading || deleteLoading) return;
    setEditName('');
    setEditErrors({});
    onClose();
  }

  async function onEdit(e: FormEvent) {
    e.preventDefault();
    if (!account) return;
    setEditErrors({});

    const errors: EditFormErrors = {};
    const name = editName.trim();
    if (!name) errors.name = 'Nom requis.';
    else if (name.length < 2) errors.name = 'Minimum 2 caractères.';

    const initialCents = eurosToCentsBigInt(editInitialEuros);
    if (initialCents === null) errors.initialEuros = 'Montant invalide.';
    else if (initialCents < 0n) errors.initialEuros = 'Le solde initial doit être positif ou nul.';

    const ibanRaw = editIban.trim().replace(/\s+/g, '');
    const ibanUpper = ibanRaw.toUpperCase();
    if (ibanRaw && (!ibanUpper.startsWith('FR') || ibanUpper.length < 15)) {
      errors.iban = 'IBAN FR requis (au moins 15 caractères).';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    const rateBps = editRatePct ? Math.round(parseFloat(editRatePct) * 100) : null;

    try {
      setEditLoading(true);
      const res = await fetch(`/api/personal/accounts/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          type: account.type,
          institution: account.institution,
          iban: ibanRaw ? ibanUpper : null,
          initialCents: initialCents!.toString(),
          interestRateBps: rateBps != null && Number.isFinite(rateBps) ? rateBps : null,
        }),
      });

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json && typeof json === 'object' && 'error' in json && typeof json.error === 'string' ? json.error : null;
        setEditErrors({ form: msg ?? 'Mise à jour impossible.' });
        return;
      }

      setEditName('');
      setEditErrors({});
      await onSaved();
      onClose();
    } catch {
      setEditErrors({ form: 'Mise à jour impossible.' });
    } finally {
      setEditLoading(false);
    }
  }

  async function onToggleHidden() {
    if (!account) return;
    try {
      setEditLoading(true);
      const res = await fetch(`/api/personal/accounts/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: account.name,
          type: account.type,
          initialCents: account.initialCents,
          hidden: !account.hidden,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json && typeof json === 'object' && 'error' in json && typeof json.error === 'string' ? json.error : null;
        setEditErrors({ form: msg ?? 'Erreur.' });
        return;
      }
      setEditName('');
      await onSaved();
      onClose();
    } catch {
      setEditErrors({ form: 'Erreur.' });
    } finally {
      setEditLoading(false);
    }
  }

  async function onDeleteAccount() {
    if (!account) return;
    const ok = window.confirm(
      'Ce compte sera supprimé ainsi que ses transactions associées. Continuer ?'
    );
    if (!ok) return;

    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/personal/accounts/${encodeURIComponent(account.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json && typeof json === 'object' && 'error' in json && typeof json.error === 'string' ? json.error : null;
        setEditErrors({ form: msg ?? 'Suppression impossible.' });
        return;
      }

      setEditName('');
      setEditErrors({});
      await onSaved();
      onClose();
    } catch {
      setEditErrors({ form: 'Suppression impossible.' });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onCloseAction={handleClose}
      title="Modifier un compte"
      description="Mets à jour les informations du compte."
    >
      <form onSubmit={onEdit} className="space-y-4">
        {editErrors.form ? (
          <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
            {editErrors.form}
          </div>
        ) : null}

        <Input
          label="Nom du compte *"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          error={editErrors.name}
          placeholder="Ex: Courant Revolut"
          data-autofocus="true"
        />

        {/* Type — read-only */}
        <div className="flex w-full flex-col gap-1">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Type</span>
          <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-faint)]">
            {TYPE_DISPLAY[account?.type ?? 'CURRENT']}
          </div>
        </div>

        {/* Institution — read-only */}
        {account?.institution ? (
          <div className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Banque</span>
            <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-faint)]">
              {account.institution}
            </div>
          </div>
        ) : null}

        {/* Interest rate — editable for non-checking */}
        {account && account.type !== 'CURRENT' && account.type !== 'CASH' ? (
          <Input
            label="Taux d'intérêt annuel (%)"
            value={editRatePct}
            onChange={(e) => setEditRatePct(e.target.value)}
            placeholder="1.50"
          />
        ) : null}

        <Input
          label={account?.type === 'LOAN' ? 'Capital restant dû (€)' : 'Solde initial (€)'}
          value={editInitialEuros}
          onChange={(e) => setEditInitialEuros(e.target.value)}
          placeholder="0.00"
          error={editErrors.initialEuros}
        />

        <Input
          label="IBAN (optionnel)"
          value={editIban}
          onChange={(e) => setEditIban(e.target.value)}
          placeholder="FR76 ..."
          error={editErrors.iban}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex gap-2">
            <Button
              variant="danger"
              type="button"
              onClick={onDeleteAccount}
              disabled={editLoading || deleteLoading}
            >
              {deleteLoading ? 'Suppression…' : 'Supprimer'}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={onToggleHidden}
              disabled={editLoading || deleteLoading}
            >
              {account?.hidden ? 'Afficher' : 'Masquer'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={handleClose}
              disabled={editLoading || deleteLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={editLoading || deleteLoading}>
              {editLoading ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
