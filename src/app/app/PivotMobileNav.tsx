'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { X, Home, BarChart3 } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/scrollLock';
import {
  IconPerso,
  IconEntreprise,
  IconFocus,
  IconHome,
  IconBankAccount,
  IconTransaction,
  IconBudget,
  IconSubscription,
  IconSavings,
  IconSettings,
  PivotLogo,
} from '@/components/pivot-icons';
import { CalendarDays, Menu } from 'lucide-react';
import { proNavSections } from '@/config/proNav';
import { pivotIconMap } from '@/config/pivotNavIcons';
import type { Space, BusinessItem } from './PivotShell';

type Props = {
  space: Space;
  pathname: string;
  businessId: string | null;
  businesses: BusinessItem[];
  userName: string;
};

type MenuItem = {
  icon: ReactNode;
  label: string;
  href: string;
};

/* ═══ Menu items per section ═══ */

function getPersoItems(): MenuItem[] {
  return [
    { icon: <IconHome size={22} color="currentColor" />, label: 'Vue d\'accueil', href: '/app/personal' },
    { icon: <IconBankAccount size={22} color="currentColor" />, label: 'Comptes', href: '/app/personal/comptes' },
    { icon: <IconTransaction size={22} color="currentColor" />, label: 'Transactions', href: '/app/personal/transactions' },
    { icon: <IconBudget size={22} color="currentColor" />, label: 'Budgets', href: '/app/personal/budgets' },
    { icon: <IconSubscription size={22} color="currentColor" />, label: 'Abonnements', href: '/app/personal/subscriptions' },
    { icon: <IconSavings size={22} color="currentColor" />, label: 'Épargne', href: '/app/personal/epargne' },
    { icon: <CalendarDays size={22} />, label: 'Calendrier', href: '/app/personal/calendar' },
  ];
}

function getProItems(businessId: string): MenuItem[] {
  return proNavSections.flatMap((section) =>
    section.items.map((item) => {
      const iconFn = pivotIconMap[item.id];
      return {
        icon: iconFn ? iconFn('currentColor') : <IconEntreprise size={22} color="currentColor" />,
        label: item.label,
        href: item.href(businessId),
      };
    })
  );
}

function getFocusItems(): MenuItem[] {
  return [
    { icon: <IconFocus size={22} color="currentColor" />, label: 'Vue d\'ensemble', href: '/app/focus' },
    { icon: <IconEntreprise size={22} color="currentColor" />, label: 'Analyse Pro', href: '/app/performance/pro' },
    { icon: <IconPerso size={22} color="currentColor" />, label: 'Analyse Perso', href: '/app/performance/perso' },
  ];
}

function getSectionTitle(space: Space, inBusiness: boolean): string {
  if (space === 'perso') return 'Wallet';
  if (space === 'pro' && inBusiness) return 'Entreprise';
  if (space === 'pro') return 'Pro';
  if (space === 'focus') return 'Performance';
  return 'Menu';
}

function getCenterIcon(space: Space): ReactNode {
  if (space === 'perso') return <IconPerso size={22} color="white" />;
  if (space === 'pro') return <IconEntreprise size={22} color="white" />;
  if (space === 'focus') return <BarChart3 size={22} color="white" />;
  return <Menu size={22} color="white" />;
}

function isItemActive(pathname: string, href: string): boolean {
  const clean = href.split('?')[0];
  return pathname === clean || pathname.startsWith(`${clean}/`);
}

function isExactActive(pathname: string, href: string): boolean {
  return pathname === href || pathname === `${href}/`;
}

/* ═══ Mobile Nav ═══ */

