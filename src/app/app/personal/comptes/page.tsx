'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

type AccountItem = {
  id: string;
  name: string;
  type: 'CURRENT' | 'SAVINGS' | 'INVEST' | 'CASH';
  currency: string;
  institution?: string | null;
  iban?: string | null;
  initialCents: string;
  balanceCents: string;
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
  const raw = String(euros).replace(',', '.').trim();
  const v = Number(raw);
  if (!Number.isFinite(v)) return '0';
  return String(Math.round(v * 100));
}

function normalizeIban(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

export default function ComptesPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AccountItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // modal create
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    name: '',
    type: 'CURRENT' as AccountItem['type'],
    institution: '',
    iban: '',
    initialEuros: '0.00',
  });

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

  const totalCents = useMemo(() => {
    return items.reduce((acc, a) => acc + Number(a.balanceCents || '0'), 0);
  }, [items]);

  function openCreate() {
    setCreationError(null);
    setDraft({
      name: '',
      type: 'CURRENT',
      institution: '',
      iban: '',
      initialEuros: '0.00',
    });
    setCreateOpen(true);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreationError(null);

    const name = draft.name.trim();
    if (!name) {
      setCreationError('Le nom du compte est obligatoire.');
      return;
    }

    const iban = normalizeIban(draft.iban);
    if (iban && iban.length < 10) {
      setCreationError('IBAN invalide.');
      return;
    }

    try {
      setCreating(true);

      const res = await fetch('/api/personal/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          type: draft.type,
          currency: 'EUR',
          institution: draft.institution.trim() || null,
          iban: iban || null,
          initialCents: eurosToCents(draft.initialEuros),
        }),
      });

      const json = await safeJson(res);
      if (!res.ok) {
        throw new Error((json as any)?.error ?? 'Création impossible');
      }

      setCreateOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      setCreationError('Création impossible.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Wallet · Comptes
            </p>
            <h2 className="text-lg font-semibold">Comptes</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Solde calculé = solde initial + transactions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <p className="text-xs text-[var(--text-secondary)]">Total</p>
              <p className="text-lg font-semibold">{centsToEUR(String(totalCents))} €</p>
            </div>

            <Button onClick={openCreate}>Créer un compte</Button>

            <Link
              href="/app/personal/transactions"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-hover)]"
            >
              Transactions →
            </Link>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-rose-500">Erreur</p>
          <p className="text-sm text-rose-500/90">{error}</p>
        </Card>
      ) : null}

      {/* LIST */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Liste</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {loading ? '…' : `${items.length} compte(s)`}
            </p>
          </div>

          {!loading && items.length === 0 ? (
            <Button variant="outline" onClick={openCreate}>
              Ajouter mon premier compte
            </Button>
          ) : null}
        </div>

        <div className="mt-4 divide-y divide-[var(--border)]">
          {loading ? (
            <p className="py-3 text-sm text-[var(--text-secondary)]">Chargement…</p>
          ) : items.length === 0 ? (
            <div className="py-6">
              <p className="text-sm text-[var(--text-secondary)]">
                Aucun compte pour le moment.
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Crée un compte (banque / cash / épargne) pour commencer à saisir tes transactions.
              </p>
            </div>
          ) : (
            items.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {a.type} · {a.currency}
                    {a.institution ? ` · ${a.institution}` : ''}
                    {a.iban ? ' · IBAN' : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{centsToEUR(a.balanceCents)} €</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    initial {centsToEUR(a.initialCents)} €
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* MODAL CREATE */}
      <Modal
        open={createOpen}
        onClose={() => (creating ? null : setCreateOpen(false))}
        title="Créer un compte bancaire"
        description="Ajoute un compte (courant, épargne, invest, cash). Le solde est calculé avec les transactions."
      >
        <form onSubmit={onCreate} className="space-y-4">
          <Input
            label="Nom du compte *"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Ex: Courant Revolut"
            error={creationError ?? undefined}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                Type
              </label>
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as any }))}
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
              value={draft.initialEuros}
              onChange={(e) => setDraft((d) => ({ ...d, initialEuros: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <Input
            label="Banque / institution"
            value={draft.institution}
            onChange={(e) => setDraft((d) => ({ ...d, institution: e.target.value }))}
            placeholder="Ex: BNP, Revolut…"
          />

          <Input
            label="IBAN (optionnel)"
            value={draft.iban}
            onChange={(e) => setDraft((d) => ({ ...d, iban: e.target.value }))}
            placeholder="FR76 ...."
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
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
    </div>
  );
}
