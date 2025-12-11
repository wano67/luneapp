// src/app/app/AppSidebar.tsx
'use client';

import Link from 'next/link';

export type Space = 'pro' | 'perso' | 'performance' | null;

type AppSidebarProps = {
  space: Space;
  pathname: string;
  businessId: string | null;
  collapsed?: boolean;
  onNavigate?: () => void;
};

type NavItem = {
  href: string;
  label: string;
  icon: string; // simple emoji pour éviter de rajouter une lib
};

type NavSection = {
  title: string;
  items: NavItem[];
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

// ----- SECTIONS PRO / PERSO / PERFORMANCE -----

function getProSections(businessId: string | null): NavSection[] {
  if (!businessId) {
    return [
      {
        title: 'Espace PRO',
        items: [
          {
            href: '/app/pro',
            label: 'Choisir une entreprise',
            icon: '🏢',
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
        { href: `${base}/dash-entreprise`, label: 'Vue d’ensemble', icon: '📌' },
        { href: `${base}/clients`, label: 'Clients', icon: '👥' },
        { href: `${base}/prospects`, label: 'Prospects', icon: '🧲' },
        { href: `${base}/projets`, label: 'Projets', icon: '📁' },
        { href: `${base}/services`, label: 'Services', icon: '🛠️' },
        { href: `${base}/taches`, label: 'Tâches', icon: '✅' },
        { href: `${base}/finances`, label: 'Finances Pro', icon: '💶' },
        { href: `${base}/process`, label: 'Process & SOP', icon: '📚' },
      ],
    },
    {
      title: '📋 Pilotage & dashboards',
      items: [
        { href: `${base}/dash-projets`, label: 'Dashboard Projets', icon: '📈' },
        { href: `${base}/dash-finances`, label: 'Dashboard Finances', icon: '💹' },
        { href: `${base}/dash-admin-process`, label: 'Admin & Process', icon: '🧩' },
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
        { href: `${base}`, label: 'Vue d’accueil', icon: '🏠' },
        { href: `${base}/comptes`, label: 'Comptes bancaires', icon: '🏦' },
        { href: `${base}/transactions`, label: 'Transactions', icon: '💳' },
        { href: `${base}/revenus`, label: 'Revenus', icon: '💼' },
        { href: `${base}/budgets`, label: 'Budgets', icon: '📊' },
        { href: `${base}/epargne`, label: 'Épargne & investissements', icon: '📈' },
        { href: `${base}/admin`, label: 'Administratif', icon: '📂' },
      ],
    },
    {
      title: '📈 Pilotage perso',
      items: [
        { href: `${base}/dash-finances`, label: 'Dashboard Finances', icon: '💹' },
        { href: `${base}/dash-objectifs`, label: 'Objectifs & Runway', icon: '🎯' },
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
        { href: `${base}/pro`, label: 'Vue Performance Pro', icon: '🏢' },
        { href: `${base}/perso`, label: 'Vue Performance Perso', icon: '🧍‍♂️' },
        { href: `${base}/alignement`, label: 'Alignement Pro ↔ Perso', icon: '⚖️' },
      ],
    },
  ];
}

function buildSections(space: Space, businessId: string | null): NavSection[] {
  if (space === 'pro') return getProSections(businessId);
  if (space === 'perso') return getPersoSections();
  if (space === 'performance') return getPerformanceSections();
  // Page /app d’accueil ou route inconnue
  return [
    {
      title: 'StudioFief OS',
      items: [
        { href: '/app/pro', label: 'Espace PRO', icon: '🟦' },
        { href: '/app/personal', label: 'Espace PERSO', icon: '🟩' },
        { href: '/app/performance', label: 'Espace PERFORMANCE', icon: '🟥' },
        { href: '/app/docs', label: 'API Docs', icon: '📜' },
      ],
    },
  ];
}

// ----- COMPONENT -----

export default function AppSidebar(props: AppSidebarProps) {
  const { space, pathname, businessId, collapsed = false, onNavigate } = props;

  const sections = buildSections(space, businessId);

  return (
    <nav
      className={classNames(
        'flex-1 overflow-y-auto px-2 py-3 text-[var(--text-primary)]',
        collapsed ? 'items-center' : ''
      )}
      aria-label="Navigation principale"
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
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/app/pro' &&
                    pathname.startsWith(item.href) &&
                    item.href !== '/app/personal');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={classNames(
                      'group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                      collapsed ? 'justify-center' : ''
                    )}
                  >
                    <span className="text-base">{item.icon}</span>
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
