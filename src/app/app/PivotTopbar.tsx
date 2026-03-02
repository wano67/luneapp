'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import {
  IconAlert,
  IconMessage,
  IconSettings,
  IconEntreprise,
} from '@/components/pivot-icons';
import { useToast } from '@/components/ui/toast';
import type { Space, BusinessItem } from './PivotShell';

type Props = {
  space: Space;
  pathname: string;
  businessId: string | null;
  businesses: BusinessItem[];
  onToggleMessaging?: () => void;
};

/* ═══ Sub-page labels ═══ */

const PRO_SUB_LABELS: Record<string, string> = {
  projects: 'Projets',
  tasks: 'Tâches',
  clients: 'Clients',
  prospects: 'Prospects',
  agenda: 'Agenda',
  services: 'Catalogue',
  stock: 'Stock',
  finances: 'Finances',
  settings: 'Paramètres',
  organization: 'Organisation',
  references: 'Références',
  process: 'Processus',
  marketing: 'Marketing',
  invites: 'Invitations',
};

const PERSO_SUB_LABELS: Record<string, string> = {
  comptes: 'Comptes',
  transactions: 'Transactions',
  budgets: 'Budgets',
  epargne: 'Épargne',
};

const FOCUS_SUB_LABELS: Record<string, string> = {
  pro: 'Analyse Pro',
  perso: 'Analyse Perso',
};

function getSubPage(pathname: string, prefix: string, labels: Record<string, string>): { key: string; label: string } | null {
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).split('/')[0];
  if (!rest) return null;
  return { key: rest, label: labels[rest] ?? rest };
}

/* ═══ Topbar ═══ */

export default function PivotTopbar({ space, pathname, businessId, businesses, onToggleMessaging }: Props) {
  const toast = useToast();
  const currentBiz = businesses.find((b) => b.id === businessId);
  const inBusiness = space === 'pro' && !!businessId;

  const proSubPage = businessId ? getSubPage(pathname, `/app/pro/${businessId}/`, PRO_SUB_LABELS) : null;
  const persoSubPage = space === 'perso' ? getSubPage(pathname, '/app/personal/', PERSO_SUB_LABELS) : null;
  const focusSubPage = space === 'focus' ? getSubPage(pathname, '/app/performance/', FOCUS_SUB_LABELS) : null;

  const handleComingSoon = () => toast.info('Bientôt disponible');

  return (
    <header
      className="grid items-center shrink-0"
      style={{
        gridTemplateColumns: '1fr auto 1fr',
        background: 'var(--shell-topbar-bg)',
        padding: '12px 24px',
        minHeight: 56,
        gap: 16,
      }}
    >
      {/* Left: Breadcrumb */}
      <div className="flex items-center min-w-0">
        {inBusiness ? (
          <ProBreadcrumb
            businessName={currentBiz?.name}
            businessId={businessId}
            subPage={proSubPage}
          />
        ) : (
          <SpaceBreadcrumb space={space} persoSubPage={persoSubPage} focusSubPage={focusSubPage} />
        )}
      </div>

      {/* Center: Search (always centered) */}
      <SearchBar onComingSoon={handleComingSoon} />

      {/* Right: Actions */}
      <div className="flex items-center gap-2 justify-end">
        <NavIconBtn onClick={handleComingSoon}><IconAlert size={20} color="var(--shell-topbar-text)" /></NavIconBtn>
        <NavIconBtn onClick={inBusiness ? onToggleMessaging : handleComingSoon}><IconMessage size={20} color="var(--shell-topbar-text)" /></NavIconBtn>
        <Link href={inBusiness ? `/app/pro/${businessId}/settings` : '/app/account'}>
          <NavIconBtn><IconSettings size={20} color="var(--shell-topbar-text)" /></NavIconBtn>
        </Link>
        {inBusiness && businesses.length > 0 && (
          <BusinessSwitcher businesses={businesses} currentId={businessId} />
        )}
      </div>
    </header>
  );
}

/* ═══ Pro Breadcrumb: Accueil > Entreprise > BusinessName > SubPage ═══ */

function ProBreadcrumb({
  businessName,
  businessId,
  subPage,
}: {
  businessName?: string;
  businessId: string | null;
  subPage: { key: string; label: string } | null;
}) {
  return (
    <div className="flex items-center gap-1 text-sm shrink-0">
      <Link href="/app" className="px-2 py-1.5 rounded-xl hover:opacity-80 transition-opacity" style={{ color: 'var(--text-faint)' }}>
        Accueil
      </Link>
      <Separator />
      <Link href="/app/pro" className="px-2 py-1.5 rounded-xl hover:opacity-80 transition-opacity" style={{ color: 'var(--text-faint)' }}>
        Entreprise
      </Link>
      <Separator />
      {businessName && (
        <>
          <Link
            href={`/app/pro/${businessId}`}
            className="px-2 py-1.5 rounded-xl hover:opacity-80 transition-opacity"
            style={{ color: subPage ? 'var(--text-faint)' : 'var(--shell-topbar-text)', fontWeight: subPage ? 400 : 500 }}
          >
            {businessName}
          </Link>
          {subPage && <Separator />}
        </>
      )}
      {subPage && (
        <span className="px-2 py-1.5 rounded-xl" style={{ color: 'var(--shell-topbar-text)', fontWeight: 500 }}>
          {subPage.label}
        </span>
      )}
    </div>
  );
}

