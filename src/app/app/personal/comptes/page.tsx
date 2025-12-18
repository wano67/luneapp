'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import Modal from '@/components/ui/modal';
import CsvImportModal from '@/components/CsvImportModal';
import { useFileDropHandler } from '@/components/file-drop/FileDropProvider';

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
  const [createError, setCreateError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountItem['type']>('CURRENT');
  const [initialEuros, setInitialEuros] = useState('0.00');
  const [institution, setInstitution] = useState('');
  const [iban, setIban] = useState('');

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
    setCreateError(null);

    const n = name.trim();
    if (!n) {
      setCreateError('Nom requis.');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/personal/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: n,
          type,
          currency: 'EUR',
          institution: institution.trim() || null,
          iban: iban.trim() || null,
          initialCents: (eurosToCentsBigInt(initialEuros) ?? 0n).toString(),
        }),
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error(getErrorFromJson(json) ?? 'Création impossible');

      setOpen(false);
      setName('');
      setType('CURRENT');
      setInitialEuros('0.00');
      setInstitution('');
      setIban('');

      await load();
    } catch (e) {
      console.error(e);
      setCreateError('Création impossible.');
    } finally {
      setCreating(false);
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
            <Button onClick={() => setOpen(true)}>Créer un compte</Button>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-rose-500">Erreur</p>
          <p className="text-sm text-rose-500/90">{error}</p>
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
              <Button onClick={() => setOpen(true)}>Créer un compte</Button>
            </div>
          </Card>
        ) : (
          items.map((a) => {
            const deltaBig = BigInt(a.delta30Cents || '0');
            const deltaTxt = `${centsToEUR(deltaBig.toString())} €`;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => router.push(`/app/personal/comptes/${a.id}`)}
                className="text-left"
              >
                <Card className="p-5 hover:bg-[var(--surface-hover)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{a.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {typeLabel(a.type)} · {a.currency}
                        {a.institution ? ` · ${a.institution}` : ''}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold">{centsToEUR(a.balanceCents)} €</p>
                      <p
                        className={[
                          'mt-1 text-xs font-semibold',
                          deltaBig >= 0n ? 'text-emerald-400' : 'text-rose-400',
                        ].join(' ')}
                      >
                        {deltaBig >= 0n ? '+' : ''}
                        {deltaTxt} · 30j
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>Ouvrir le détail →</span>
                    <span className="underline underline-offset-4">
                      <Link href="/app/personal/transactions">Transactions</Link>
                    </span>
                  </div>
                </Card>
              </button>
            );
          })
        )}
      </div>

      <Modal
        open={open}
        onCloseAction={() => (creating ? null : setOpen(false))}
        title="Créer un compte bancaire"
        description="Ajoute un compte (courant, épargne, invest, cash). Le solde est calculé avec les transactions."
      >
        <form onSubmit={onCreate} className="space-y-4">
          <Input
            label="Nom du compte *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={createError ?? undefined}
            placeholder="Ex: Courant Revolut"
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
          />

          <Input
            label="Banque / institution"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Ex: BNP, Revolut..."
          />

          <Input
            label="IBAN (optionnel)"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="FR76 ..."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Création…' : 'Créer'}
            </Button>
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
          if (importFile) setLastImportedFileName(importFile.name);
          setImportFile(null);
          setImportError(null);
        }}
        onSelectFiles={handleCsvFiles}
        externalError={importError}
      />

      {lastImportedFileName ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Import réussi — {lastImportedFileName}
        </div>
      ) : null}
    </div>
  );
}
