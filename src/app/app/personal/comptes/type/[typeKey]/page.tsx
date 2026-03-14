'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { fmtKpi } from '@/lib/format';
import { annualYieldCents, formatRateBps, loanMonthlyPaymentCents, loanTotalInterestCents } from '@/lib/finance';
import { BANK_MAP } from '@/config/banks';
import BankGroup from '../../BankGroup';
import { type AccountItem } from '../../AccountCard';

/* ═══ Type Key mapping ═══ */

type TypeKeyConfig = {
  label: string;
  types: AccountItem['type'][];
  icon: string;
  tips: string[];
};

const TYPE_KEY_MAP: Record<string, TypeKeyConfig> = {
  courant: {
    label: 'Comptes courants',
    types: ['CURRENT', 'CASH'],
    icon: '💳',
    tips: [
      'Gardez l\'équivalent de 2-3 mois de charges sur votre compte courant.',
      'Automatisez vos virements d\'épargne en début de mois.',
      'Surveillez vos dépenses récurrentes : abonnements oubliés, assurances en double…',
    ],
  },
  epargne: {
    label: 'Épargne',
    types: ['SAVINGS'],
    icon: '🏦',
    tips: [
      'Remplissez votre Livret A et LDDS avant d\'ouvrir d\'autres placements.',
      'Les intérêts de l\'épargne réglementée sont calculés par quinzaine.',
      'Diversifiez entre épargne de précaution (3-6 mois) et épargne projets.',
    ],
  },
  investissement: {
    label: 'Investissement',
    types: ['INVEST'],
    icon: '📈',
    tips: [
      'Investissez régulièrement (DCA) plutôt que de chercher le bon moment.',
      'Privilégiez le PEA pour les actions européennes (fiscalité avantageuse après 5 ans).',
      'Ne consultez pas vos placements tous les jours : la volatilité est normale.',
    ],
  },
  prets: {
    label: 'Prêts',
    types: ['LOAN'],
    icon: '🏠',
    tips: [
      'Comparez les offres de plusieurs banques avant de signer.',
      'Un remboursement anticipé partiel peut réduire significativement le coût total.',
      'Renégociez votre taux si les taux du marché baissent de plus de 0,7 point.',
    ],
  },
};

type Stats = {
  income30d: string;
  expense30d: string;
  txnCount30d: number;
  topExpenseCategories: { name: string; totalCents: string }[];
  topIncomeCategories: { name: string; totalCents: string }[];
};

type BankGroupData = {
  bankKey: string;
  bankName: string;
  bankWebsiteUrl: string | null;
  accounts: AccountItem[];
  totalCents: bigint;
};

