import type { ReactNode } from 'react';
import { AccountHeader } from './AccountHeader';
import { AccountNav } from './AccountNav';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <AccountHeader />
      <AccountNav />
      {children}
    </div>
  );
}
