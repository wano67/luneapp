'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { LogoMark } from './LogoMark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const navItems = [
  { href: '/features', label: 'Fonctionnalités' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/about', label: 'À propos' },
  { href: '/security', label: 'Sécurité' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <LogoMark />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm font-medium text-[var(--text-muted)] md:flex">
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
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/register">Créer un compte</Link>
          </Button>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)] md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen ? (
        <div className="border-t border-[var(--border)] bg-[var(--bg)] px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-0.5 text-sm font-medium">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    'rounded-lg px-3 py-2.5 transition-colors',
                    isActive
                      ? 'bg-[var(--surface-2)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
            <Button asChild variant="outline" size="sm" className="w-full justify-center">
              <Link href="/login" onClick={() => setMenuOpen(false)}>Se connecter</Link>
            </Button>
            <Button asChild size="sm" className="w-full justify-center">
              <Link href="/register" onClick={() => setMenuOpen(false)}>Créer un compte</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
