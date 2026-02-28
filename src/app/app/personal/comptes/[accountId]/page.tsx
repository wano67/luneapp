'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balanceCents: string;
  delta30Cents: string;
};

type Txn = {
  id: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  date: string;
  amountCents: string;
  currency: string;
  label: string;
  note?: string | null;
  account: { id: string; name: string };
  category: { id: string; name: string } | null;
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

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Erreur';
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

export default function AccountDetailPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params?.accountId ?? '';

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [items, setItems] = useState<Txn[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      // 1) fetch account details (name, balance, etc.)
      const aRes = await fetch(`/api/personal/accounts/${encodeURIComponent(accountId)}`, {
        credentials: 'include',
      });

      if (aRes.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      const aJson = await safeJson(aRes);
      if (!aRes.ok) throw new Error(getErrorFromJson(aJson) ?? `Erreur compte (${aRes.status})`);

      const accountRaw =
        aJson && typeof aJson === 'object' && 'account' in aJson
          ? (aJson as { account?: unknown }).account
          : null;
      setAccount(accountRaw as Account);

      // 2) fetch transactions
      const tRes = await fetch(
        `/api/personal/transactions?accountId=${encodeURIComponent(accountId)}&limit=10`,
        { credentials: 'include' }
      );

      const tJson = await safeJson(tRes);
      if (!tRes.ok) throw new Error(getErrorFromJson(tJson) ?? `Erreur transactions (${tRes.status})`);

      const itemsRaw =
        tJson && typeof tJson === 'object' && 'items' in tJson
          ? (tJson as { items?: unknown }).items
          : [];

      setItems(Array.isArray(itemsRaw) ? (itemsRaw as Txn[]) : []);
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      setError(getErrorMessage(e) || 'Impossible de charger ce compte.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const title = useMemo(() => account?.name ?? 'Compte', [account]);

  const miniStats = useMemo(() => {
    const income = items
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + BigInt(t.amountCents), 0n);
    const expense = items
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + BigInt(t.amountCents), 0n);
    return {
      income,
      expense,
      count: items.length,
    };
  }, [items]);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Wallet · Compte
            </p>
            <h2 className="text-lg font-semibold">{loading ? 'Chargement…' : title}</h2>

            {account ? (
              <>
                <p className="text-sm text-[var(--text-secondary)]">
                  Vue d’ensemble du compte et de ses dernières transactions.
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Solde : {centsToEUR(account.balanceCents)} € · 30j:{' '}
                  <span className={BigInt(account.delta30Cents) >= 0n ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                    {BigInt(account.delta30Cents) >= 0n ? '+' : ''}
                    {centsToEUR(account.delta30Cents)} €
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Historique des transactions du compte.</p>
            )}
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href="/app/personal/comptes">← Retour</Link>
          </Button>
        </div>
      </Card>

      <Card className="grid gap-3 p-5 md:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Encaissements (sélection)</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {centsToEUR(miniStats.income.toString())} €
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Dépenses (sélection)</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {centsToEUR(miniStats.expense.toString())} €
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Transactions chargées</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{miniStats.count}</p>
        </div>
      </Card>

      {error ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--danger)]">Erreur</p>
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </Card>
      ) : null}

      <Card className="p-5 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Vue rapide du compte</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Dernières opérations et raccourcis dédiés à ce compte.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/personal/transactions?accountId=${encodeURIComponent(accountId)}`}>
                Toutes les transactions
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/app/personal/transactions?accountId=${encodeURIComponent(accountId)}&import=1`}
              >
                Import CSV ciblé
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/app/personal/transactions?accountId=${encodeURIComponent(accountId)}&new=1`}>
                Créer une transaction
              </Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucune transaction pour ce compte.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {items.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.label}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {new Date(t.date).toLocaleDateString('fr-FR')}
                    {t.category ? ` · ${t.category.name}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{centsToEUR(t.amountCents)} €</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{t.type}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
