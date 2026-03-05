'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Plus, Home, Wallet2, Banknote, BarChart3, FileText, PiggyBank, Target, CreditCard } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/scrollLock';
import {
  IconPerso,
  IconEntreprise,
  IconFocus,
  IconDashboard,
  IconOperation,
  IconFinance,
  IconUser,
  PivotLogo,
} from '@/components/pivot-icons';
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

/* ═══ Mobile Nav ═══ */

export default function PivotMobileNav({ space, pathname, businessId, businesses: _businesses, userName }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  useBodyScrollLock(drawerOpen);

  const effectiveSpace = pathname.startsWith('/app/performance/perso') ? 'perso' : space;
  const inBusiness = effectiveSpace === 'pro' && !!businessId;
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      {/* Bottom tab bar — mobile only */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[58] border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-around" style={{ height: 56, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {effectiveSpace === 'perso' ? (
            <>
              <BottomTab href="/app/personal" icon={<Wallet2 size={20} />} label="Accueil" active={pathname === '/app/personal'} />
              <BottomTab href="/app/personal/comptes" icon={<Banknote size={20} />} label="Comptes" active={pathname.startsWith('/app/personal/comptes')} />
              <CenterAction href="/app/personal/transactions?add=true" />
              <BottomTab href="/app/performance/perso" icon={<BarChart3 size={20} />} label="Stats" active={pathname.startsWith('/app/performance/perso')} />
              <MenuButton onClick={() => setDrawerOpen(true)} />
            </>
          ) : inBusiness ? (
            <>
              <BottomTab href={`/app/pro/${businessId}`} icon={<IconDashboard size={20} color="currentColor" />} label="Dashboard" active={pathname === `/app/pro/${businessId}`} />
              <BottomTab href={`/app/pro/${businessId}/projects`} icon={<IconOperation size={20} color="currentColor" />} label="Projets" active={pathname.startsWith(`/app/pro/${businessId}/projects`)} />
              <CenterAction href={`/app/pro/${businessId}/projects/new`} />
              <BottomTab href={`/app/pro/${businessId}/finances`} icon={<IconFinance size={20} color="currentColor" />} label="Finances" active={pathname.startsWith(`/app/pro/${businessId}/finances`)} />
              <MenuButton onClick={() => setDrawerOpen(true)} />
            </>
          ) : (
            <>
              <BottomTab href="/app" icon={<Home size={20} />} label="Accueil" active={pathname === '/app'} />
              <BottomTab href="/app/personal" icon={<IconPerso size={20} color="currentColor" />} label="Perso" active={pathname.startsWith('/app/personal')} />
              <BottomTab href="/app/pro" icon={<IconEntreprise size={20} color="currentColor" />} label="Pro" active={pathname.startsWith('/app/pro')} />
              <BottomTab href="/app/focus" icon={<IconFocus size={20} color="currentColor" />} label="Focus" active={pathname.startsWith('/app/focus')} />
              <BottomTab href="/app/account" icon={<IconUser size={20} color="currentColor" />} label="Compte" active={pathname.startsWith('/app/account')} />
            </>
          )}
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-[70] bg-black/40" onClick={closeDrawer} />
          <div
            className="md:hidden fixed top-0 left-0 bottom-0 z-[71] flex flex-col overflow-y-auto"
            style={{ width: 280, background: 'var(--shell-sidebar-bg)', padding: '24px 16px' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <PivotLogo size={40} color="var(--shell-sidebar-text)" />
              <button type="button" onClick={closeDrawer} className="hover:opacity-80">
                <X size={24} style={{ color: 'var(--shell-sidebar-text)' }} />
              </button>
            </div>

            {/* Nav items */}
            <div className="flex flex-col gap-6 flex-1">
              {effectiveSpace === 'perso' && (
                <DrawerSection title="Navigation">
                  <DrawerItem icon={(c) => <FileText size={20} color={c} />} label="Transactions" href="/app/personal/transactions" onClick={closeDrawer} />
                  <DrawerItem icon={(c) => <PiggyBank size={20} color={c} />} label="Budgets" href="/app/personal/budgets" onClick={closeDrawer} />
                  <DrawerItem icon={(c) => <CreditCard size={20} color={c} />} label="Abonnements" href="/app/personal/subscriptions" onClick={closeDrawer} />
                  <DrawerItem icon={(c) => <Target size={20} color={c} />} label="Épargne" href="/app/personal/epargne" onClick={closeDrawer} />
                </DrawerSection>
              )}

              {inBusiness && (
                <DrawerSection title="Navigation">
                  {proNavSections.flatMap((section) =>
                    section.items.map((item) => {
                      const href = item.href(businessId!);
                      const iconFn = pivotIconMap[item.id];
                      return (
                        <DrawerItem
                          key={item.id}
                          icon={iconFn ?? ((c) => <IconEntreprise size={20} color={c} />)}
                          label={item.label}
                          href={href}
                          onClick={closeDrawer}
                        />
                      );
                    })
                  )}
                </DrawerSection>
              )}

              <DrawerSection title="Générale">
                <DrawerItem icon={(c) => <IconPerso size={20} color={c} />} label="Perso" href="/app/personal" onClick={closeDrawer} />
                <DrawerItem icon={(c) => <IconEntreprise size={20} color={c} />} label="Entreprise" href="/app/pro" onClick={closeDrawer} />
                <DrawerItem icon={(c) => <IconFocus size={20} color={c} />} label="Focus" href="/app/focus" onClick={closeDrawer} />
              </DrawerSection>
            </div>

            {/* Footer — user */}
            <Link
              href="/app/account"
              onClick={closeDrawer}
              className="flex items-center gap-3 rounded-lg mt-4"
              style={{ background: 'var(--surface)', padding: 8 }}
            >
              <div className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, background: 'var(--shell-sidebar-bg)' }}>
                <IconUser size={24} color="var(--surface)" />
              </div>
              <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{userName || 'Mon compte'}</span>
            </Link>
          </div>
        </>
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

/* ═══ Center Action ═══ */

function CenterAction({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform"
      style={{
        width: 48,
        height: 48,
        background: 'var(--shell-accent)',
        marginTop: -12,
      }}
    >
      <Plus size={24} style={{ color: 'white' }} />
    </Link>
  );
}

/* ═══ Menu Button ═══ */

function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 px-2 transition-colors"
      style={{ color: 'var(--text-faint)', fontSize: 10 }}
    >
      <Menu size={20} />
      <span>Menu</span>
    </button>
  );
}

/* ═══ Drawer Section ═══ */

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p
        className="select-none mb-1"
        style={{
          color: 'var(--shell-sidebar-text)',
          opacity: 0.6,
          fontSize: 13,
          fontFamily: 'var(--font-barlow), sans-serif',
          fontWeight: 300,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

/* ═══ Drawer Item ═══ */

function DrawerItem({ icon, label, href, onClick }: { icon: (c: string) => ReactNode; label: string; href: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:opacity-80 transition-opacity"
    >
      <span className="flex items-center shrink-0">{icon('var(--shell-sidebar-text)')}</span>
      <span
        style={{
          color: 'var(--shell-sidebar-text)',
          fontSize: 16,
          fontFamily: 'var(--font-barlow), sans-serif',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </Link>
  );
}
