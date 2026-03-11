"use client";

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { FinanceEntriesPanel } from '@/components/pro/finances/FinanceEntriesPanel';
import { PaymentsPanel } from '@/components/pro/finances/PaymentsPanel';
import { TreasuryPanel } from '@/components/pro/finances/TreasuryPanel';
import { VatPanel } from '@/components/pro/finances/VatPanel';
import { ForecastingPanel } from '@/components/pro/finances/ForecastingPanel';
import { LedgerPanel } from '@/components/pro/finances/LedgerPanel';
import { FixedChargesPanel } from '@/components/pro/finances/FixedChargesPanel';
import { DashboardPanel } from '@/components/pro/finances/DashboardPanel';
import { ReportsPanel } from '@/components/pro/finances/ReportsPanel';
import { DirigeantPanel } from '@/components/pro/finances/DirigeantPanel';

type Props = { businessId: string };

const TABS = [
  { key: 'overview', label: 'Vue d\'ensemble' },
  { key: 'entries', label: 'Écritures' },
  { key: 'payments', label: 'Paiements' },
  { key: 'charges', label: 'Charges fixes' },
  { key: 'treasury', label: 'Trésorerie' },
  { key: 'vat', label: 'TVA' },
  { key: 'forecasting', label: 'Prévisions' },
  { key: 'ledger', label: 'Grand livre' },
  { key: 'reports', label: 'Rapports' },
  { key: 'dirigeant', label: 'Dirigeant & Associes' },
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
      case 'overview':
        return <DashboardPanel businessId={businessId} />;
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
        return <ReportsPanel businessId={businessId} />;
      case 'dirigeant':
        return <DirigeantPanel businessId={businessId} />;
      default:
        return <DashboardPanel businessId={businessId} />;
    }
  }, [businessId, currentTab]);

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Comptabilité"
      subtitle="Situation financière, écritures, TVA et rapports comptables."
      tabs={TABS}
      activeTab={currentTab}
      onTabChange={handleTabChange}
    >
      <div className="space-y-4">{content}</div>
    </ProPageShell>
  );
}
