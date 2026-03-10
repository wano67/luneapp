'use client';

import { FaviconAvatar } from '@/app/app/components/FaviconAvatar';
import { fmtKpi } from '@/lib/format';
import AccountCard, { type AccountItem } from './AccountCard';

type Props = {
  bankName: string;
  bankWebsiteUrl: string | null;
  totalCents: bigint;
  accounts: AccountItem[];
  onEdit: (account: AccountItem) => void;
  onNavigate: (id: string) => void;
};

export default function BankGroup({
  bankName,
  bankWebsiteUrl,
  totalCents,
  accounts,
  onEdit,
  onNavigate,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FaviconAvatar
            name={bankName}
            websiteUrl={bankWebsiteUrl}
            size={28}
          />
          <span className="text-sm font-semibold text-white">
            {bankName}
          </span>
        </div>
        <span className="text-sm font-medium text-white/70">
          {fmtKpi(totalCents.toString())}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            onEdit={onEdit}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