export default function AccountTypePage() {
  const params = useParams<{ typeKey: string }>();
  const router = useRouter();
  const typeKey = params?.typeKey ?? '';
  const config = TYPE_KEY_MAP[typeKey];
  usePageTitle(config?.label ?? 'Comptes');

  const [loading, setLoading] = useState(true);
  const [allAccounts, setAllAccounts] = useState<AccountItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!config) {
    notFound();
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        fetchJson<{ items: AccountItem[] }>('/api/personal/accounts'),
        fetchJson<Stats>(`/api/personal/accounts/stats?types=${config.types.join(',')}`),
      ]);
      if (aRes.status === 401 || sRes.status === 401) {
        window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!aRes.ok || !aRes.data) throw new Error(aRes.error ?? 'Erreur');
      setAllAccounts(aRes.data.items ?? []);
      if (sRes.ok && sRes.data) setStats(sRes.data);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [config.types]);

  useEffect(() => { void load(); }, [load]);

  const accounts = useMemo(
    () => allAccounts.filter((a) => config.types.includes(a.type) && !a.hidden),
    [allAccounts, config.types],
  );

  const totalCents = useMemo(
    () => accounts.reduce((s, a) => s + BigInt(typeKey === 'prets' ? (a.loanPrincipalCents || '0') : (a.balanceCents || '0')), 0n),
    [accounts, typeKey],
  );

  const totalDelta30 = useMemo(
    () => accounts.reduce((s, a) => s + BigInt(a.delta30Cents || '0'), 0n),
    [accounts],
  );

  // Savings-specific: total annual yield
  const totalAnnualYield = useMemo(() => {
    if (typeKey !== 'epargne') return 0n;
    return accounts.reduce((s, a) => {
      if (!a.interestRateBps) return s;
      return s + annualYieldCents(BigInt(a.balanceCents || '0'), a.interestRateBps);
    }, 0n);
  }, [accounts, typeKey]);

  // Savings-specific: weighted average rate
  const avgRateBps = useMemo(() => {
    if (typeKey !== 'epargne' && typeKey !== 'prets') return null;
    const weighted = accounts.reduce((s, a) => {
      const bal = BigInt(typeKey === 'prets' ? (a.loanPrincipalCents || '0') : (a.balanceCents || '0'));
      return s + Number(bal) * (a.interestRateBps || 0);
    }, 0);
    const totalBal = accounts.reduce((s, a) => {
      return s + Number(BigInt(typeKey === 'prets' ? (a.loanPrincipalCents || '0') : (a.balanceCents || '0')));
    }, 0);
    if (totalBal === 0) return null;
    return Math.round(weighted / totalBal);
  }, [accounts, typeKey]);

  // Loans: total monthly payments, total interest
  const loanAggregates = useMemo(() => {
    if (typeKey !== 'prets') return null;
    let monthlyTotal = 0n;
    let interestTotal = 0n;
    for (const a of accounts) {
      if (a.loanPrincipalCents && a.interestRateBps && a.loanDurationMonths) {
        const p = BigInt(a.loanPrincipalCents);
        monthlyTotal += loanMonthlyPaymentCents(p, a.interestRateBps, a.loanDurationMonths);
        interestTotal += loanTotalInterestCents(p, a.interestRateBps, a.loanDurationMonths);
      }
    }
    return { monthlyTotal, interestTotal };
  }, [accounts, typeKey]);

  // Bank grouping
  const bankGroups = useMemo<BankGroupData[]>(() => {
    const map = new Map<string, AccountItem[]>();
    for (const a of accounts) {
      let key: string;
      if (a.bankCode && BANK_MAP.has(a.bankCode)) key = a.bankCode;
      else if (a.institution) key = `OTHER:${a.institution}`;
      else key = 'UNKNOWN';
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }

    const groups: BankGroupData[] = [];
    for (const [key, accs] of map) {
      let bankName: string;
      let bankWebsiteUrl: string | null = null;
      if (key === 'UNKNOWN') bankName = 'Autre';
      else if (key.startsWith('OTHER:')) bankName = key.slice(6);
      else {
        const bank = BANK_MAP.get(key)!;
        bankName = bank.name;
        bankWebsiteUrl = bank.websiteUrl;
      }
      const total = accs.reduce(
        (s, a) => s + BigInt(typeKey === 'prets' ? (a.loanPrincipalCents || '0') : (a.balanceCents || '0')),
        0n,
      );
      groups.push({ bankKey: key, bankName, bankWebsiteUrl, accounts: accs, totalCents: total });
    }

    groups.sort((a, b) => {
      const aO = a.bankKey === 'UNKNOWN' ? 2 : a.bankKey.startsWith('OTHER:') ? 1 : 0;
      const bO = b.bankKey === 'UNKNOWN' ? 2 : b.bankKey.startsWith('OTHER:') ? 1 : 0;
      if (aO !== bO) return aO - bO;
      return a.bankName.localeCompare(b.bankName, 'fr');
    });

    return groups;
  }, [accounts, typeKey]);

  const deltaPositive = totalDelta30 >= 0n;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={`${config.icon} ${config.label}`}
        subtitle={`${accounts.length} ${accounts.length > 1 ? 'comptes' : 'compte'}`}
        backHref="/app/personal/comptes"
        backLabel="Comptes"
      />

      {error ? (
        <Card className="p-4 text-sm text-[var(--danger)]">{error}</Card>
      ) : null}

      {/* ─── KPI Cards ─── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="h-4 w-20 rounded bg-[var(--surface-2)] animate-skeleton-pulse" />
              <div className="mt-2 h-8 w-28 rounded bg-[var(--surface-2)] animate-skeleton-pulse" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Total */}
          <Card className="p-4 flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--text-faint)]">
              {typeKey === 'prets' ? 'Encours total' : 'Solde total'}
            </span>
            <span className="text-2xl font-extrabold" style={{ color: typeKey === 'prets' ? 'var(--danger)' : 'var(--shell-accent)' }}>
              {fmtKpi(totalCents.toString())}
            </span>
          </Card>

          {/* Delta 30d */}
          {typeKey !== 'prets' ? (
            <Card className="p-4 flex flex-col gap-1">
              <span className="text-sm font-medium text-[var(--text-faint)]">Variation 30j</span>
              <span className="text-2xl font-extrabold" style={{ color: deltaPositive ? 'var(--success)' : 'var(--danger)' }}>
                {deltaPositive ? '+' : ''}{fmtKpi(totalDelta30.toString())}
              </span>
            </Card>
          ) : null}

          {/* Courant: Income 30d */}
          {typeKey === 'courant' && stats ? (
            <>
              <Card className="p-4 flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--text-faint)]">Revenus (30j)</span>
                <span className="text-2xl font-extrabold text-[var(--success)]">
                  +{fmtKpi(stats.income30d)}
                </span>
              </Card>
              <Card className="p-4 flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--text-faint)]">Dépenses (30j)</span>
                <span className="text-2xl font-extrabold text-[var(--danger)]">
                  {fmtKpi(stats.expense30d)}
                </span>
              </Card>
            </>
          ) : null}

          {/* Épargne: Annual yield + Avg rate */}
          {typeKey === 'epargne' ? (
            <>
              <Card className="p-4 flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--text-faint)]">Rendement annuel</span>
                <span className="text-2xl font-extrabold text-[var(--success)]">
                  ~{fmtKpi(totalAnnualYield.toString())}
                </span>
              </Card>
              {avgRateBps ? (
                <Card className="p-4 flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--text-faint)]">Taux moyen pondéré</span>
                  <span className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>
                    {formatRateBps(avgRateBps)}
                  </span>
                </Card>
              ) : null}
            </>
          ) : null}

          {/* Investissement: count + delta */}
          {typeKey === 'investissement' ? (
            <Card className="p-4 flex flex-col gap-1">
              <span className="text-sm font-medium text-[var(--text-faint)]">Comptes</span>
              <span className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>
                {accounts.length}
              </span>
            </Card>
          ) : null}

          {/* Prêts: Monthly total + Interest total + Avg rate */}
          {typeKey === 'prets' && loanAggregates ? (
            <>
              <Card className="p-4 flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--text-faint)]">Mensualités totales</span>
                <span className="text-2xl font-extrabold" style={{ color: 'var(--shell-accent)' }}>
                  {fmtKpi(loanAggregates.monthlyTotal.toString())}
                </span>
              </Card>
              <Card className="p-4 flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--text-faint)]">Intérêts totaux</span>
                <span className="text-2xl font-extrabold text-[var(--danger)]">
                  {fmtKpi(loanAggregates.interestTotal.toString())}
                </span>
              </Card>
              {avgRateBps ? (
                <Card className="p-4 flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--text-faint)]">Taux moyen</span>
                  <span className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>
                    {formatRateBps(avgRateBps)}
                  </span>
                </Card>
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {/* ─── Top categories (courant only) ─── */}
      {typeKey === 'courant' && stats && (stats.topExpenseCategories.length > 0 || stats.topIncomeCategories.length > 0) ? (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.topExpenseCategories.length > 0 ? (
            <Card className="p-5">
              <p className="text-sm font-semibold mb-3">Top dépenses (30j)</p>
              <div className="space-y-2">
                {stats.topExpenseCategories.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text)]">{c.name}</span>
                    <span className="font-semibold text-[var(--danger)]">{fmtKpi(c.totalCents)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          {stats.topIncomeCategories.length > 0 ? (
            <Card className="p-5">
              <p className="text-sm font-semibold mb-3">Top revenus (30j)</p>
              <div className="space-y-2">
                {stats.topIncomeCategories.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text)]">{c.name}</span>
                    <span className="font-semibold text-[var(--success)]">+{fmtKpi(c.totalCents)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* ─── Tips ─── */}
      <Card className="p-5">
        <p className="text-sm font-semibold mb-3">Conseils</p>
        <ul className="space-y-2">
          {config.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <span className="mt-0.5 text-xs text-[var(--text-faint)]">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ─── Accounts grouped by bank ─── */}
      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
        </Card>
      ) : accounts.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-faint)]">Aucun compte de ce type.</p>
          <Button asChild className="mt-3" size="sm">
            <Link href="/app/personal/comptes">Retour aux comptes</Link>
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {bankGroups.map((bg) => (
            <BankGroup
              key={bg.bankKey}
              bankName={bg.bankName}
              bankWebsiteUrl={bg.bankWebsiteUrl}
              totalCents={bg.totalCents}
              accounts={bg.accounts}
              onEdit={() => {}}
              onNavigate={(id) => router.push(`/app/personal/comptes/${id}`)}
            />
          ))}
        </div>
      )}

      {/* ─── Stats: Transaction count ─── */}
      {stats && stats.txnCount30d > 0 ? (
        <Card className="p-4">
          <p className="text-xs text-[var(--text-faint)]">Transactions (30 derniers jours)</p>
          <p className="mt-1 text-lg font-semibold">{stats.txnCount30d}</p>
        </Card>
      ) : null}
    </PageContainer>
  );
}
