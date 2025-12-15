// src/app/app/AppShell.tsx
'use client';

import type { ReactNode } from 'react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AppSidebar, { type Space, getActiveSidebarMeta } from './AppSidebar';
import ThemeToggle from '@/components/ThemeToggle';
import {
  IconHome,
  IconStudio,
  IconWallet,
  IconFocus,
  IconUser,
} from '@/components/icons';

function getCurrentSpace(pathname: string): Space {
  if (pathname.startsWith('/app/pro')) return 'pro';
  if (pathname.startsWith('/app/personal')) return 'perso';
  if (pathname.startsWith('/app/performance')) return 'performance';
  return null;
}

function getBusinessIdFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'app') return null;
  if (segments[1] !== 'pro') return null;
  const maybeId = segments[2];
  if (!maybeId) return null;
  if (!/^\d+$/.test(maybeId)) return null;
  return maybeId;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const space = getCurrentSpace(pathname);
  const businessId = getBusinessIdFromPathname(pathname);

  /* ---------------- DESKTOP DOCK ---------------- */
  const [dockOpen, setDockOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  function openDock() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setDockOpen(true);
  }
  function scheduleCloseDock() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setDockOpen(false), 140);
  }
  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const DOCK_LEFT_PX = 12;
  const DOCK_GAP_PX = 16;
  const DOCK_W_CLOSED_PX = 56;
  const DOCK_W_OPEN_PX = 256;
  const dockPaddingPx =
    DOCK_LEFT_PX + (dockOpen ? DOCK_W_OPEN_PX : DOCK_W_CLOSED_PX) + DOCK_GAP_PX;
  const dockStyle = useMemo(() => {
    return { ['--dock-pl' as const]: `${dockPaddingPx}px` } as React.CSSProperties;
  }, [dockPaddingPx]);

  /* ---------------- NAV ---------------- */
  const centerNav = useMemo(
    () => [
      { key: 'wallet', label: 'Wallet', href: '/app/personal', icon: <IconWallet size={18} /> },
      { key: 'studio', label: 'Studio', href: '/app/pro', icon: <IconStudio size={18} /> },
      { key: 'focus', label: 'Focus', href: '/app/performance', icon: <IconFocus size={18} /> },
    ],
    []
  );

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  /* ---------------- MOBILE PULLDOWN + SNAP ---------------- */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDragY, setMobileDragY] = useState(0);

  const MOBILE_MENU_MAX = 420;
  const MOBILE_MENU_OPEN = 360;

  // Snap tuning
  const OPEN_THRESHOLD = 90;     // distance min
  const OPEN_VELOCITY = 0.55;    // px/ms (swipe down rapide => open)
  const CLOSE_THRESHOLD = 45;    // si ça bouge à peine => close

  // Pointer events state
  const pointerStartY = useRef<number | null>(null);
  const pointerStartT = useRef<number>(0);
  const lastY = useRef<number>(0);
  const lastT = useRef<number>(0);
  const pointerDragging = useRef(false);
  const dragYRef = useRef<number>(0);
  const wasOpenAtStart = useRef(false);

  // fermeture "propre" (évite click-through si tu veux animer un jour)
  function haptic(ms = 10) {
    if (typeof navigator === 'undefined') return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      // ignore haptic failures
    }
  }

  function closeMobileMenu() {
    haptic(8);
    setMobileDragY(0);
    dragYRef.current = 0;
    setMobileMenuOpen(false);
    pointerStartY.current = null;
    pointerDragging.current = false;
    wasOpenAtStart.current = false;
  }

  function openMobileMenu() {
    haptic(10);
    setMobileMenuOpen(true);
    setMobileDragY(MOBILE_MENU_OPEN);
    dragYRef.current = MOBILE_MENU_OPEN;
    pointerStartY.current = null;
    pointerDragging.current = false;
    wasOpenAtStart.current = true;
  }

  function onHeaderPointerDown(e: React.PointerEvent<HTMLElement>) {
    // uniquement touch (évite souris/trackpad)
    if (e.pointerType !== 'touch') return;
    if (typeof window !== 'undefined' && window.scrollY > 4) return;

    wasOpenAtStart.current = mobileMenuOpen;
    pointerStartY.current = e.clientY;
    pointerStartT.current = e.timeStamp;
    lastY.current = e.clientY;
    lastT.current = e.timeStamp;
    pointerDragging.current = false;
  }

  function onHeaderPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType !== 'touch') return;
    if (pointerStartY.current == null) return;

    const delta = e.clientY - pointerStartY.current;
    const startDrag = Math.abs(delta) >= 12;

    // On gère le pull vers le bas (ouverture)
    if (!wasOpenAtStart.current && delta <= 0) return;
    if (!wasOpenAtStart.current && !startDrag) return;

    const eased = Math.min(MOBILE_MENU_MAX, Math.max(0, delta) * 0.85);
    pointerDragging.current = true;

    // vitesse (pour snap)
    const now = e.timeStamp;
    lastY.current = e.clientY;
    lastT.current = now;

    setMobileMenuOpen(true);
    setMobileDragY(eased);
    dragYRef.current = eased;
  }

  function onHeaderPointerUp() {
    if (pointerStartY.current == null) return;

    // Si pas de drag => on ne fait rien
    if (!pointerDragging.current) {
      pointerStartY.current = null;
      return;
    }

    const dt = Math.max(1, lastT.current - pointerStartT.current);

    // vitesse moyenne (px/ms) sur le geste
    const vy = (lastY.current - (pointerStartY.current ?? lastY.current)) / dt;

    const y = dragYRef.current;

    // SNAP LOGIC
    // - si menu était fermé => on ouvre si distance OU vitesse suffisante
    // - sinon (menu déjà ouvert) => on snap simplement à l'état "ouvert confortable"
    if (!wasOpenAtStart.current) {
      const shouldOpen = y > OPEN_THRESHOLD || vy > OPEN_VELOCITY;
      if (shouldOpen) openMobileMenu();
      else {
        // si ça bouge un peu mais pas assez => on ferme
        if (y < CLOSE_THRESHOLD) closeMobileMenu();
        else closeMobileMenu();
      }
    } else {
      // menu déjà ouvert : on garde ouvert en snap
      openMobileMenu();
    }

    pointerStartY.current = null;
    pointerDragging.current = false;
  }

  // menuSpace: sous-nav de l'univers courant (null => global)
  const menuSpace: Space =
    space === 'perso' || space === 'pro' || space === 'performance' ? space : null;

  function spaceLabel(s: Space) {
    if (s === 'perso') return 'Wallet';
    if (s === 'pro') return 'Studio';
    if (s === 'performance') return 'Focus';
    return 'Navigation';
  }

  const activeMeta = getActiveSidebarMeta(menuSpace, pathname, businessId);
  const mobileMenuTitle = activeMeta.itemLabel
    ? `${spaceLabel(menuSpace)} · ${activeMeta.itemLabel}`
    : spaceLabel(menuSpace);

  type QuickItem = { label: string; href: string };

  function getQuickActions(s: Space, bizId: string | null): QuickItem[] {
    if (s === 'perso') {
      return [
        { label: 'Transactions', href: '/app/personal/transactions' },
        { label: 'Budgets', href: '/app/personal/budgets' },
        { label: 'Épargne', href: '/app/personal/epargne' },
      ];
    }

    if (s === 'performance') {
      return [
        { label: 'Pro', href: '/app/performance/pro' },
        { label: 'Alignement', href: '/app/performance/alignement' },
        { label: 'Perso', href: '/app/performance/perso' },
      ];
    }

    if (s === 'pro') {
      if (bizId) {
        const base = `/app/pro/${bizId}`;
        return [
          { label: 'Projets', href: `${base}/projets` },
          { label: 'Clients', href: `${base}/clients` },
          { label: 'Finances', href: `${base}/finances` },
        ];
      }
      return [
        { label: 'Mes entreprises', href: '/app/pro' },
        { label: 'Créer', href: '/app/pro?create=1' },
        { label: 'Rejoindre', href: '/app/pro?join=1' },
      ];
    }

    return [
      { label: 'Wallet', href: '/app/personal' },
      { label: 'Studio', href: '/app/pro' },
      { label: 'Focus', href: '/app/performance' },
    ];
  }

  const quickActions = getQuickActions(menuSpace, businessId);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      {/* HEADER */}
      <header
        className={[
          'fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[var(--background-alt)]/80 backdrop-blur-md',
          // IMPORTANT: empêche le scroll vertical par défaut => on peut “tirer” le header sans preventDefault
          'touch-pan-x',
        ].join(' ')}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        {/* -------- MOBILE BAR (Accueil | Tabs centrés | Compte) -------- */}
        <div className="relative mx-auto flex h-14 max-w-6xl items-center px-3 md:hidden">
          {/* LEFT: Accueil */}
          <div className="flex w-[72px] items-center justify-start">
            <Link
              href="/app"
              onClick={() => closeMobileMenu()}
              className={[
                'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
                pathname === '/app'
                  ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
              ].join(' ')}
              aria-label="Accueil"
              title="Accueil"
            >
              <IconHome size={18} />
            </Link>
          </div>

          {/* CENTER: Wallet/Studio/Focus centrés */}
          <nav
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1"
            aria-label="Navigation mobile"
          >
            {centerNav.map((t) => {
              const active = isActive(t.href);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    if (active) {
                      haptic(10);
                      if (mobileMenuOpen) {
                        closeMobileMenu();
                      } else {
                        openMobileMenu();
                      }
                      return;
                    }
                    haptic(10);
                    closeMobileMenu();
                    router.push(t.href);
                  }}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  {t.icon}
                  <span className="hidden xs:inline">{t.label}</span>
                </button>
              );
            })}

            {/* Bouton chevron (fallback ouverture) */}
            <button
              type="button"
              onClick={() => {
                if (mobileMenuOpen) {
                  closeMobileMenu();
                } else {
                  openMobileMenu();
                }
              }}
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              title={mobileMenuOpen ? 'Fermer' : 'Menu'}
            >
              <span
                className={[
                  'block h-2 w-2 border-r-2 border-b-2 border-current transition-transform duration-200',
                  mobileMenuOpen ? '-rotate-135 translate-y-[1px]' : 'rotate-45 -translate-y-[1px]',
                ].join(' ')}
              />
            </button>
          </nav>

          {/* RIGHT: Compte */}
          <div className="ml-auto flex w-[72px] items-center justify-end gap-2">
            <ThemeToggle />
            <Link
              href="/app/account"
              onClick={() => closeMobileMenu()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              aria-label="Compte"
              title="Compte"
            >
              <IconUser size={18} />
            </Link>
          </div>
        </div>

        {/* -------- DESKTOP HEADER (restauré) -------- */}
        <div className="mx-auto hidden h-14 max-w-6xl items-center justify-between px-4 md:flex md:max-w-none md:px-6">
          {/* Left: logo / identité */}
          <Link href="/app" className="flex items-center gap-2 no-underline hover:no-underline">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <Image
                src="/icon.svg"
                alt="Lune"
                width={20}
                height={20}
                className="h-5 w-5"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-4">Lune OS</span>
              <span className="text-[11px] text-[var(--text-secondary)]">Système interne</span>
            </div>
          </Link>

          {/* Center nav desktop */}
          <nav className="flex items-center gap-2" aria-label="Navigation principale">
            <Link
              href="/app"
              className={[
                'inline-flex h-9 w-9 items-center justify-center rounded-full border text-[var(--text-secondary)] transition-colors',
                pathname === '/app'
                  ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
              ].join(' ')}
              aria-label="Accueil"
              title="Accueil"
            >
              <IconHome size={18} />
            </Link>

            <div className="flex items-center rounded-full border border-[var(--border)] bg-[var(--background)]/50 p-1">
              {centerNav.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={[
                      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-[var(--surface)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
                    ].join(' ')}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/app/account"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              aria-label="Compte et paramètres"
              title="Compte"
            >
              <IconUser size={18} />
              <span className="hidden lg:inline">Compte</span>
            </Link>
          </div>
        </div>

        {/* ✅ MOBILE PULL-DOWN MENU (cliquable) */}
        <div className="md:hidden">
          {mobileMenuOpen && (
            <button
              type="button"
              className="fixed inset-0 top-14 z-40 bg-[var(--background)]/50 backdrop-blur-sm"
              onClick={closeMobileMenu}
              aria-label="Fermer le menu"
            />
          )}

          <div
            className="relative z-50 overflow-hidden border-b border-[var(--border)] bg-[var(--background-alt)]/90 backdrop-blur-md transition-[height] duration-200 ease-out"
            style={{ height: mobileMenuOpen ? mobileDragY : 0 }}
          >
            <div className="max-h-[420px] overflow-y-auto px-2 pb-3">
              {/* ✅ Title */}
              <div className="px-2 pb-2 pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                  {mobileMenuTitle}
                </p>
              </div>

              {/* ✅ Quick actions */}
              <div className="mb-3 flex gap-2 px-2">
                {quickActions.slice(0, 3).map((q) => {
                  const active = pathname === q.href || pathname.startsWith(q.href + '/');
                  return (
                    <button
                      key={q.href}
                      type="button"
                      onClick={() => {
                        haptic(10);
                        closeMobileMenu();
                        router.push(q.href);
                      }}
                      className={[
                        'flex-1 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors',
                        active
                          ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
                      ].join(' ')}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>

              <AppSidebar
                space={menuSpace}
                pathname={pathname}
                businessId={businessId}
                collapsed={false}
                onNavigate={closeMobileMenu}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ✅ DOCK DESKTOP */}
      <aside
        onMouseEnter={openDock}
        onMouseLeave={scheduleCloseDock}
        className="fixed left-3 top-1/2 z-40 hidden -translate-y-1/2 md:block"
        aria-label="Dock latéral"
      >
        <div
          className={[
            'rounded-3xl border border-[var(--border)]',
            'bg-[var(--background-alt)]/70 backdrop-blur-md shadow-xl',
            'transition-all duration-200 ease-out',
            dockOpen ? 'w-64' : 'w-14',
          ].join(' ')}
        >
          {/* ✅ SUPPRIMÉ : la petite barre en haut */}
          {/* <div className="px-2 pt-2">
            <div className="h-2 w-full rounded-full bg-[var(--surface)]/40" />
          </div> */}

          <div className="px-1 pb-2 pt-2">
            <AppSidebar
              space={space}
              pathname={pathname}
              businessId={businessId}
              collapsed={!dockOpen}
              onNavigate={() => setDockOpen(false)}
            />
          </div>
        </div>
      </aside>

      {/* CONTENU */}
      <main
        style={dockStyle}
        className={[
          'min-h-screen pt-14',
          'transition-[padding-left] duration-200 ease-out',
          'pl-0',
          'md:pl-[var(--dock-pl)]',
        ].join(' ')}
      >
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
