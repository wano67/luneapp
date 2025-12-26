// src/app/app/AppSidebar.tsx
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Contact2,
  CheckSquare,
  Workflow,
  Bookmark,
  Banknote,
  Cog,
  Wallet2,
  Building2,
  Package,
  ClipboardList,
} from 'lucide-react';
import { useActiveBusiness } from './pro/ActiveBusinessProvider';

export type Space = 'home' | 'pro' | 'perso' | 'focus' | null;

type AppSidebarProps = {
  space: Space;
  pathname: string;
  businessId: string | null;
  collapsed?: boolean;
  onNavigate?: () => void;
};

export type NavItem = {
  href?: string;
  label: string;
  icon: ReactNode;
  accent?: 'wallet' | 'studio' | 'focus';
  onClick?: () => void;
  disabled?: boolean;
  hint?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function isActivePath(currentPathname: string, href?: string) {
  if (!href) return false;
  const cleanHref = href.split('?')[0];
  if (currentPathname === cleanHref) return true;
  if (cleanHref === '/app') return currentPathname === '/app';
  return currentPathname.startsWith(cleanHref + '/');
}

function accentClasses(accent?: NavItem['accent']) {
  if (accent === 'wallet')
    return 'data-[active=true]:shadow-[0_0_0_1px_rgba(59,130,246,0.35)]';
  if (accent === 'studio')
    return 'data-[active=true]:shadow-[0_0_0_1px_rgba(34,197,94,0.30)]';
  if (accent === 'focus')
    return 'data-[active=true]:shadow-[0_0_0_1px_rgba(244,63,94,0.28)]';
  return '';
}

/* ---------------- SECTIONS ---------------- */

function getGlobalSections(): NavSection[] {
  return [
    {
      title: 'Navigation',
      items: [
        { href: '/app', label: 'Accueil', icon: <LayoutDashboard size={18} /> },
        { href: '/app/personal', label: 'Wallet', icon: <Wallet2 size={18} />, accent: 'wallet' },
        { href: '/app/pro', label: 'Studio', icon: <Building2 size={18} />, accent: 'studio' },
      ],
    },
    {
      title: 'Compte',
      items: [{ href: '/app/account', label: 'Paramètres', icon: <Cog size={18} /> }],
    },
  ];
}

function getStudioRootSections(): NavSection[] {
  return [
    {
      title: 'Studio',
      items: [{ href: '/app/pro', label: 'Mes entreprises', icon: <Building2 size={18} />, accent: 'studio' }],
    },
    {
      title: 'Actions',
      items: [
        { href: '/app/pro?create=1', label: 'Créer une entreprise', icon: <span className="text-[16px] leading-none">+</span> },
        { href: '/app/pro?join=1', label: 'Rejoindre une entreprise', icon: <span className="text-[16px] leading-none">↗</span> },
      ],
    },
  ];
}

function getStudioBusinessSections(businessId: string): NavSection[] {
  const base = `/app/pro/${businessId}`;
  return [
    {
      title: 'Pilotage',
      items: [
        { href: `${base}`, label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      ],
    },
    {
      title: 'Commercial',
      items: [
        { href: `${base}/prospects`, label: 'Prospects', icon: <Users size={18} /> },
        { href: `${base}/clients`, label: 'Clients', icon: <Contact2 size={18} /> },
      ],
    },
    {
      title: 'Production',
      items: [
        { href: `${base}/projects`, label: 'Projets', icon: <Briefcase size={18} /> },
        { href: `${base}/tasks`, label: 'Tâches', icon: <CheckSquare size={18} /> },
        { href: `${base}/process`, label: 'Process', icon: <Workflow size={18} /> },
      ],
    },
    {
      title: 'Catalogue',
      items: [
        { href: `${base}/services`, label: 'Services', icon: <Package size={18} /> },
        { href: `${base}/references`, label: 'Références', icon: <Bookmark size={18} /> },
      ],
    },
    {
      title: 'Finances',
      items: [
        { href: `${base}/finances`, label: 'Finances', icon: <Banknote size={18} /> },
      ],
    },
    {
      title: 'Settings',
      items: [
        { href: `${base}/settings/team`, label: 'Équipe', icon: <Users size={18} /> },
        { href: `${base}/settings`, label: 'Paramètres', icon: <Cog size={18} /> },
      ],
    },
  ];
}

function getWalletSections(): NavSection[] {
  const base = '/app/personal';
  return [
    {
      title: 'Wallet',
      items: [
        { href: `${base}`, label: 'Vue d’accueil', icon: <Wallet2 size={18} />, accent: 'wallet' },
        { href: `${base}/comptes`, label: 'Comptes', icon: <Banknote size={18} /> },
        { href: `${base}/transactions`, label: 'Transactions', icon: <ClipboardList size={18} /> },
      ],
    },
  ];
}

function getFocusSections(): NavSection[] {
  return [];
}

function buildSections(space: Space, businessId: string | null): NavSection[] {
  if (space === 'pro') return businessId ? getStudioBusinessSections(businessId) : getStudioRootSections();
  if (space === 'perso') return getWalletSections();
  if (space === 'focus') return getFocusSections();
  return getGlobalSections();
}

/* ---------------- COMPONENT ---------------- */

export default function AppSidebar(props: AppSidebarProps) {
  const { space, pathname, businessId, collapsed = false, onNavigate } = props;
  const sections = buildSections(space, businessId);
  const activeCtx = useActiveBusiness({ optional: true });

  return (
    <nav
      className={classNames(
        'flex-1 overflow-y-auto px-2 py-3 text-[var(--text-primary)]',
        collapsed ? 'items-center' : ''
      )}
      aria-label="Navigation latérale"
    >
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                {section.title}
              </p>
            )}

            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);

                const baseClasses =
                  'group flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-medium transition-all duration-150 ease-out will-change-transform';
                const inactiveClasses =
                  'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]';
                const activeClasses =
                  'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]';

                const isDisabled = item.disabled;
                const sharedClasses = classNames(
                  baseClasses,
                  'hover:scale-[1.03] active:scale-[0.99]',
                  active ? activeClasses : inactiveClasses,
                  collapsed ? 'justify-center' : '',
                  accentClasses(item.accent),
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                  isDisabled ? 'cursor-not-allowed opacity-60' : ''
                );

                const content = item.onClick ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isDisabled) return;
                      item.onClick?.();
                      onNavigate?.();
                    }}
                    title={collapsed ? item.label : item.hint ?? item.label}
                    data-active={active ? 'true' : 'false'}
                    className={sharedClasses}
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                  >
                    <span className="text-[var(--text-secondary)] transition-transform duration-150 group-hover:scale-110 group-hover:text-[var(--text-primary)]">
                      {item.icon}
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.hint ? (
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">
                        {item.hint}
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <Link
                    key={`${section.title}-${item.href}-${item.label}`}
                    href={isDisabled ? '#' : item.href ?? '/app'}
                    onClick={(e) => {
                      if (isDisabled) {
                        e.preventDefault();
                        return;
                      }
                      onNavigate?.();
                    }}
                    title={collapsed ? item.label : item.hint ?? item.label}
                    data-active={active ? 'true' : 'false'}
                    className={sharedClasses}
                    aria-disabled={isDisabled}
                    tabIndex={isDisabled ? -1 : 0}
                  >
                    <span className="text-[var(--text-secondary)] transition-transform duration-150 group-hover:scale-110 group-hover:text-[var(--text-primary)]">
                      {item.icon}
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.hint ? (
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">
                        {item.hint}
                      </span>
                    ) : null}
                  </Link>
                );

                return item.onClick ? (
                  <div key={`${section.title}-${item.label}`}>{content}</div>
                ) : (
                  content
                );
              })}
            </div>
          </div>
        ))}
        {space === 'pro' && activeCtx?.openSwitchModal ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => activeCtx.openSwitchModal()}
              className={classNames(
                'group flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-medium transition-all duration-150 ease-out hover:scale-[1.03] active:scale-[0.99]',
                'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
                collapsed ? 'justify-center' : ''
              )}
            >
              <span className="text-[var(--text-secondary)] transition-transform duration-150 group-hover:scale-110 group-hover:text-[var(--text-primary)]">
                ↻
              </span>
              {!collapsed && <span className="truncate">Changer d’entreprise</span>}
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

/* ✅ utilitaires pour AppShell (menu title) */

export function getSidebarSections(space: Space, businessId: string | null): NavSection[] {
  return buildSections(space, businessId);
}

export function getActiveSidebarMeta(
  space: Space,
  pathname: string,
  businessId: string | null
): {
  sectionTitle?: string;
  itemLabel?: string;
  itemHref?: string;
} {
  const sections = buildSections(space, businessId);

  for (const section of sections) {
    for (const item of section.items) {
      if (!item.href) continue;
      if (isActivePath(pathname, item.href)) {
        return { sectionTitle: section.title, itemLabel: item.label, itemHref: item.href };
      }
    }
  }

  return {};
}
