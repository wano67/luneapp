'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const items = [
  { href: '/app/account/profile', label: 'Profil' },
  { href: '/app/account/security', label: 'Sécurité' },
  { href: '/app/account/preferences', label: 'Préférences' },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]',
              active ? 'bg-[var(--surface-2)] text-[var(--text)]' : ''
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
