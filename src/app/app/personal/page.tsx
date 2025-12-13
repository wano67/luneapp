// src/app/app/personal/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Summary = {
  kpis: {
    totalBalanceCents: string;
    monthNetCents: string;
    monthIncomeCents: string;
    monthExpenseCents: string; // négatif
  };
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    balanceCents: string;
    institution?: string | null;
  }>;
  latestTransactions: Array<{
    id: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date: string;
    amountCents: string;
    label: string;
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

function formatEURFromCents(centsStr: string) {
  const cents = Number(centsStr);
  const eur = cents / 100;
  return eur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function WalletHomePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Summary | null>(null);
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

      const json = (await safeJson(res)) as Summary | null;
      if (!res.ok) throw new Error((json as any)?.error ?? 'Failed');

      setData(json);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Impossible de charger Wallet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const kpis = useMemo(() => data?.kpis, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Wallet · Accueil
            </p>
            <h2 className="text-lg font-semibold">Wallet</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Comptes, cashflow et dernières opérations.
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/app/personal/transactions">
              <Button>Ajouter une transaction</Button>
            </Link>
            <Link href="/app/personal/comptes">
              <Button variant="outline">Gérer les comptes</Button>
            </Link>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="p-5">
          <p className="text-sm text-rose-500">{error}</p>
          <div className="mt-3">
            <Button onClick={load}>Réessayer</Button>
          </div>
        </Card>
      ) : null}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-[var(--text-secondary)]">Solde total</p>
          <p className="mt-1 text-xl font-semibold">
            {kpis ? formatEURFromCents(kpis.totalBalanceCents) : '—'}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-[var(--text-secondary)]">Cashflow mois</p>
          <p className="mt-1 text-xl font-semibold">
            {kpis ? formatEURFromCents(kpis.monthNetCents) : '—'}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            Revenus – dépenses
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-[var(--text-secondary)]">Revenus mois</p>
          <p className="mt-1 text-xl font-semibold">
            {kpis ? formatEURFromCents(kpis.monthIncomeCents) : '—'}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-[var(--text-secondary)]">Dépenses mois</p>
          <p className="mt-1 text-xl font-semibold">
            {kpis ? formatEURFromCents(kpis.monthExpenseCents) : '—'}
          </p>
        </Card>
      </div>

      {/* Accounts + Latest */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Comptes</p>
            <Link href="/app/personal/comptes" className="text-xs font-semibold text-[var(--accent)] hover:underline">
              Voir tout →
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
          ) : (data?.accounts?.length ?? 0) === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--text-secondary)]">Aucun compte pour le moment.</p>
              <Link href="/app/personal/comptes">
                <Button variant="outline">Créer un compte</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {data!.accounts.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {a.institution ? `${a.institution} · ` : ''}
                      {a.type}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatEURFromCents(a.balanceCents)}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{a.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Dernières transactions</p>
            <Link href="/app/personal/transactions" className="text-xs font-semibold text-[var(--accent)] hover:underline">
              Voir tout →
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
          ) : (data?.latestTransactions?.length ?? 0) === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Aucune transaction.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {data!.latestTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t.label}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {new Date(t.date).toLocaleDateString('fr-FR')} · {t.account.name}
                      {t.category ? ` · ${t.category.name}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatEURFromCents(t.amountCents)}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{t.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