/* ═══ Space Breadcrumb: Accueil > Wallet > SubPage / Accueil > Focus > SubPage ═══ */

function SpaceBreadcrumb({
  space,
  persoSubPage,
  focusSubPage,
}: {
  space: Space;
  persoSubPage: { key: string; label: string } | null;
  focusSubPage: { key: string; label: string } | null;
}) {
  const spaceLabels: Record<string, { label: string; href: string }> = {
    home: { label: 'Accueil', href: '/app' },
    perso: { label: 'Wallet', href: '/app/personal' },
    pro: { label: 'Entreprises', href: '/app/pro' },
    focus: { label: 'Focus', href: '/app/focus' },
  };

  const current = spaceLabels[space ?? 'home'] ?? spaceLabels.home;
  const subPage = persoSubPage ?? focusSubPage;
  const isHome = space === 'home' || space === null;

  return (
    <div className="flex items-center gap-1 text-sm shrink-0">
      {isHome ? (
        <span className="px-2 py-1.5 rounded-xl" style={{ color: 'var(--shell-topbar-text)', fontWeight: 500 }}>
          Accueil
        </span>
      ) : (
        <>
          <Link href="/app" className="px-2 py-1.5 rounded-xl hover:opacity-80 transition-opacity" style={{ color: 'var(--text-faint)' }}>
            Accueil
          </Link>
          <Separator />
          {subPage ? (
            <>
              <Link href={current.href} className="px-2 py-1.5 rounded-xl hover:opacity-80 transition-opacity" style={{ color: 'var(--text-faint)' }}>
                {current.label}
              </Link>
              <Separator />
              <span className="px-2 py-1.5 rounded-xl" style={{ color: 'var(--shell-topbar-text)', fontWeight: 500 }}>
                {subPage.label}
              </span>
            </>
          ) : (
            <span className="px-2 py-1.5 rounded-xl" style={{ color: 'var(--shell-topbar-text)', fontWeight: 500 }}>
              {current.label}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function Separator() {
  return <span style={{ color: 'var(--border)' }}>/</span>;
}

/* ═══ Business Switcher ═══ */

function BusinessSwitcher({ businesses, currentId }: { businesses: BusinessItem[]; currentId: string | null }) {
  const [open, setOpen] = useState(false);
  const current = businesses.find((b) => b.id === currentId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg transition-colors"
        style={{ background: 'var(--shell-sidebar-bg)', padding: '6px 10px' }}
      >
        <div className="flex items-center justify-center rounded" style={{ width: 28, height: 28, background: 'var(--surface)' }}>
          <IconEntreprise size={16} color="var(--shell-sidebar-bg)" />
        </div>
        {current && (
          <span className="text-sm max-w-[120px] truncate" style={{ color: 'var(--shell-sidebar-text)' }}>
            {current.name}
          </span>
        )}
        <ChevronDown size={12} style={{ color: 'var(--shell-sidebar-text)' }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 rounded-xl py-2 z-50 min-w-[200px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
          >
            {businesses.map((b) => (
              <Link
                key={b.id}
                href={`/app/pro/${b.id}`}
                className="block px-4 py-2 text-sm transition-colors"
                style={{
                  color: b.id === currentId ? 'var(--shell-accent)' : 'var(--text)',
                  fontWeight: b.id === currentId ? 600 : 400,
                }}
                onClick={() => setOpen(false)}
              >
                {b.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══ Search Bar ═══ */

function SearchBar({ onComingSoon }: { onComingSoon: () => void }) {
  return (
    <button
      type="button"
      onClick={onComingSoon}
      className="hidden lg:flex items-center gap-2 rounded-full overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
      style={{ background: 'var(--shell-accent)', padding: '6px 12px 6px 6px', width: 320, maxWidth: '100%' }}
    >
      <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: 'rgba(255,255,255,0.25)' }}>
        <Search size={13} style={{ color: 'white' }} />
      </div>
      <span className="flex-1 text-left text-white/70 text-sm" style={{ fontFamily: 'var(--font-sans), sans-serif' }}>
        Recherche
      </span>
    </button>
  );
}

/* ═══ Nav Icon Button ═══ */

function NavIconBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center justify-center rounded-full hover:opacity-80 transition-opacity"
      style={{ width: 32, height: 32, background: 'var(--surface)' }}
    >
      {children}
    </button>
  );
}
