'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

type SectionKey = 'personal' | 'pro' | 'performance' | null;

type SidebarItem = {
  href: string;
  label: string;
};

type AppShellProps = {
  currentSection: SectionKey;
  title?: string;
  description?: string;
  sidebarItems?: SidebarItem[];
  children: ReactNode;
};

type MeResponse = {
  user?: {
    email: string;
    name?: string | null;
  };
};

const topNavItems: { key: SectionKey; label: string; href: string }[] = [
  { key: 'personal', label: 'Personal', href: '/app/personal' },
  { key: 'pro', label: 'Professional', href: '/app/pro' },
  { key: 'performance', label: 'Performance', href: '/app/performance' },
];

export function AppShell({
  currentSection,
  title,
  description,
  sidebarItems = [],
  children,
}: AppShellProps) {
  const router = useRouter();
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) return;
        const json = (await res.json()) as MeResponse;
        if (!active) return;

        if (json.user) {
          setUserLabel(json.user.name || json.user.email || null);
        }
      } catch (error) {
        console.error('Error loading user in AppShell', error);
      }
    }

    loadMe();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
          {/* Gauche : logo/nom de l'app */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Lune
            </span>
          </div>

          {/* Centre : onglets Personal / Professional / Performance */}
          <nav className="hidden gap-2 md:flex">
            {topNavItems.map((item) => {
              const isActive = item.key === currentSection;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition',
                    isActive
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Droite : user + logout */}
          <div className="flex items-center gap-3 text-xs md:text-sm">
            {userLabel ? (
              <span className="hidden text-slate-300 sm:inline">
                {userLabel}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Déconnexion…' : 'Déconnexion'}
            </Button>
          </div>
        </div>

        {/* Tabs visibles sur mobile en dessous du header */}
        <nav className="flex gap-2 border-t border-slate-800 px-4 pb-3 pt-2 md:hidden">
          {topNavItems.map((item) => {
            const isActive = item.key === currentSection;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'flex-1 rounded-full px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide transition',
                  isActive
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* BODY : sidebar + contenu */}
      <div className="mx-auto flex max-w-6xl gap-4 px-4 py-6 md:px-6 md:py-8">
        {/* Sidebar gauche */}
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              {currentSection === 'pro'
                ? 'Pro'
                : currentSection === 'personal'
                  ? 'Perso'
                  : currentSection === 'performance'
                    ? 'Performance'
                    : 'Section'}
            </p>
            <ul className="space-y-1">
              {sidebarItems.length === 0 ? (
                <li className="text-xs text-slate-600">
                  Navigation à venir pour cette section.
                </li>
              ) : (
                sidebarItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-lg px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>

        {/* Contenu */}
        <main className="w-full space-y-5 md:max-w-3xl">
          {(title || description) && (
            <header className="space-y-1">
              {title ? (
                <h1 className="text-xl font-semibold text-slate-50 md:text-2xl">
                  {title}
                </h1>
              ) : null}
              {description ? (
                <p className="text-sm text-slate-400">{description}</p>
              ) : null}
            </header>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
