import type { ReactNode } from 'react';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <MarketingHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">{children}</main>
      <MarketingFooter />
    </div>
  );
}
