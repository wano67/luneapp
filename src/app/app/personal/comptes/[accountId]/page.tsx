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
      if (!aRes.ok) {
        const msg = (aJson as any)?.error ?? `Erreur compte (${aRes.status})`;
        throw new Error(msg);
      }
      setAccount((aJson as any).account as Account);

      // 2) fetch transactions
      const tRes = await fetch(
        `/api/personal/transactions?accountId=${encodeURIComponent(accountId)}&limit=80`,
        { credentials: 'include' }
      );

      const tJson = await safeJson(tRes);
      if (!tRes.ok) {
        const msg = (tJson as any)?.error ?? `Erreur transactions (${tRes.status})`;
        throw new Error(msg);
      }

      setItems((tJson?.items ?? []) as Txn[]);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Impossible de charger ce compte.');
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
                <span className={Number(account.delta30Cents) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {Number(account.delta30Cents) >= 0 ? '+' : ''}
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
