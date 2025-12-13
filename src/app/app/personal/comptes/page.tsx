'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '@/components/ui/modal';

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

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function centsToEUR(centsStr: string) {
  const v = Number(centsStr);
  if (!Number.isFinite(v)) return '0.00';
  return (v / 100).toFixed(2);
}

function eurosToCents(euros: string) {
  const v = Number(String(euros).replace(',', '.'));
  if (!Number.isFinite(v)) return '0';
  return String(Math.round(v * 100));
}

function typeLabel(t: AccountItem['type']) {
  if (t === 'CURRENT') return 'Courant';
  if (t === 'SAVINGS') return 'Épargne';
  if (t === 'INVEST') return 'Invest';
  return 'Cash';
}

export default function ComptesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AccountItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // modal create
  const [open, setOpen] = useState(false);
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
      if (!res.ok) throw new Error((json as any)?.error ?? 'Erreur');
      setItems((json?.items ?? []) as AccountItem[]);
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

  const total = useMemo(() => {
    return items.reduce((acc, a) => acc + Number(a.balanceCents || '0'), 0);
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
          initialCents: eurosToCents(initialEuros),
        }),
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error((json as any)?.error ?? 'Création impossible');

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
              Solde total (calculé) : {loading ? '—' : `${(total / 100).toFixed(2)} €`}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => alert('Import CSV (placeholder)')}>
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
            const delta = Number(a.delta30Cents || '0');
            const deltaTxt = `${(delta / 100).toFixed(2)} €`;
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
                          delta >= 0 ? 'text-emerald-400' : 'text-rose-400',
                        ].join(' ')}
                      >
                        {delta >= 0 ? '+' : ''}
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
        onClose={() => (creating ? null : setOpen(false))}
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

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              <option value="CURRENT">Courant</option>
              <option value="SAVINGS">Épargne</option>
              <option value="INVEST">Invest</option>
              <option value="CASH">Cash</option>
            </select>
          </div>

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
    </div>
  );
}
