// src/app/app/AppShell.tsx
'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppSidebar from './AppSidebar';

type Space = 'pro' | 'perso' | 'performance' | null;

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const topNavItems: { key: Space; label: string; emoji: string; href: string }[] = [
    { key: 'pro', label: 'PRO', emoji: '🟦', href: '/app/pro' },
    { key: 'perso', label: 'PERSO', emoji: '🟩', href: '/app/personal' },
    { key: 'performance', label: 'PERFORMANCE', emoji: '🟥', href: '/app/performance' },
  ];

  const mainPaddingDesktop = sidebarCollapsed ? 'md:pl-20' : 'md:pl-64';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* HEADER FIXE */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-800/80 bg-slate-950/95 px-4 md:px-6 backdrop-blur">
        {/* Logo / titre OS + burger mobile */}
        <div className="flex items-center gap-3">
          {/* Burger mobile */}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/70 text-slate-200 hover:bg-slate-800 md:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Ouvrir la navigation"
          >
            <span className="block h-[2px] w-4 bg-current" />
            <span className="mt-[3px] block h-[2px] w-4 bg-current" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs">
              SF
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                StudioFief OS
              </span>
              <span className="text-xs text-slate-400">Système interne · /app</span>
            </div>
          </div>
        </div>

        {/* NAV PRO / PERSO / PERFORMANCE */}
        <nav className="hidden items-center gap-2 text-xs sm:flex">
          {topNavItems.map((item) => {
            const isActive = space === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={[
                  'flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'border border-slate-700/70 text-slate-300 hover:bg-slate-900 hover:text-slate-50',
                ].join(' ')}
              >
                <span>{item.emoji}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Slot utilisateur / mini topo droite */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="hidden sm:inline">Compte</span>
          <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-600" />
        </div>
      </header>

      {/* SIDEBAR (desktop + mobile drawer) */}
      <AppSidebar
        space={space}
        pathname={pathname}
        businessId={businessId}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* CONTENU */}
      <main className={`min-h-screen pt-14 pl-0 ${mainPaddingDesktop}`}>
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
