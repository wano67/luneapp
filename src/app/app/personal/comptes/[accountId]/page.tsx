'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';

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

export default function AccountDetailPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params?.accountId ?? '';

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [items, setItems] = useState<Txn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const aRes = await fetchJson<{ account: Account }>(
        `/api/personal/accounts/${encodeURIComponent(accountId)}`
      );
      if (aRes.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      if (!aRes.ok || !aRes.data) throw new Error(aRes.error ?? `Erreur compte`);
      setAccount(aRes.data.account);

      const tRes = await fetchJson<{ items: Txn[] }>(
        `/api/personal/transactions?accountId=${encodeURIComponent(accountId)}&limit=10`
      );
      if (!tRes.ok || !tRes.data) throw new Error(tRes.error ?? `Erreur transactions`);
      setItems(tRes.data.items ?? []);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = useMemo(() => account?.name ?? 'Compte', [account]);

  const miniStats = useMemo(() => {
    const income = items
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + BigInt(t.amountCents), 0n);
    const expense = items
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + BigInt(t.amountCents), 0n);
    return { income, expense, count: items.length };
  }, [items]);

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title={loading ? 'Chargement…' : title}
        subtitle={
          account
            ? `Solde : ${formatCentsToEuroDisplay(account.balanceCents)} · Var. 30j : ${formatCentsToEuroDisplay(account.delta30Cents)}`
            : 'Historique des transactions du compte.'
        }
        backHref="/app/personal/comptes"
        backLabel="Comptes"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/personal/transactions?accountId=${encodeURIComponent(accountId)}`}>
                Toutes les transactions
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/app/personal/transactions?accountId=${encodeURIComponent(accountId)}&new=1`}>
                Nouvelle transaction
              </Link>
            </Button>
          </div>
        }
      />

      {error ? (
        <Card className="p-4 text-sm text-[var(--danger)]">{error}</Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-[var(--text-faint)]">Encaissements (sélection)</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCentsToEuroDisplay(miniStats.income.toString())}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--text-faint)]">Dépenses (sélection)</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCentsToEuroDisplay(miniStats.expense.toString())}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--text-faint)]">Transactions chargées</p>
          <p className="mt-1 text-lg font-semibold">{miniStats.count}</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Dernières opérations</p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/personal/transactions?accountId=${encodeURIComponent(accountId)}&import=1`}>
              Import CSV
            </Link>
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">Aucune transaction pour ce compte.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {items.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.label}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {new Date(t.date).toLocaleDateString('fr-FR')}
                    {t.category ? ` · ${t.category.name}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatCentsToEuroDisplay(t.amountCents)}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">{t.type}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
