// src/app/app/AppShell.tsx
'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppSidebar, { type Space } from './AppSidebar';

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

  const topNavItems: { key: Space; label: string; emoji: string; href: string }[] = [
    { key: 'pro', label: 'PRO', emoji: '🟦', href: '/app/pro' },
    { key: 'perso', label: 'PERSO', emoji: '🟩', href: '/app/personal' },
    { key: 'performance', label: 'PERFORMANCE', emoji: '🟥', href: '/app/performance' },
  ];

  const desktopSidebarWidth = sidebarCollapsed ? 'md:w-16' : 'md:w-64';
  const desktopMainPadding = sidebarCollapsed ? 'md:pl-16' : 'md:pl-64';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {/* HEADER FIXE */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 md:px-6">
        {/* Left: burger + logo */}
        <div className="flex items-center gap-3">
          {/* Burger mobile */}
          <button
            type="button"
            aria-label="Ouvrir la navigation"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
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
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              SF
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                StudioFief OS
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
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
                    ? 'bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900',
                ].join(' ')}
              >
                <span>{item.emoji}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: user slot */}
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="hidden sm:inline">Compte</span>
          <div className="h-7 w-7 rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
        </div>
      </header>

      {/* SIDEBAR DESKTOP */}
      <aside
        className={[
          'fixed inset-y-14 left-0 z-40 hidden border-r border-slate-200 bg-white/95 backdrop-blur transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-950/95 md:flex md:flex-col',
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
          <div className="border-t border-slate-200 p-2 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
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
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xl" />

          {/* Contenu du menu */}
          <div className="relative flex h-full w-full flex-col px-4 py-4">
            {/* Header du menu mobile */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                  Navigation
                </span>
                <span className="text-xs text-slate-400">
                  Choisis un espace : PRO, PERSO ou PERFORMANCE.
                </span>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setMobileSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 text-slate-100 hover:bg-slate-800"
              >
                <span className="sr-only">Fermer le menu</span>
                <span className="block h-[1.5px] w-3 rotate-45 rounded bg-current" />
                <span className="block h-[1.5px] w-3 -translate-y-[1.5px] -rotate-45 rounded bg-current" />
              </button>
            </div>

            {/* Onglets PRO / PERSO / PERFORMANCE en haut du menu */}
            <div className="mb-4 flex items-center justify-between gap-2 rounded-full bg-slate-900/60 p-1 text-[11px]">
            {topNavItems.map((item) => {
              const isActive = space === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    scroll={false} // on garde le contexte, menu reste ouvert
                    className={[
                      'flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1 transition-colors',
                      isActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-300 hover:bg-slate-800',
                    ].join(' ')}
                  >
                   <span>{item.emoji}</span>
                   <span className="font-medium">{item.label}</span>
                 </Link>
               );
             })}
          </div>


            {/* Bloc navigation (AppSidebar) */}
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-950/60 p-3 shadow-xl">
              <AppSidebar
                space={space}
                pathname={pathname}
                businessId={businessId}
                collapsed={false}
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            </div>

            {/* Légende en bas */}
            <div className="mt-3 text-[10px] text-slate-400">
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
