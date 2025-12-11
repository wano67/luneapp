'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

type AppShellProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

type MeResponse = {
  user?: {
    email: string;
    name?: string | null;
  };
};

const navItems = [
  { href: '/app', label: 'OS' },
  { href: '/app/pro', label: 'PRO' },
  { href: '/app/personal', label: 'PERSO' },
  { href: '/app/performance', label: 'PERFORMANCE' },
];

export function AppShell({ title, description, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) return;
        const json = (await res.json()) as MeResponse;
        if (!active) return;
        if (json.user?.email) {
          setUserEmail(json.user.email);
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

  const activePath = useMemo(() => {
    if (!pathname) return '';
    const match = navItems.find((item) => pathname === item.href);
    if (match) return match.href;
    if (pathname.startsWith('/app/pro')) return '/app/pro';
    if (pathname.startsWith('/app/personal')) return '/app/personal';
    if (pathname.startsWith('/app/performance')) return '/app/performance';
    return '';
  }, [pathname]);

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
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Lune
            </span>
            <span className="rounded-full border border-slate-800 px-2 py-1 text-xs text-slate-400">
              App
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            {userEmail ? (
              <span className="hidden sm:inline text-slate-300">{userEmail}</span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Déconnexion...' : 'Déconnexion'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 md:flex-row">
        <aside className="flex flex-row gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-3 md:h-fit md:w-48 md:flex-col md:gap-2">
          {navItems.map((item) => {
            const isActive = activePath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-slate-800/70',
                  isActive
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-300 border border-transparent'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </aside>

        <main className="w-full space-y-6 md:max-w-4xl">
          {(title || description) && (
            <header className="space-y-2">
              {title ? (
                <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
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
