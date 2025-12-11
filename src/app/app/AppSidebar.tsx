// src/app/app/AppSidebar.tsx
'use client';

import Link from 'next/link';

type Space = 'pro' | 'perso' | 'performance' | null;

type NavItem = {
  label: string;
  href: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type AppSidebarProps = {
  space: Space;
  pathname: string;
  businessId: string | null;
};

function getProSections(pathname: string, businessId: string | null): NavSection[] {
  if (!businessId) {
    const base = '/app/pro';
    return [
      {
        title: 'Espace PRO',
        items: [{ label: 'Mes entreprises', href: base }],
      },
    ];
  }

  const base = `/app/pro/${businessId}`;

  return [
    {
      title: 'Vue d’ensemble',
      items: [{ label: 'Dashboard', href: base }],
    },
    {
      title: '📊 Données de l’entreprise',
      items: [
        { label: 'Clients', href: `${base}/clients` },
        { label: 'Prospects', href: `${base}/prospects` },
        { label: 'Projets', href: `${base}/projets` },
        { label: 'Services', href: `${base}/services` },
        { label: 'Tâches', href: `${base}/taches` },
        { label: 'Finances Pro', href: `${base}/finances` },
        { label: 'Process & SOP', href: `${base}/process` },
      ],
    },
    {
      title: '📋 Pilotage & Process',
      items: [
        { label: 'Dashboard Projets', href: `${base}/dash-projets` },
        { label: 'Dashboard Finances Pro', href: `${base}/dash-finances` },
        { label: 'Admin & Process', href: `${base}/dash-admin-process` },
        { label: 'Vue d’ensemble entreprise', href: `${base}/dash-entreprise` },
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
        { label: 'Comptes bancaires', href: `${base}/comptes` },
        { label: 'Transactions', href: `${base}/transactions` },
        { label: 'Revenus perso', href: `${base}/revenus` },
        { label: 'Budgets & catégories', href: `${base}/budgets` },
        { label: 'Épargne & investissements', href: `${base}/epargne` },
        { label: 'Administratif perso', href: `${base}/admin` },
      ],
    },
    {
      title: '📈 Pilotage perso',
      items: [
        { label: 'Dashboard Finances Perso', href: `${base}/dash-finances` },
        { label: 'Objectifs & Runway', href: `${base}/dash-objectifs` },
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
        { label: 'Vue Performance Pro', href: `${base}/pro` },
        { label: 'Vue Performance Perso', href: `${base}/perso` },
        { label: 'Alignement Pro ↔ Perso', href: `${base}/alignement` },
      ],
    },
  ];
}

export default function AppSidebar({ space, pathname, businessId }: AppSidebarProps) {
  let sections: NavSection[] = [];

  if (space === 'pro') {
    sections = getProSections(pathname, businessId);
  } else if (space === 'perso') {
    sections = getPersoSections();
  } else if (space === 'performance') {
    sections = getPerformanceSections();
  }

  const showPlaceholder = sections.length === 0;

  return (
    <aside className="fixed left-0 top-14 bottom-0 z-30 w-64 border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-slate-800/80 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Navigation
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {space === 'pro' && 'Espace PRO (entreprise)'}
            {space === 'perso' && 'Espace PERSO (toi)'}
            {space === 'performance' && 'Espace PERFORMANCE'}
            {!space && 'Sélectionne un espace en haut'}
          </p>
        </div>

        {/* Contenu */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 text-xs">
          {showPlaceholder ? (
            <p className="text-slate-500 text-[11px]">
              Choisis 🟦 PRO, 🟩 PERSO ou 🟥 PERFORMANCE dans la barre du haut.
            </p>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {section.title}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== '/app' && pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={[
                            'block rounded-lg px-2.5 py-1.5 transition-colors',
                            isActive
                              ? 'bg-slate-800 text-slate-50'
                              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100',
                          ].join(' ')}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800/80 px-4 py-3 text-[11px] text-slate-500">
          <p className="font-semibold">StudioFief OS</p>
          <p>🟦 PRO · 🟩 PERSO · 🟥 PERFORMANCE</p>
        </div>
      </div>
    </aside>
  );
}
