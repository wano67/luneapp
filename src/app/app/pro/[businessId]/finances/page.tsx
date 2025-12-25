'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { FinanceEntriesPanel } from '@/components/pro/finances/FinanceEntriesPanel';
import { TreasuryPanel } from '@/components/pro/finances/TreasuryPanel';
import { VatPanel } from '@/components/pro/finances/VatPanel';
import { ForecastingPanel } from '@/components/pro/finances/ForecastingPanel';
import { LedgerPanel } from '@/components/pro/finances/LedgerPanel';
import { PaymentsPanel } from '@/components/pro/finances/PaymentsPanel';

const TABS = [
  { key: 'overview', label: 'Écritures' },
  { key: 'payments', label: 'Paiements' },
  { key: 'treasury', label: 'Trésorerie' },
  { key: 'vat', label: 'TVA' },
  { key: 'forecasting', label: 'Prévisions' },
  { key: 'ledger', label: 'Grand livre' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function FinancesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const businessId = (params?.businessId ?? '') as string;
  const requestedTab = (searchParams?.get('tab') ?? 'overview') as TabKey;
  const currentTab = useMemo(
    () => (TABS.some((t) => t.key === requestedTab) ? requestedTab : 'overview'),
    [requestedTab]
  );

  const content = useMemo(() => {
    switch (currentTab) {
      case 'overview':
        return <FinanceEntriesPanel businessId={businessId} />;
      case 'payments':
        return <PaymentsPanel businessId={businessId} />;
      case 'treasury':
        return <TreasuryPanel businessId={businessId} />;
      case 'vat':
        return <VatPanel businessId={businessId} />;
      case 'forecasting':
        return <ForecastingPanel businessId={businessId} />;
      case 'ledger':
        return <LedgerPanel businessId={businessId} />;
      default:
        return <FinanceEntriesPanel businessId={businessId} />;
    }
  }, [businessId, currentTab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => {
          const href = `${pathname}?tab=${tab.key}`;
          const active = tab.key === currentTab;
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={[
                'card-interactive inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition',
                active
                  ? 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div>{content}</div>
    </div>
  );
}
