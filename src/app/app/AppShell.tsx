'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppSidebar, { type Space } from './AppSidebar';
import ThemeToggle from '@/components/ThemeToggle';

function getCurrentSpace(pathname: string): Space {
  if (pathname.startsWith('/app/pro')) return 'pro';
  if (pathname.startsWith('/app/personal')) return 'perso';
  if (pathname.startsWith('/app/performance')) return 'performance';
  return null;
}

function getBusinessIdFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean); // ["app","pro","1","prospects"]
  if (segments[0] !== 'app') return null;
  if (segments[1] !== 'pro') return null;
  const maybeId = segments[2];
  if (!maybeId) return null;
  if (!/^\d+$/.test(maybeId)) return null;
  return maybeId;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const space = getCurrentSpace(pathname);
  const businessId = getBusinessIdFromPathname(pathname);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false); // mobile

  const topNavItems: { key: Space; label: string; emoji: string; href: string }[] =
    [
      { key: 'pro', label: 'PRO', emoji: '🟦', href: '/app/pro' },
      { key: 'perso', label: 'PERSO', emoji: '🟩', href: '/app/personal' },
      {
        key: 'performance',
        label: 'PERFORMANCE',
        emoji: '🟥',
        href: '/app/performance',
      },
    ];

  const desktopSidebarWidth = sidebarCollapsed ? 'md:w-16' : 'md:w-64';
  const desktopMainPadding = sidebarCollapsed ? 'md:pl-16' : 'md:pl-64';

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      {/* HEADER FIXE */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--background-alt)]/80 px-4 backdrop-blur-md md:px-6">
        {/* Left: burger + logo */}
        <div className="flex items-center gap-3">
          {/* Burger mobile */}
          <button
            type="button"
            aria-label="Ouvrir la navigation"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-sm hover:bg-[var(--surface-hover)] md:hidden"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <span className="sr-only">Ouvrir la navigation</span>
            <div className="space-y-[3px]">
              <span className="block h-[1.5px] w-4 rounded bg-current" />
              <span className="block h-[1.5px] w-4 rounded bg-current" />
              <span className="block h-[1.5px] w-4 rounded bg-current" />
            </div>
          </button>

          {/* Logo / titre OS */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-primary)]">
              SF
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                StudioFief OS
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Système interne · /app
              </span>
            </div>
          </div>
        </div>

        {/* NAV PRO / PERSO / PERFORMANCE - desktop */}
        <nav className="hidden items-center gap-2 text-xs md:flex">
          {topNavItems.map((item) => {
            const isActive = space === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={[
                  'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]'
                    : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                <span>{item.emoji}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: theme + user */}
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <ThemeToggle />
          <div className="hidden items-center gap-2 sm:flex">
            <span>Compte</span>
            <div className="h-7 w-7 rounded-full border border-[var(--border)] bg-[var(--surface-hover)]" />
          </div>
        </div>
      </header>

      {/* SIDEBAR DESKTOP */}
      <aside
        className={[
          'fixed inset-y-14 left-0 z-40 hidden border-r border-[var(--border)] bg-[var(--background-alt)]/75 backdrop-blur-md transition-[width] duration-200 md:flex md:flex-col',
          desktopSidebarWidth,
        ].join(' ')}
      >
        <div className="flex h-full flex-col">
          <AppSidebar
            space={space}
            pathname={pathname}
            businessId={businessId}
            collapsed={sidebarCollapsed}
          />

          {/* Toggle collapse bouton (desktop only) */}
          <div className="border-t border-[var(--border)] p-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              <span className="inline-block h-[1px] w-4 rounded bg-current" />
              <span>{sidebarCollapsed ? 'Déplier' : 'Replier'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* SIDEBAR MOBILE FULL-SCREEN LIQUID GLASS */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Fond “liquid glass” */}
          <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-xl" />

          {/* Contenu du menu */}
          <div className="relative flex h-full w-full flex-col px-4 py-4">
            {/* Header du menu mobile */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                  Navigation
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  Choisis un espace : PRO, PERSO ou PERFORMANCE.
                </span>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setMobileSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                <span className="sr-only">Fermer le menu</span>
                <span className="block h-[1.5px] w-3 rotate-45 rounded bg-current" />
                <span className="block h-[1.5px] w-3 -translate-y-[1.5px] -rotate-45 rounded bg-current" />
              </button>
            </div>

            {/* Onglets PRO / PERSO / PERFORMANCE en haut du menu */}
            <div className="mb-4 flex items-center justify-between gap-2 rounded-full bg-[var(--background-alt)]/80 p-1 text-[11px]">
              {topNavItems.map((item) => {
                const isActive = space === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    scroll={false}
                    className={[
                      'flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1 transition-colors',
                      isActive
                        ? 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                    ].join(' ')}
                  >
                    <span>{item.emoji}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Bloc navigation (AppSidebar) */}
            <div className="flex-1 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--background-alt)]/80 p-3 shadow-xl">
              <AppSidebar
                space={space}
                pathname={pathname}
                businessId={businessId}
                collapsed={false}
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            </div>

            {/* Légende en bas */}
            <div className="mt-3 text-[10px] text-[var(--text-secondary)]">
              La page actuelle est mise en évidence. Tu peux changer d’espace
              en haut ou de vue dans la liste.
            </div>
          </div>
        </div>
      )}

      {/* CONTENU */}
      <main
        className={[
          'min-h-screen pt-14 transition-[padding-left] duration-200',
          'pl-0',
          desktopMainPadding,
        ].join(' ')}
      >
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
