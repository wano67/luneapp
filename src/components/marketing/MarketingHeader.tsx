'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { PivotLogo, PivotWordmark } from '@/components/pivot-icons';
import { cn } from '@/lib/cn';

const navItems = [
  { href: '/features', label: 'Fonctionnalités' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 animate-navbar-in"
      style={{ background: 'var(--shell-sidebar-bg)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <PivotLogo size={32} color="var(--shell-sidebar-text)" />
          <PivotWordmark height={16} color="var(--shell-sidebar-text)" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'font-semibold'
                    : 'opacity-70 hover:opacity-100',
                )}
                style={{
                  fontFamily: 'var(--font-barlow), sans-serif',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  fontSize: 13,
                  color: isActive ? 'var(--shell-sidebar-active-text)' : 'var(--shell-sidebar-text)',
                  background: isActive ? 'var(--shell-sidebar-active-bg)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop CTAs + Mobile hamburger */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm transition-opacity hover:opacity-80 md:inline-flex"
            style={{
              color: 'var(--shell-sidebar-text)',
              fontFamily: 'var(--font-barlow), sans-serif',
              fontWeight: 600,
              fontSize: 13,
              textTransform: 'uppercase',
              padding: '8px 12px',
            }}
          >
            Se connecter
          </Link>
          <Link
            href="/waitlist"
            className="hidden items-center transition-opacity hover:opacity-90 md:inline-flex"
            style={{
              background: 'var(--shell-accent)',
              color: 'white',
              borderRadius: 12,
              padding: '8px 16px',
              fontFamily: 'var(--font-barlow), sans-serif',
              fontWeight: 600,
              fontSize: 13,
              textTransform: 'uppercase',
            }}
          >
            Rejoindre la liste
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-opacity hover:opacity-80 md:hidden"
            style={{ color: 'var(--shell-sidebar-text)' }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen ? (
        <div
          className="animate-menu-in px-4 pb-4 pt-2 md:hidden"
          style={{
            background: 'var(--shell-sidebar-bg)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    'rounded-lg px-3 py-2.5 transition-colors',
                    isActive ? 'font-semibold' : 'opacity-70',
                  )}
                  style={{
                    fontFamily: 'var(--font-barlow), sans-serif',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: 14,
                    color: isActive ? 'var(--shell-sidebar-active-text)' : 'var(--shell-sidebar-text)',
                    background: isActive ? 'var(--shell-sidebar-active-bg)' : 'transparent',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div
            className="mt-3 flex flex-col gap-2 pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="w-full rounded-xl py-2.5 text-center text-sm transition-opacity hover:opacity-80"
              style={{
                color: 'var(--shell-sidebar-text)',
                border: '1px solid rgba(255,255,255,0.2)',
                fontFamily: 'var(--font-barlow), sans-serif',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Se connecter
            </Link>
            <Link
              href="/waitlist"
              onClick={() => setMenuOpen(false)}
              className="w-full rounded-xl py-2.5 text-center text-sm transition-opacity hover:opacity-90"
              style={{
                background: 'var(--shell-accent)',
                color: 'white',
                fontFamily: 'var(--font-barlow), sans-serif',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Rejoindre la liste
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
