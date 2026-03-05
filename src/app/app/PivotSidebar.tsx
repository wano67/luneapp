'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { proNavSections } from '@/config/proNav';
import { pivotIconMap } from '@/config/pivotNavIcons';
import {
  IconPerso,
  IconEntreprise,
  IconFocus,
  IconUser,
  IconToggleSidebar,
  IconHome,
  IconBankAccount,
  IconTransaction,
  IconBudget,
  IconSubscription,
  IconSavings,
  PivotLogo,
} from '@/components/pivot-icons';
import type { Space, BusinessItem } from './PivotShell';

type Props = {
  space: Space;
  pathname: string;
  businessId: string | null;
  businesses: BusinessItem[];
  userName: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

/* ═══ Active detection (longest match) ═══ */

function isActive(pathname: string, href: string, patterns?: RegExp[]): boolean {
  if (patterns) {
    return patterns.some((re) => re.test(pathname));
  }
  const clean = href.split('?')[0];
  return pathname === clean || pathname.startsWith(`${clean}/`);
}

function isExactActive(pathname: string, href: string): boolean {
  return pathname === href || pathname === `${href}/`;
}

/* ═══ Sidebar ═══ */

export default function PivotSidebar({ space, pathname, businessId, businesses: _businesses, userName, collapsed, onToggleCollapse }: Props) {
  const inBusiness = space === 'pro' && !!businessId;

  const nameParts = userName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <aside
      className="shrink-0 hidden md:flex flex-col h-full transition-all duration-200"
      style={{
        width: collapsed ? 'var(--shell-sidebar-collapsed-width)' : 'var(--shell-sidebar-width)',
        background: 'var(--shell-sidebar-bg)',
        borderRadius: 8,
        padding: collapsed ? '24px 12px' : '24px 16px',
      }}
    >
      {/* Scrollable top section */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-6">
        {/* Logo + toggle */}
        {collapsed ? (
          <Link href="/app" className="self-center hover:opacity-80 transition-opacity">
            <PivotLogo size={40} color="var(--shell-sidebar-text)" />
          </Link>
        ) : (
          <div className="flex items-start justify-between">
            <Link href="/app" className="hover:opacity-80 transition-opacity">
              <PivotLogo size={49} color="var(--shell-sidebar-text)" />
            </Link>
            <button type="button" className="hover:opacity-80 transition-opacity" onClick={onToggleCollapse}>
              <IconToggleSidebar size={24} color="var(--shell-sidebar-text)" />
            </button>
          </div>
        )}

        {/* Business nav (when inside a business) */}
        {inBusiness && (
          <Section title="Navigation" collapsed={collapsed}>
            {proNavSections.flatMap((section) =>
              section.items.map((item) => {
                const href = item.href(businessId!);
                const patterns = item.activePatterns?.(businessId!);
                const active = isActive(pathname, href, patterns);
                const iconFn = pivotIconMap[item.id];
                return (
                  <Item
                    key={item.id}
                    icon={iconFn ?? ((c) => <IconEntreprise size={20} color={c} />)}
                    label={item.label}
                    href={href}
                    active={active}
                    collapsed={collapsed}
                  />
                );
              })
            )}
          </Section>
        )}

        {/* Wallet nav */}
        {space === 'perso' && (
          <Section title="Wallet" collapsed={collapsed}>
            <Item icon={(c) => <IconHome size={20} color={c} />} label="Vue d'accueil" href="/app/personal" active={isExactActive(pathname, '/app/personal')} collapsed={collapsed} />
            <Item icon={(c) => <IconBankAccount size={20} color={c} />} label="Comptes" href="/app/personal/comptes" active={pathname.startsWith('/app/personal/comptes')} collapsed={collapsed} />
            <Item icon={(c) => <IconTransaction size={20} color={c} />} label="Transactions" href="/app/personal/transactions" active={pathname.startsWith('/app/personal/transactions')} collapsed={collapsed} />
            <Item icon={(c) => <IconBudget size={20} color={c} />} label="Budgets" href="/app/personal/budgets" active={pathname.startsWith('/app/personal/budgets')} collapsed={collapsed} />
            <Item icon={(c) => <IconSubscription size={20} color={c} />} label="Abonnements" href="/app/personal/subscriptions" active={pathname.startsWith('/app/personal/subscriptions')} collapsed={collapsed} />
            <Item icon={(c) => <IconSavings size={20} color={c} />} label="Épargne" href="/app/personal/epargne" active={pathname.startsWith('/app/personal/epargne')} collapsed={collapsed} />
          </Section>
        )}

        {/* Focus nav */}
        {space === 'focus' && (
          <Section title="Performance" collapsed={collapsed}>
            <Item icon={(c) => <IconFocus size={20} color={c} />} label="Vue d'ensemble" href="/app/focus" active={isExactActive(pathname, '/app/focus')} collapsed={collapsed} />
            <Item icon={(c) => <IconFocus size={20} color={c} />} label="Analyse Pro" href="/app/performance/pro" active={pathname.startsWith('/app/performance/pro')} collapsed={collapsed} />
            <Item icon={(c) => <IconFocus size={20} color={c} />} label="Analyse Perso" href="/app/performance/perso" active={pathname.startsWith('/app/performance/perso')} collapsed={collapsed} />
          </Section>
        )}
      </div>

      {/* Fixed bottom section — always visible */}
      <div className="shrink-0 flex flex-col gap-4 pt-4">
        <Section title="Générale" collapsed={collapsed}>
          <Item icon={(c) => <IconPerso size={20} color={c} />} label="Perso" href="/app/personal" active={space === 'perso'} collapsed={collapsed} />
          <Item icon={(c) => <IconEntreprise size={20} color={c} />} label="Entreprise" href="/app/pro" active={space === 'pro'} collapsed={collapsed} />
          <Item icon={(c) => <IconFocus size={20} color={c} />} label="Focus" href="/app/focus" active={space === 'focus'} collapsed={collapsed} />
        </Section>

        {/* User card */}
        {collapsed ? (
          <Link
            href="/app/account"
            className="flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: 'var(--surface)', padding: 12 }}
          >
            <IconUser size={24} color="var(--shell-sidebar-active-text)" />
          </Link>
        ) : (
          <Link
            href="/app/account"
            className="flex items-center gap-3 rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: 'var(--surface)', padding: 8 }}
          >
            <div className="flex items-center justify-center rounded-lg overflow-hidden" style={{ width: 32, height: 32, background: 'var(--shell-sidebar-bg)' }}>
              <IconUser size={24} color="var(--surface)" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-tight truncate" style={{ color: 'var(--text)', fontWeight: 300 }}>
                {firstName}
                {lastName && <><br /><span className="text-xs">{lastName}</span></>}
              </p>
            </div>
            <ChevronDown size={12} style={{ color: 'var(--text-faint)' }} />
          </Link>
        )}
      </div>
    </aside>
  );
}

/* ═══ Section ═══ */

function Section({ title, collapsed, children }: { title: string; collapsed: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: 4 }}>
      {!collapsed && (
        <p
          className="select-none"
          style={{
            color: 'var(--shell-sidebar-text)',
            opacity: 0.6,
            fontSize: 13,
            fontFamily: 'var(--font-barlow), sans-serif',
            fontWeight: 300,
            textTransform: 'uppercase',
            lineHeight: '14px',
            paddingBottom: 4,
          }}
        >
          {title}
        </p>
      )}
      <div className="flex flex-col" style={{ gap: collapsed ? 8 : 0 }}>{children}</div>
    </div>
  );
}