export default function PivotMobileNav({ space, pathname, businessId, businesses: _businesses, userName: _userName }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  useBodyScrollLock(menuOpen);

  const effectiveSpace = pathname.startsWith('/app/performance/perso') ? 'perso' : space;
  const inBusiness = effectiveSpace === 'pro' && !!businessId;

  function close() {
    setClosing(true);
    setTimeout(() => {
      setMenuOpen(false);
      setClosing(false);
    }, 250);
  }

  // Get menu items for the current section
  let menuItems: MenuItem[] = [];
  if (effectiveSpace === 'home' || effectiveSpace === null) {
    menuItems = [
      { icon: <IconPerso size={22} color="currentColor" />, label: 'Wallet', href: '/app/personal' },
      { icon: <IconEntreprise size={22} color="currentColor" />, label: 'Entreprises', href: '/app/pro' },
      { icon: <BarChart3 size={22} />, label: 'Performance', href: '/app/focus' },
      { icon: <IconSettings size={22} color="currentColor" />, label: 'Mon compte', href: '/app/account' },
    ];
  } else if (effectiveSpace === 'perso') menuItems = getPersoItems();
  else if (effectiveSpace === 'pro' && businessId) menuItems = getProItems(businessId);
  else if (effectiveSpace === 'pro') menuItems = [{ icon: <IconEntreprise size={22} color="currentColor" />, label: 'Mes entreprises', href: '/app/pro' }];
  else if (effectiveSpace === 'focus') menuItems = getFocusItems();

  const sectionTitle = getSectionTitle(effectiveSpace, inBusiness);
  const hasMenu = menuItems.length > 0;

  return (
    <>
      {/* ── Bottom tab bar — fixed, universal ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[70] border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-around" style={{ height: 56, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <BottomTab
            href="/app"
            icon={<Home size={20} />}
            label="Accueil"
            active={pathname === '/app' || pathname === '/app/'}
          />
          <BottomTab
            href="/app/personal"
            icon={<IconPerso size={20} color="currentColor" />}
            label="Perso"
            active={effectiveSpace === 'perso'}
          />

          {/* Center button */}
          <button
            type="button"
            onClick={() => {
              if (menuOpen) { close(); }
              else if (hasMenu) { setMenuOpen(true); }
            }}
            className="flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform"
            style={{
              width: 48,
              height: 48,
              background: 'var(--shell-accent)',
              marginTop: -12,
            }}
          >
            {menuOpen ? <X size={22} color="white" /> : getCenterIcon(effectiveSpace)}
          </button>

          <BottomTab
            href="/app/pro"
            icon={<IconEntreprise size={20} color="currentColor" />}
            label="Pro"
            active={space === 'pro'}
          />
          <BottomTab
            href="/app/focus"
            icon={<BarChart3 size={20} />}
            label="Perf"
            active={space === 'focus' || pathname.startsWith('/app/performance')}
          />
        </div>
      </nav>

      {/* ── Bubble menu — above navbar ── */}
      {menuOpen && (
        <div
          className={`md:hidden fixed inset-x-0 top-0 z-[65] flex flex-col ${closing ? 'animate-bubble-collapse' : 'animate-bubble-expand'}`}
          style={{ background: 'var(--shell-sidebar-bg)', bottom: 56 }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-6"
            style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}
          >
            <PivotLogo size={32} color="var(--shell-sidebar-text)" />
            <p
              style={{
                color: 'var(--shell-sidebar-text)',
                fontSize: 18,
                fontFamily: 'var(--font-barlow), sans-serif',
                fontWeight: 600,
              }}
            >
              {sectionTitle}
            </p>
          </div>

          {/* Nav items — centered, large text */}
          <div className="flex-1 flex flex-col justify-center gap-1 px-6">
            {menuItems.map((item) => {
              const active = item.href === '/app/personal'
                ? isExactActive(pathname, item.href)
                : isItemActive(pathname, item.href);
              return (
                <BubbleMenuItem
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  active={active}
                  onClick={close}
                />
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* ═══ Bottom Tab ═══ */

function BottomTab({ href, icon, label, active }: { href: string; icon: ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-0.5 px-2 transition-colors"
      style={{
        color: active ? 'var(--shell-accent)' : 'var(--text-faint)',
        fontSize: 10,
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

/* ═══ Bubble Menu Item ═══ */

function BubbleMenuItem({
  icon,
  label,
  href,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-4 rounded-2xl px-4 py-4 transition-colors"
      style={{
        background: active ? 'var(--shell-sidebar-active-bg)' : 'transparent',
        color: active ? 'var(--shell-sidebar-active-text)' : 'var(--shell-sidebar-text)',
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span
        style={{
          fontSize: 22,
          fontFamily: 'var(--font-barlow), sans-serif',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </Link>
  );
}
