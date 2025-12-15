'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';

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
  const accountId = params.accountId;

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
        `/api/personal/transactions?accountId=${encodeURIComponent(accountId)}&limit=80`,
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
              <p className="text-sm text-[var(--text-secondary)]">
                Solde : {centsToEUR(account.balanceCents)} € · 30j :{' '}
                <span className={BigInt(account.delta30Cents) >= 0n ? 'text-emerald-400' : 'text-rose-400'}>
                  {BigInt(account.delta30Cents) >= 0n ? '+' : ''}
                  {centsToEUR(account.delta30Cents)} €
                </span>
              </p>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Historique des transactions du compte.</p>
            )}
          </div>

          <Link
            href="/app/personal/comptes"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-hover)]"
          >
            ← Retour
          </Link>
        </div>
      </Card>

      {error ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-rose-500">Erreur</p>
          <p className="text-sm text-rose-500/90">{error}</p>
        </Card>
      ) : null}

      <Card className="p-5">
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