/* ═══ Item ═══ */

function Item({
  icon,
  label,
  href,
  active,
  collapsed,
}: {
  icon: (color: string) => ReactNode;
  label: string;
  href: string;
  active?: boolean;
  collapsed: boolean;
}) {
  const iconColor = collapsed
    ? 'var(--shell-sidebar-active-text)'
    : active
    ? 'var(--shell-sidebar-active-text)'
    : 'var(--shell-sidebar-text)';

  const showBg = collapsed || active;

  const content = collapsed ? (
    <span className="flex items-center justify-center">{icon(iconColor)}</span>
  ) : (
    <>
      <span className="flex items-center shrink-0">{icon(iconColor)}</span>
      <span
        className="flex-1 truncate"
        style={{
          color: iconColor,
          fontSize: 16,
          fontFamily: 'var(--font-barlow), sans-serif',
          fontWeight: 600,
          lineHeight: '18px',
        }}
      >
        {label}
      </span>
    </>
  );

  return (
    <Link
      href={href}
      className={[
        'flex items-center rounded-lg transition-colors',
        collapsed ? 'justify-center py-2.5 px-2' : 'gap-3 px-2 py-2.5',
        !showBg ? 'hover:opacity-80' : '',
      ].join(' ')}
      style={showBg ? { background: 'var(--shell-sidebar-active-bg)' } : undefined}
      title={collapsed ? label : undefined}
    >
      {content}
    </Link>
  );
}
