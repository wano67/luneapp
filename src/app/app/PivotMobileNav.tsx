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
  IconSettings,
  PivotLogo,
} from '@/components/pivot-icons';
import { Menu } from 'lucide-react';
import { proNavSections, hasMinRole } from '@/config/proNav';
import { personalNavSections } from '@/config/personalNav';
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

type MenuSection = {
  title: string;
  items: MenuItem[];
};

/* ═══ Menu items per section ═══ */

function getPersoSections(): MenuSection[] {
  return personalNavSections.map((section) => ({
    title: section.title,
    items: section.items.map((item) => ({
      icon: item.icon('currentColor'),
      label: item.label,
      href: item.href,
    })),
  }));
}

function getProSections(businessId: string, role?: string | null, activityType?: string | null): MenuSection[] {
  return proNavSections
    .map((section) => {
      const items = section.items
        .filter((item) => {
          if (item.minRole && !hasMinRole(role, item.minRole)) return false;
          if (item.activityTypes && activityType && !item.activityTypes.includes(activityType as never)) return false;
          return true;
        })
        .map((item) => {
          const iconFn = pivotIconMap[item.id];
          return {
            icon: iconFn ? iconFn('currentColor') : <IconEntreprise size={22} color="currentColor" />,
            label: item.label,
            href: item.href(businessId),
          };
        });
      return { title: section.title, items };
    })
    .filter((s) => s.items.length > 0);
}

function getFocusItems(): MenuItem[] {
  return [
    { icon: <IconFocus size={22} color="currentColor" />, label: 'Vue d\'ensemble', href: '/app/focus' },
    { icon: <IconEntreprise size={22} color="currentColor" />, label: 'Analyse Pro', href: '/app/performance/pro' },
    { icon: <IconPerso size={22} color="currentColor" />, label: 'Analyse Perso', href: '/app/performance/perso' },
  ];
}

function getSectionTitle(space: Space, inBusiness: boolean): string {
  if (space === 'perso') return 'Finances perso';
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

export default function PivotMobileNav({ space, pathname, businessId, businesses, userName }: Props) {
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

  // Get menu sections for the current space
  let menuSections: MenuSection[] = [];
  if (effectiveSpace === 'home' || effectiveSpace === null) {
    menuSections = [{ title: 'Menu', items: [
      { icon: <IconPerso size={22} color="currentColor" />, label: 'Wallet', href: '/app/personal' },
      { icon: <IconEntreprise size={22} color="currentColor" />, label: 'Entreprises', href: '/app/pro' },
      { icon: <BarChart3 size={22} />, label: 'Performance', href: '/app/focus' },
      { icon: <IconSettings size={22} color="currentColor" />, label: 'Mon compte', href: '/app/account' },
    ] }];
  } else if (effectiveSpace === 'perso') {
    menuSections = getPersoSections();
  } else if (effectiveSpace === 'pro' && businessId) {
    const currentBiz = businesses.find((b) => b.id === businessId);
    menuSections = getProSections(businessId, currentBiz?.role, currentBiz?.activityType);
  } else if (effectiveSpace === 'pro') {
    menuSections = [{ title: 'Pro', items: [{ icon: <IconEntreprise size={22} color="currentColor" />, label: 'Mes entreprises', href: '/app/pro' }] }];
  } else if (effectiveSpace === 'focus') {
    menuSections = [{ title: 'Performance', items: getFocusItems() }];
  }

  const sectionTitle = getSectionTitle(effectiveSpace, inBusiness);
  const totalItems = menuSections.reduce((n, s) => n + s.items.length, 0);
  const hasMenu = totalItems > 0;
  const compact = totalItems > 8;

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

          {/* Nav items — scrollable, with section headers */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-4">
            {menuSections.map((section) => (
              <div key={section.title}>
                {menuSections.length > 1 && (
                  <p
                    className="px-4 pb-1 select-none"
                    style={{
                      color: 'var(--shell-sidebar-text)',
                      opacity: 0.5,
                      fontSize: 11,
                      fontFamily: 'var(--font-barlow), sans-serif',
                      fontWeight: 300,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {section.title}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
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
                        compact={compact}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Générale — matches sidebar bottom section */}
            {effectiveSpace !== 'home' && effectiveSpace !== null && (
              <div>
                <p
                  className="px-4 pb-1 select-none"
                  style={{
                    color: 'var(--shell-sidebar-text)',
                    opacity: 0.5,
                    fontSize: 11,
                    fontFamily: 'var(--font-barlow), sans-serif',
                    fontWeight: 300,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                  }}
                >
                  Générale
                </p>
                <div className="flex flex-col gap-0.5">
                  <BubbleMenuItem icon={<IconPerso size={22} color="currentColor" />} label="Perso" href="/app/personal" active={space === 'perso'} onClick={close} compact={compact} />
                  <BubbleMenuItem icon={<IconEntreprise size={22} color="currentColor" />} label="Entreprise" href="/app/pro" active={space === 'pro'} onClick={close} compact={compact} />
                  <BubbleMenuItem icon={<BarChart3 size={22} />} label="Focus" href="/app/focus" active={space === 'focus'} onClick={close} compact={compact} />
                </div>
              </div>
            )}

            {/* Mon compte */}
            <div>
              <BubbleMenuItem
                icon={<IconSettings size={22} color="currentColor" />}
                label={userName || 'Mon compte'}
                href="/app/account"
                active={pathname.startsWith('/app/account')}
                onClick={close}
                compact={compact}
              />
            </div>
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
  compact,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl px-4 transition-colors ${compact ? 'py-2.5' : 'py-4'}`}
      style={{
        background: active ? 'var(--shell-sidebar-active-bg)' : 'transparent',
        color: active ? 'var(--shell-sidebar-active-text)' : 'var(--shell-sidebar-text)',
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span
        style={{
          fontSize: compact ? 18 : 22,
          fontFamily: 'var(--font-barlow), sans-serif',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </Link>
  );
}
