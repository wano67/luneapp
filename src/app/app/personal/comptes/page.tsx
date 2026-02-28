'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import Modal from '@/components/ui/modal';
import CsvImportModal from '@/components/CsvImportModal';
import { useFileDropHandler } from '@/components/file-drop/FileDropProvider';
import { emitWalletRefresh } from '@/lib/personalEvents';

type AccountItem = {
  id: string;
  name: string;
  type: 'CURRENT' | 'SAVINGS' | 'INVEST' | 'CASH';
  currency: string;
  institution: string | null;
  iban: string | null;
  initialCents: string;
  balanceCents: string;
  delta30Cents: string;
};

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getErrorFromJson(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  if (!('error' in json)) return null;
  const err = (json as { error?: unknown }).error;
  return typeof err === 'string' ? err : null;
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

type AccountFormErrors = {
  name?: string;
  initialEuros?: string;
  institution?: string;
  iban?: string;
  form?: string;
};

function validateAccountForm(values: {
  name: string;
  initialEuros: string;
  institution: string;
  iban: string;
}) {
  const errors: AccountFormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Nom requis.';
  } else if (name.length < 2) {
    errors.name = 'Minimum 2 caractères.';
  }

  const initialCents = eurosToCentsBigInt(values.initialEuros);
  if (initialCents === null) {
    errors.initialEuros = 'Montant invalide.';
  } else if (initialCents < 0n) {
    errors.initialEuros = 'Le solde initial doit être supérieur ou égal à 0.';
  }

  const institution = values.institution.trim();
  if (institution && institution.length > 60) {
    errors.institution = '60 caractères maximum.';
  }

  const ibanRaw = values.iban.trim();
  const ibanCompact = ibanRaw.replace(/\s+/g, '');
  const ibanUpper = ibanCompact.toUpperCase();
  if (ibanCompact && (!ibanUpper.startsWith('FR') || ibanUpper.length < 15)) {
    errors.iban = 'IBAN FR requis (au moins 15 caractères).';
  }

  return {
    errors,
    name,
    institution: institution || null,
    iban: ibanCompact ? ibanUpper : null,
    initialCents,
  };
}

function typeLabel(t: AccountItem['type']) {
  if (t === 'CURRENT') return 'Courant';
  if (t === 'SAVINGS') return 'Épargne';
  if (t === 'INVEST') return 'Invest';
  return 'Cash';
}

function isAccountType(v: string): v is AccountItem['type'] {
  return v === 'CURRENT' || v === 'SAVINGS' || v === 'INVEST' || v === 'CASH';
}

