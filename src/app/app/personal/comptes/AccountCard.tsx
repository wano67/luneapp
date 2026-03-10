'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fmtKpi } from '@/lib/format';
import { loanMonthlyPaymentCents, annualYieldCents, formatRateBps } from '@/lib/finance';

export type AccountItem = {
  id: string;
  name: string;
  type: 'CURRENT' | 'SAVINGS' | 'INVEST' | 'CASH' | 'LOAN';
  currency: string;
  institution: string | null;
  iban: string | null;
  initialCents: string;
  balanceCents: string;
  delta30Cents: string;
  bankCode: string | null;
  productCode: string | null;
  interestRateBps: number | null;
  loanPrincipalCents: string | null;
  loanDurationMonths: number | null;
  loanStartDate: string | null;
  hidden: boolean;
};

type Props = {
  account: AccountItem;
  onEdit: (account: AccountItem) => void;
  onNavigate: (id: string) => void;
};

export default function AccountCard({ account: a, onEdit, onNavigate }: Props) {
  const isLoan = a.type === 'LOAN';
  const deltaBig = BigInt(a.delta30Cents || '0');

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button,a,input,select,textarea')) return;
        onNavigate(a.id);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = e.target as HTMLElement | null;
        if (target?.closest('button,a,input,select,textarea')) return;
        e.preventDefault();
        onNavigate(a.id);
      }}
      className={`min-w-0 overflow-hidden p-4 text-left hover:bg-[var(--surface-hover)] cursor-pointer transition-colors ${a.hidden ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold">{a.name}</p>
            {a.hidden ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-faint)] shrink-0">
                Masqué
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            {a.currency}
            {a.institution ? ` · ${a.institution}` : ''}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(a);
          }}
        >
          Modifier
        </Button>
      </div>

      {isLoan ? (
        <>
          <div className="flex items-end justify-between gap-3 mt-3">
            <div>
              <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                {fmtKpi(a.loanPrincipalCents || '0')}
              </span>
              <span className="text-xs text-[var(--text-faint)] ml-1.5">emprunté</span>
            </div>
            {a.interestRateBps ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-[var(--text)]">
                {formatRateBps(a.interestRateBps)}
              </span>
            ) : null}
          </div>
          {a.loanPrincipalCents && a.interestRateBps && a.loanDurationMonths ? (
            <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-faint)]">
              <span className="font-semibold text-[var(--text)]">
                {fmtKpi(loanMonthlyPaymentCents(BigInt(a.loanPrincipalCents), a.interestRateBps, a.loanDurationMonths).toString())}/mois
              </span>
              <span>·</span>
              <span>{a.loanDurationMonths} mois</span>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3 mt-3">
            <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {fmtKpi(a.balanceCents)}
            </span>
            <span
              className="text-xs font-semibold shrink-0"
              style={{ color: deltaBig >= 0n ? 'var(--success)' : 'var(--danger)' }}
            >
              {deltaBig >= 0n ? '+' : ''}{fmtKpi(a.delta30Cents)} · 30j
            </span>
          </div>
          {a.interestRateBps ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--success-bg)] text-[var(--success)]">
                {formatRateBps(a.interestRateBps)}
              </span>
              {BigInt(a.balanceCents || '0') > 0n ? (
                <span className="text-xs text-[var(--text-faint)]">
                  ~{fmtKpi(annualYieldCents(BigInt(a.balanceCents || '0'), a.interestRateBps).toString())}/an
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
