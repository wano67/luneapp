import type { ReactNode } from 'react';
import { PageHeaderPro } from '@/components/pro/PageHeaderPro';
import { TabsPills } from '@/components/pro/TabsPills';
import { cn } from '@/lib/cn';

type TabItem = { key: string; label: ReactNode };

type ProPageShellProps = {
  backHref?: string;
  backLabel?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: ReadonlyArray<TabItem>;
  activeTab?: string;
  onTabChange?: (key: string) => void;
  className?: string;
  children: ReactNode;
};

// Shared wrapper for PRO pages: aligned header + optional tabs + consistent spacing.
export function ProPageShell({
  backHref,
  backLabel = 'Retour',
  title,
  subtitle,
  actions,
  tabs,
  activeTab,
  onTabChange,
  className,
  children,
}: ProPageShellProps) {
  const hasTabs = tabs && tabs.length > 0;
  const resolvedActiveTab = hasTabs ? activeTab ?? tabs[0]?.key : undefined;

  return (
    <div className={cn('mx-auto max-w-6xl space-y-4 px-4 py-4', className)} data-component="pro-page-shell">
      <PageHeaderPro
        backHref={backHref}
        backLabel={backLabel}
        title={title}
        subtitle={subtitle}
        actions={actions}
      />

      {hasTabs && resolvedActiveTab ? (
        <TabsPills
          items={tabs!}
          value={resolvedActiveTab}
          onChange={onTabChange ?? (() => undefined)}
          ariaLabel={`${title} navigation`}
        />
      ) : null}

      {children}
    </div>
  );
}