export default function ComptesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importAutoOpenedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AccountItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // modal create
  const [open, setOpen] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportedFileName, setLastImportedFileName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AccountFormErrors>({});

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountItem['type']>('CURRENT');
  const [initialEuros, setInitialEuros] = useState('0');
  const [institution, setInstitution] = useState('');
  const [iban, setIban] = useState('');

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editErrors, setEditErrors] = useState<AccountFormErrors>({});
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountItem['type']>('CURRENT');
  const [editInitialEuros, setEditInitialEuros] = useState('0.00');
  const [editInstitution, setEditInstitution] = useState('');
  const [editIban, setEditIban] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/personal/accounts', { credentials: 'include' });
      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      const json = await safeJson(res);
      if (!res.ok) throw new Error(getErrorFromJson(json) ?? 'Erreur');

      const itemsRaw =
        json && typeof json === 'object' && 'items' in json
          ? (json as { items?: unknown }).items
          : [];

      setItems(Array.isArray(itemsRaw) ? (itemsRaw as AccountItem[]) : []);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('Impossible de charger les comptes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (importAutoOpenedRef.current) return;
    const shouldOpen = searchParams?.get('import') === '1';
    if (!shouldOpen) return;
    importAutoOpenedRef.current = true;
    setImportFile(null);
    setImportError(null);
    setOpenImport(true);
  }, [searchParams]);

  const handleCsvFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files as ArrayLike<File>);
    if (!list.length) return;
    const file = list[0];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isCsv = ext === 'csv' || file.type === 'text/csv';
    if (!isCsv) {
      setImportError(`Votre fichier est un fichier .${ext || 'inconnu'}. Le format requis est .csv.`);
      setImportFile(null);
      setOpenImport(true);
      return;
    }
    setImportError(null);
    setImportFile(file);
    setOpenImport(true);
  }, []);

  useFileDropHandler(handleCsvFiles, { enabled: true });

  const totalCents = useMemo(() => {
    return items.reduce<bigint>((acc, a) => acc + BigInt(a.balanceCents || '0'), 0n);
  }, [items]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSuccessMessage(null);

    const validated = validateAccountForm({ name, initialEuros, institution, iban });
    if (Object.keys(validated.errors).length > 0) {
      setFieldErrors(validated.errors);
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/personal/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: validated.name,
          type,
          currency: 'EUR',
          institution: validated.institution,
          iban: validated.iban,
          initialCents: validated.initialCents!.toString(),
        }),
      });

      const json = await safeJson(res);
      if (!res.ok) {
        setFieldErrors((prev) => ({
          ...prev,
          form: getErrorFromJson(json) ?? 'Création impossible.',
        }));
        return;
      }

      setOpen(false);
      setName('');
      setType('CURRENT');
      setInitialEuros('0');
      setInstitution('');
      setIban('');
      setFieldErrors({});
      setSuccessMessage('Compte créé avec succès.');

      await load();
      emitWalletRefresh();
    } catch (e) {
      console.error(e);
      setFieldErrors((prev) => ({ ...prev, form: 'Création impossible.' }));
    } finally {
      setCreating(false);
    }
  }

  function openEditModal(account: AccountItem) {
    setEditingAccount(account);
    setEditName(account.name);
    setEditType(account.type);
    setEditInitialEuros(centsToEUR(account.initialCents));
    setEditInstitution(account.institution ?? '');
    setEditIban(account.iban ?? '');
    setEditErrors({});
    setSuccessMessage(null);
    setEditOpen(true);
  }

  async function onEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingAccount) return;
    setEditErrors({});
    setSuccessMessage(null);

    const validated = validateAccountForm({
      name: editName,
      initialEuros: editInitialEuros,
      institution: editInstitution,
      iban: editIban,
    });
    if (Object.keys(validated.errors).length > 0) {
      setEditErrors(validated.errors);
      return;
    }

    try {
      setEditLoading(true);
      const res = await fetch(`/api/personal/accounts/${encodeURIComponent(editingAccount.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: validated.name,
          type: editType,
          institution: validated.institution,
          iban: validated.iban,
          initialCents: validated.initialCents!.toString(),
        }),
      });

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      const json = await safeJson(res);
      if (!res.ok) {
        setEditErrors((prev) => ({
          ...prev,
          form: getErrorFromJson(json) ?? 'Mise à jour impossible.',
        }));
        return;
      }

      setEditOpen(false);
      setEditingAccount(null);
      setEditErrors({});
      setSuccessMessage('Compte mis à jour.');

      await load();
      emitWalletRefresh();
    } catch (e) {
      console.error(e);
      setEditErrors((prev) => ({ ...prev, form: 'Mise à jour impossible.' }));
    } finally {
      setEditLoading(false);
    }
  }

  async function onDeleteAccount() {
    if (!editingAccount) return;
    const ok = window.confirm(
      'Ce compte sera supprimé ainsi que ses transactions associées. Continuer ?'
    );
    if (!ok) return;

    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/personal/accounts/${encodeURIComponent(editingAccount.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      const json = await safeJson(res);
      if (!res.ok) {
        setEditErrors((prev) => ({
          ...prev,
          form: getErrorFromJson(json) ?? 'Suppression impossible.',
        }));
        return;
      }

      setEditOpen(false);
      setEditingAccount(null);
      setEditErrors({});
      setSuccessMessage('Compte supprimé.');

      await load();
      emitWalletRefresh();
    } catch (e) {
      console.error(e);
      setEditErrors((prev) => ({ ...prev, form: 'Suppression impossible.' }));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Wallet · Comptes
            </p>
            <h2 className="text-lg font-semibold">Comptes</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Gère tes comptes et soldes, point d’entrée unique avant les transactions.
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Solde total (calculé) : {loading ? '—' : `${centsToEUR(totalCents.toString())} €`}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportFile(null);
                setImportError(null);
                setOpenImport(true);
              }}
            >
              Importer CSV
            </Button>
            <Button
              onClick={() => {
                setFieldErrors({});
                setSuccessMessage(null);
                setOpen(true);
              }}
            >
              Créer un compte
            </Button>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--danger)]">Erreur</p>
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card className="p-5">
            <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
          </Card>
        ) : items.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-[var(--text-secondary)]">
              Aucun compte. Crée ton premier compte bancaire.
            </p>
            <div className="mt-3">
            <Button
              onClick={() => {
                setFieldErrors({});
                setSuccessMessage(null);
                setOpen(true);
              }}
            >
              Créer un compte
            </Button>
            </div>
          </Card>
        ) : (
          items.map((a) => {
            const deltaBig = BigInt(a.delta30Cents || '0');
            const deltaTxt = `${centsToEUR(deltaBig.toString())} €`;
            return (
              <Card
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  const target = e.target as HTMLElement | null;
                  if (target?.closest('button,a,input,select,textarea')) return;
                  router.push(`/app/personal/comptes/${a.id}`);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  const target = e.target as HTMLElement | null;
                  if (target?.closest('button,a,input,select,textarea')) return;
                  e.preventDefault();
                  router.push(`/app/personal/comptes/${a.id}`);
                }}
                className="p-5 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{a.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {typeLabel(a.type)} · {a.currency}
                      {a.institution ? ` · ${a.institution}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-base font-semibold">{centsToEUR(a.balanceCents)} €</p>
                      <p
                        className={[
                          'mt-1 text-xs font-semibold',
                          deltaBig >= 0n ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                        ].join(' ')}
                      >
                        {deltaBig >= 0n ? '+' : ''}
                        {deltaTxt} · 30j
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(a);
                      }}
                    >
                      Modifier
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Ouvrir le détail →</span>
                  <span className="underline underline-offset-4">
                    <Link
                      href="/app/personal/transactions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Transactions
                    </Link>
                  </span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        open={open}
        onCloseAction={() => {
          if (creating) return;
          setOpen(false);
          setFieldErrors({});
        }}
        title="Créer un compte bancaire"
        description="Ajoute un compte (courant, épargne, invest, cash). Le solde est calculé avec les transactions."
      >
        <form onSubmit={onCreate} className="space-y-4">
          {fieldErrors.form ? (
            <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
              {fieldErrors.form}
            </div>
          ) : null}
          <Input
            label="Nom du compte *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            placeholder="Ex: Courant Revolut"
            data-autofocus="true"
          />

          <Select
            label="Type"
            value={type}
            onChange={(e) => {
              const v = e.target.value;
              if (isAccountType(v)) setType(v);
            }}
            disabled={creating}
          >
            <option value="CURRENT">Courant</option>
            <option value="SAVINGS">Épargne</option>
            <option value="INVEST">Invest</option>
            <option value="CASH">Cash</option>
          </Select>

          <Input
            label="Solde initial (€)"
            value={initialEuros}
            onChange={(e) => setInitialEuros(e.target.value)}
            placeholder="0.00"
            error={fieldErrors.initialEuros}
          />

          <Input
            label="Banque / institution"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Ex: BNP, Revolut..."
            error={fieldErrors.institution}
          />

          <Input
            label="IBAN (optionnel)"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="FR76 ..."
            error={fieldErrors.iban}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setOpen(false);
                setFieldErrors({});
              }}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onCloseAction={() => {
          if (editLoading || deleteLoading) return;
          setEditOpen(false);
          setEditErrors({});
          setEditingAccount(null);
        }}
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

          <Select
            label="Type"
            value={editType}
            onChange={(e) => {
              const v = e.target.value;
              if (isAccountType(v)) setEditType(v);
            }}
            disabled={editLoading || deleteLoading}
          >
            <option value="CURRENT">Courant</option>
            <option value="SAVINGS">Épargne</option>
            <option value="INVEST">Invest</option>
            <option value="CASH">Cash</option>
          </Select>

          <Input
            label="Solde initial (€)"
            value={editInitialEuros}
            onChange={(e) => setEditInitialEuros(e.target.value)}
            placeholder="0.00"
            error={editErrors.initialEuros}
          />

          <Input
            label="Banque / institution"
            value={editInstitution}
            onChange={(e) => setEditInstitution(e.target.value)}
            placeholder="Ex: BNP, Revolut..."
            error={editErrors.institution}
          />

          <Input
            label="IBAN (optionnel)"
            value={editIban}
            onChange={(e) => setEditIban(e.target.value)}
            placeholder="FR76 ..."
            error={editErrors.iban}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button
              variant="danger"
              type="button"
              onClick={onDeleteAccount}
              disabled={editLoading || deleteLoading}
            >
              {deleteLoading ? 'Suppression…' : 'Supprimer'}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  if (editLoading || deleteLoading) return;
                  setEditOpen(false);
                  setEditErrors({});
                  setEditingAccount(null);
                }}
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

      <CsvImportModal
        open={openImport}
        file={importFile}
        onCloseAction={() => {
          setOpenImport(false);
          setImportFile(null);
          setImportError(null);
        }}
        accounts={items.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        defaultAccountId={items[0]?.id}
        onConfirmImport={async () => {
          await load();
          emitWalletRefresh();
          if (importFile) setLastImportedFileName(importFile.name);
          setImportFile(null);
          setImportError(null);
        }}
        onSelectFiles={handleCsvFiles}
        externalError={importError}
      />

      {lastImportedFileName ? (
        <div className="rounded-2xl border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          Import réussi — {lastImportedFileName}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          {successMessage}
        </div>
      ) : null}
    </div>
  );
}
