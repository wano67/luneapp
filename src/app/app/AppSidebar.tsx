// src/app/app/AppSidebar.tsx
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type Space = 'pro' | 'perso' | 'performance' | null;

type NavItem = {
  label: string;
  href?: string;
  badge?: string;
  subtle?: boolean;
  icon?: ReactNode;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type AppSidebarProps = {
  space: Space;
  pathname: string;
  businessId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

function getProSections(businessId: string | null): NavSection[] {
  if (!businessId) {
    return [
      {
        title: 'Espace PRO',
        items: [
          {
            label:
              'Choisis ou crée une entreprise dans /app/pro pour déverrouiller cet espace.',
            subtle: true,
            icon: '🔒',
          },
        ],
      },
    ];
  }

  const base = `/app/pro/${businessId}`;

  return [
    {
      title: '📊 Données de l’entreprise',
      items: [
        { label: 'Vue d’ensemble', href: `${base}/dash-entreprise`, icon: '🏠' },
        { label: 'Clients', href: `${base}/clients`, icon: '👥' },
        { label: 'Prospects', href: `${base}/prospects`, icon: '🌱' },
        { label: 'Projets', href: `${base}/projets`, icon: '📁' },
        { label: 'Services', href: `${base}/services`, icon: '🧩' },
        { label: 'Tâches', href: `${base}/taches`, icon: '✅' },
        { label: 'Finances Pro', href: `${base}/finances`, icon: '💶' },
        { label: 'Process & SOP', href: `${base}/process`, icon: '⚙️' },
      ],
    },
    {
      title: '📋 Pilotage & Process',
      items: [
        { label: 'Dashboard Projets', href: `${base}/dash-projets`, icon: '📊' },
        {
          label: 'Dashboard Finances Pro',
          href: `${base}/dash-finances`,
          icon: '📈',
        },
        {
          label: 'Admin & Process',
          href: `${base}/dash-admin-process`,
          icon: '🧱',
        },
      ],
    },
  ];
}

function getPersoSections(): NavSection[] {
  const base = '/app/personal';

  return [
    {
      title: '💾 Données perso',
      items: [
        { label: 'Comptes bancaires', href: `${base}/comptes`, icon: '🏦' },
        { label: 'Transactions', href: `${base}/transactions`, icon: '🔁' },
        { label: 'Revenus perso', href: `${base}/revenus`, icon: '💰' },
        { label: 'Budgets & catégories', href: `${base}/budgets`, icon: '🧮' },
        { label: 'Épargne & investissements', href: `${base}/epargne`, icon: '📥' },
        { label: 'Administratif perso', href: `${base}/admin`, icon: '📂' },
      ],
    },
    {
      title: '📈 Pilotage perso',
      items: [
        {
          label: 'Dashboard Finances Perso',
          href: `${base}/dash-finances`,
          icon: '📈',
        },
        {
          label: 'Objectifs & Runway',
          href: `${base}/dash-objectifs`,
          icon: '🎯',
        },
      ],
    },
  ];
}

function getPerformanceSections(): NavSection[] {
  const base = '/app/performance';

  return [
    {
      title: '🟥 Performance',
      items: [
        { label: 'Vue Performance Pro', href: `${base}/pro`, icon: '🏢' },
        { label: 'Vue Performance Perso', href: `${base}/perso`, icon: '🙋‍♂️' },
        {
          label: 'Alignement Pro ↔ Perso',
          href: `${base}/alignement`,
          icon: '⚖️',
        },
      ],
    },
  ];
}

function getSections(space: Space, businessId: string | null): NavSection[] {
  if (space === 'pro') return getProSections(businessId);
  if (space === 'perso') return getPersoSections();
  if (space === 'performance') return getPerformanceSections();
  return [
    {
      title: 'Navigation',
      items: [
        {
          label: 'Choisis PRO, PERSO ou PERFORMANCE dans la barre du haut.',
          subtle: true,
          icon: '👆',
        },
      ],
    },
  ];
}

function getSpaceLabel(space: Space): string {
  if (space === 'pro') return 'Espace PRO';
  if (space === 'perso') return 'Espace PERSO';
  if (space === 'performance') return 'Espace PERFORMANCE';
  return 'StudioFief OS';
}

function getSpaceSubtitle(space: Space): string {
  if (space === 'pro') return 'Entreprise · clients, projets, finances';
  if (space === 'perso') return 'Toi · finances personnelles & runway';
  if (space === 'performance') return 'Analyses croisées Pro ↔ Perso';
  return 'Choisis un espace dans la top-bar';
}

export default function AppSidebar({
  space,
  pathname,
  businessId,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
}: AppSidebarProps) {
  const sections = getSections(space, businessId);
  const spaceLabel = getSpaceLabel(space);
  const spaceSubtitle = getSpaceSubtitle(space);

  const desktopWidth = collapsed ? 'w-20' : 'w-64';

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside
        className={`fixed left-0 top-14 bottom-0 z-30 hidden px-3 py-4 md:block ${desktopWidth}`}
      >
        <div
          className={[
            'flex h-full flex-col rounded-2xl border shadow-[0_0_0_1px_rgba(15,23,42,0.08)]',
            // light
            'border-slate-200 bg-slate-50',
            // dark
            'dark:border-slate-800 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-950 dark:to-slate-900',
          ].join(' ')}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 pb-3 pt-2 dark:border-slate-800">
            {!collapsed && (
              <div className="flex flex-col">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                  {spaceLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {spaceSubtitle}
                </p>
              </div>
            )}
            {collapsed && (
              <div className="mx-auto text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                {spaceLabel.replace('Espace ', '')}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-4 pt-3">
            {sections.map((section) => (
              <SectionBlock
                key={section.title}
                section={section}
                pathname={pathname}
                collapsed={collapsed}
              />
            ))}
          </nav>

          {/* Footer : bouton collapse */}
          <div className="mt-auto border-t border-slate-200 px-2 py-3 text-[10px] text-slate-500 dark:border-slate-800 dark:text-slate-500">
            <div className="flex items-center justify-between gap-2">
              {!collapsed && <span>StudioFief OS · v0.1</span>}
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="ml-auto inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                title={collapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
              >
                <span className="mr-1 text-xs">{collapsed ? '⟩' : '⟨'}</span>
                {!collapsed && <span>Replier</span>}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE SIDEBAR (burger) */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity ${
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />

        {/* Drawer */}
        <aside
          className={`absolute left-0 top-14 bottom-0 w-64 bg-slate-950 text-slate-50 shadow-xl transition-transform ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col border-r border-slate-800">
            {/* Header mobile */}
            <div className="border-b border-slate-800 px-3 pb-3 pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                {spaceLabel}
              </p>
              <p className="mt-1 text-xs text-slate-500">{spaceSubtitle}</p>
            </div>

            {/* Nav mobile (non collapsée) */}
            <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-4 pt-3">
              {sections.map((section) => (
                <SectionBlock
                  key={section.title}
                  section={section}
                  pathname={pathname}
                  collapsed={false}
                />
              ))}
            </nav>

            <div className="border-t border-slate-800 px-3 py-3 text-[10px] text-slate-500">
              <button
                type="button"
                onClick={onMobileClose}
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-200"
              >
                Fermer le menu
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

type SectionBlockProps = {
  section: NavSection;
  pathname: string;
  collapsed: boolean;
};

function SectionBlock({ section, pathname, collapsed }: SectionBlockProps) {
  if (collapsed) {
    // Mode replié : icônes seules + tooltip
    return (
      <div className="flex flex-col gap-1">
        {section.items.map((item) => {
          const key = `${section.title}-${item.label}`;
          if (!item.href) {
            return (
              <div
                key={key}
                className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-100 px-2 py-2 text-[12px] text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
                title={item.label}
              >
                <span>{item.icon ?? '…'}</span>
              </div>
            );
          }

          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');

          const baseClasses =
            'group flex items-center justify-center rounded-lg px-2 py-2 text-[16px] transition-colors';

          const stateClasses = isActive
            ? 'bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900'
            : 'bg-transparent text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50';

          return (
            <Link
              key={key}
              href={item.href}
              className={`${baseClasses} ${stateClasses}`}
              title={item.label}
            >
              <span>{item.icon ?? '•'}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  // Mode développé (desktop ou mobile)
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
        {section.title}
      </p>
      <div className="space-y-1">
        {section.items.map((item) => {
          const key = `${section.title}-${item.label}`;
          if (!item.href) {
            return (
              <div
                key={key}
                className="flex items-start gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
              >
                <span className="mt-[1px]">{item.icon ?? '•'}</span>
                <span>{item.label}</span>
              </div>
            );
          }

          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');

          const baseClasses =
            'group flex items-center justify-between rounded-lg px-3 py-2 text-[12px] transition-colors';

          const stateClasses = isActive
            ? 'bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900'
            : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50';

          return (
            <Link key={key} href={item.href} className={`${baseClasses} ${stateClasses}`}>
              <div className="flex items-center gap-2">
                <span className="text-[15px]">{item.icon ?? '•'}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={
                    'ml-2 rounded-full border px-2 py-0.5 text-[10px] ' +
                    (isActive
                      ? 'border-slate-900/20 bg-slate-900/10 text-slate-50 dark:border-slate-900/30 dark:bg-slate-900/10 dark:text-slate-900'
                      : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300')
                  }
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
