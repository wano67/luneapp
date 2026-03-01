"use client";

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { Card } from '@/components/ui/card';
import { FinanceEntriesPanel } from '@/components/pro/finances/FinanceEntriesPanel';
import { PaymentsPanel } from '@/components/pro/finances/PaymentsPanel';
import { TreasuryPanel } from '@/components/pro/finances/TreasuryPanel';
import { VatPanel } from '@/components/pro/finances/VatPanel';
import { ForecastingPanel } from '@/components/pro/finances/ForecastingPanel';
import { LedgerPanel } from '@/components/pro/finances/LedgerPanel';
import { FixedChargesPanel } from '@/components/pro/finances/FixedChargesPanel';

type Props = { businessId: string };

const TABS = [
  { key: 'entries', label: 'Écritures' },
  { key: 'payments', label: 'Paiements' },
  { key: 'charges', label: 'Charges fixes' },
  { key: 'treasury', label: 'Trésorerie' },
  { key: 'vat', label: 'TVA' },
  { key: 'forecasting', label: 'Prévisions' },
  { key: 'ledger', label: 'Grand livre' },
  { key: 'reports', label: 'Rapports' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AccountingPage({ businessId }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedTab = (searchParams?.get('tab') ?? TABS[0].key) as TabKey;
  const currentTab = useMemo(
    () => (TABS.some((t) => t.key === requestedTab) ? requestedTab : TABS[0].key),
    [requestedTab]
  );

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const content = useMemo(() => {
    switch (currentTab) {
      case 'entries':
        return <FinanceEntriesPanel businessId={businessId} />;
      case 'payments':
        return <PaymentsPanel businessId={businessId} />;
      case 'charges':
        return <FixedChargesPanel businessId={businessId} />;
      case 'treasury':
        return <TreasuryPanel businessId={businessId} />;
      case 'vat':
        return <VatPanel businessId={businessId} />;
      case 'forecasting':
        return <ForecastingPanel businessId={businessId} />;
      case 'ledger':
        return <LedgerPanel businessId={businessId} />;
      case 'reports':
        return (
          <Card className="p-4 text-sm text-[var(--text-secondary)]">
            Rapports comptables à venir. Configurez vos écritures pour préparer les exports.
          </Card>
        );
      default:
        return <FinanceEntriesPanel businessId={businessId} />;
    }
  }, [businessId, currentTab]);

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Comptabilité"
      subtitle="Écritures, paiements, TVA et prévisions."
      tabs={TABS}
      activeTab={currentTab}
      onTabChange={handleTabChange}
    >
      <div className="space-y-4">{content}</div>
    </ProPageShell>
  );
}
