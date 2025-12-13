// src/app/app/personal/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';

type SummaryResponse = {
  kpis: {
    totalBalanceCents: string;
    monthIncomeCents: string;
    monthExpenseCents: string; // négatif
    monthNetCents: string;
  };
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    balanceCents: string;
  }>;
  latestTransactions: Array<{
    id: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date: string;
    amountCents: string;
    currency: string;
    label: string;
    note?: string | null;
    account: { id: string; name: string };
    category: { id: string; name: string } | null;
  }>;
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

export default function WalletHomePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/personal/summary', { credentials: 'include' });
      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      const json = await safeJson(res);
      if (!res.ok) throw new Error((json as any)?.error ?? 'Erreur');
      setData(json as SummaryResponse);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('Impossible de charger le Wallet.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const kpi = useMemo(() => {
    const s = data?.kpis;
    if (!s) return null;
    return {
      total: centsToEUR(s.totalBalanceCents),
      income: centsToEUR(s.monthIncomeCents),
      expense: centsToEUR(s.monthExpenseCents),
      net: centsToEUR(s.monthNetCents),
      accountsCount: data?.accounts?.length ?? 0,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
            Wallet · Home
          </p>
          <h2 className="text-lg font-semibold">Wallet</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Vue rapide : solde, cashflow du mois, comptes.
          </p>
        </div>
      </Card>

      {error ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-rose-500">Erreur</p>
          <p className="text-sm text-rose-500/90">{error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs text-[var(--text-secondary)]">Solde total</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '—' : `${kpi?.total ?? '0.00'} €`}</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-[var(--text-secondary)]">Revenus (mois)</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '—' : `${kpi?.income ?? '0.00'} €`}</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-[var(--text-secondary)]">Dépenses (mois)</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '—' : `${kpi?.expense ?? '0.00'} €`}</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-[var(--text-secondary)]">Net (mois)</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '—' : `${kpi?.net ?? '0.00'} €`}</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Comptes</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {loading ? '…' : `${kpi?.accountsCount ?? 0} compte(s)`}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/app/personal/comptes"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-hover)]"
            >
              Gérer les comptes
            </Link>
            <Link
              href="/app/personal/transactions"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-hover)]"
            >
              Voir les transactions
            </Link>
          </div>
        </div>

        <div className="mt-4 divide-y divide-[var(--border)]">
          {loading ? (
            <p className="py-3 text-sm text-[var(--text-secondary)]">Chargement…</p>
          ) : (data?.accounts?.length ?? 0) === 0 ? (
            <p className="py-3 text-sm text-[var(--text-secondary)]">
              Aucun compte. Commence par créer un compte dans “Comptes”.
            </p>
          ) : (
            data!.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {a.type} · {a.currency}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{centsToEUR(a.balanceCents)} €</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Bonus: latest transactions (simple) */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Dernières transactions</p>
            <p className="text-xs text-[var(--text-secondary)]">12 dernières</p>
          </div>
          <Link
            href="/app/personal/transactions"
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            Tout voir →
          </Link>
        </div>

        <div className="mt-4 divide-y divide-[var(--border)]">
          {loading ? (
            <p className="py-3 text-sm text-[var(--text-secondary)]">Chargement…</p>
          ) : (data?.latestTransactions?.length ?? 0) === 0 ? (
            <p className="py-3 text-sm text-[var(--text-secondary)]">Aucune transaction.</p>
          ) : (
            data!.latestTransactions.map((t) => {
              const eur = Number(t.amountCents) / 100;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t.label}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {new Date(t.date).toLocaleDateString('fr-FR')} · {t.account.name}
                      {t.category ? ` · ${t.category.name}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{eur.toFixed(2)} €</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{t.type}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
