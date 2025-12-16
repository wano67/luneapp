'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from './LogoMark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const navItems = [
  { href: '/features', label: 'Fonctionnalités' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/security', label: 'Sécurité' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <LogoMark />
        <nav className="hidden items-center gap-2 text-sm font-medium text-[var(--text-muted)] md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2 transition-colors',
                  isActive
                    ? 'bg-[var(--surface-2)] text-[var(--text)]'
                    : 'hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/login">Se connecter</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Créer un compte</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
