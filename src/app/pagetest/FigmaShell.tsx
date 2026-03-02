'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { fetchJson } from '@/lib/apiClient';
import {
  IconPerso,
  IconEntreprise,
  IconFocus,
  IconDashboard,
  IconOperation,
  IconCrm,
  IconCatalogue,
  IconStock,
  IconFinance,
  IconUser,
  IconToggleSidebar,
  IconAlert,
  IconMessage,
  IconSettings,
  PivotLogo,
} from './pivot-icons';

/* ═══ Design Tokens ═══ */

const C = {
  rose: '#BF7F82',
  roseDark: '#71484A',
  roseLight: '#FBE6F0',
  cream: '#EEEDE3',
  dark: '#343434',
  gray: '#EBEBEB',
  searchIcon: '#503334',
} as const;

/* ═══ Route parsing ═══ */

type PageType = 'home' | 'pro' | 'business' | 'focus';

function getPageType(pathname: string): PageType {
  if (pathname.startsWith('/pagetest/business')) return 'business';
  if (pathname.startsWith('/pagetest/pro')) return 'pro';
  if (pathname.startsWith('/pagetest/focus')) return 'focus';
  return 'home';
}

function extractBusinessId(pathname: string): string | null {
  const m = pathname.match(/^\/pagetest\/business\/([^/]+)/);
  return m ? m[1] : null;
}

function getBusinessSubPage(pathname: string): string {
  const m = pathname.match(/^\/pagetest\/business\/[^/]+\/(.+)/);
  return m ? m[1] : '';
}

const PAGE_LABELS: Record<string, string> = {
  '': 'Dashboard',
  operations: 'Opérations',
  crm: 'CRM',
  catalogue: 'Catalogue',
  stock: 'Stock',
  finances: 'Finances',
};

/* ═══ Shell ═══ */

export default function FigmaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const pageType = getPageType(pathname);
  const businessId = extractBusinessId(pathname);
  const subPage = getBusinessSubPage(pathname);

  const [userName, setUserName] = useState('');
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const [me, biz] = await Promise.all([
        fetchJson<{ user?: { name?: string } }>('/api/auth/me', {}, ctrl.signal),
        fetchJson<{ items?: Array<{ business?: { id?: string; name?: string } }> }>(
          '/api/pro/businesses',
          {},
          ctrl.signal
        ),
      ]);
      if (ctrl.signal.aborted) return;
      if (me.ok && me.data?.user?.name) setUserName(me.data.user.name);
      if (biz.ok) {
        setBusinesses(
          (biz.data?.items ?? [])
            .map((i) => ({ id: String(i.business?.id ?? ''), name: i.business?.name ?? '' }))
            .filter((b) => b.id)
        );
      }
    })();
    return () => ctrl.abort();
  }, []);

  const nameParts = userName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const currentBiz = businesses.find((b) => b.id === businessId);

  const bizBase = businessId ? `/pagetest/business/${businessId}` : '';

  return (
    <div className="flex min-h-screen" style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
      {/* ═══ SIDEBAR ═══ */}
      <aside
        className="shrink-0 hidden md:flex flex-col justify-between transition-all duration-200"
        style={{
          width: collapsed ? 'auto' : 220,
          background: C.dark,
          borderRadius: 8,
          padding: '24px 16px',
        }}
      >
        <div className="flex flex-col gap-6">
          {/* Header: Logo + Toggle */}
          {collapsed ? (
            <button type="button" onClick={() => setCollapsed(false)}>
              <PivotLogo size={49} />
            </button>
          ) : (
            <div className="flex items-start justify-between">
              <PivotLogo size={49} />
              <button
                type="button"
                className="hover:opacity-80 transition-opacity"
                onClick={() => setCollapsed(true)}
              >
                <IconToggleSidebar size={24} />
              </button>
            </div>
          )}

          {/* Business nav */}
          {pageType === 'business' && bizBase && (
            <SidebarSection title="Navigation" collapsed={collapsed}>
              <SidebarItem icon={(c) => <IconDashboard size={24} color={c} />} label="Dashboard" href={bizBase} active={subPage === ''} collapsed={collapsed} />
              <SidebarItem icon={(c) => <IconOperation size={24} color={c} />} label="Opérations" href={`${bizBase}/operations`} active={subPage === 'operations'} collapsed={collapsed} />
              <SidebarItem icon={(c) => <IconCrm size={24} color={c} />} label="CRM" href={`${bizBase}/crm`} active={subPage === 'crm'} collapsed={collapsed} />
              <SidebarItem icon={(c) => <IconCatalogue size={24} color={c} />} label="Catalogue" href={`${bizBase}/catalogue`} active={subPage === 'catalogue'} collapsed={collapsed} />
              <SidebarItem icon={(c) => <IconStock size={24} color={c} />} label="Stock" href={`${bizBase}/stock`} active={subPage === 'stock'} collapsed={collapsed} />
              <SidebarItem icon={(c) => <IconFinance size={24} color={c} />} label="Finances" href={`${bizBase}/finances`} active={subPage === 'finances'} collapsed={collapsed} />
            </SidebarSection>
          )}

          {/* Générale (non-business) */}
          {pageType !== 'business' && (
            <SidebarSection title="Générale" collapsed={collapsed}>
              <SidebarItem icon={(c) => <IconPerso size={24} color={c} />} label="Perso" href="/pagetest" active={pageType === 'home'} collapsed={collapsed} />
              <SidebarItem icon={(c) => <IconEntreprise size={24} color={c} />} label="Entreprise" href="/pagetest/pro" active={pageType === 'pro'} collapsed={collapsed} />
              <SidebarItem icon={(c) => <IconFocus size={24} color={c} />} label="Focus" href="/pagetest/focus" active={pageType === 'focus'} collapsed={collapsed} />
            </SidebarSection>
          )}
        </div>

        {/* Bottom */}
        <div className="flex flex-col gap-4">
          {/* Générale (business bottom) */}
          {pageType === 'business' && (
            <SidebarSection title="Générale" collapsed={collapsed}>
              <SidebarItem icon={(c) => <IconPerso size={24} color={c} />} label="Perso" href="/pagetest" collapsed={collapsed} />
              <SidebarItem icon={(c) => <IconEntreprise size={24} color={c} />} label="Entreprise" href="/pagetest/pro" collapsed={collapsed} />
              <SidebarItem icon={(c) => <IconFocus size={24} color={c} />} label="Focus" href="/pagetest/focus" collapsed={collapsed} />
            </SidebarSection>
          )}

          {/* User card */}
          {collapsed ? (
            <button
              type="button"
              className="flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity"
              style={{ background: 'white', padding: 12 }}
            >
              <IconUser size={24} color={C.dark} />
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-lg flex-wrap content-center" style={{ background: 'white', padding: 8 }}>
              <div className="flex items-center justify-center">
                <div className="flex flex-col items-start rounded-lg overflow-hidden" style={{ width: 32, padding: 4, background: C.dark }}>
                  <IconUser size={24} color="white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: C.dark, fontSize: 16, fontFamily: 'Inter, sans-serif', fontWeight: 300, lineHeight: '16px' }}>
                  {firstName}
                  {lastName && <><br />{lastName}</>}
                </p>
              </div>
              <ChevronDown size={12} style={{ color: C.dark }} />
            </div>
          )}
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="flex items-center justify-between" style={{ background: C.gray, padding: '16px 24px' }}>
          <div className="flex items-center gap-3">
            <Breadcrumb
              pageType={pageType}
              subPage={subPage}
              businessName={currentBiz?.name}
              businessId={businessId}
            />
            <SearchBar />
          </div>
          <div className="flex items-center gap-3">
            <NavIconButton><IconAlert size={20} /></NavIconButton>
            <NavIconButton><IconMessage size={20} /></NavIconButton>
            <NavIconButton><IconSettings size={20} /></NavIconButton>
            {/* Business switcher */}
            {pageType === 'business' && businesses.length > 0 && (
              <BusinessSwitcher
                businesses={businesses}
                currentId={businessId}
              />
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ═══ Sidebar Section ═══ */

function SidebarSection({ title, collapsed, children }: { title: string; collapsed: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: 4 }}>
      {!collapsed && (
        <p style={{ color: 'white', fontSize: 14, fontFamily: 'var(--font-barlow), sans-serif', fontWeight: 300, textTransform: 'uppercase', lineHeight: '14px', height: 18 }}>
          {title}
        </p>
      )}
      <div className="flex flex-col" style={{ gap: collapsed ? 12 : 0 }}>{children}</div>
    </div>
  );
}

/* ═══ Sidebar Item ═══ */

function SidebarItem({ icon, label, href, active, chevron, collapsed }: { icon: (c: string) => ReactNode; label: string; href?: string; active?: boolean; chevron?: boolean; collapsed: boolean }) {
  const iconColor = collapsed ? C.dark : (active ? C.dark : C.cream);
  const showBg = collapsed || active;

  const content = collapsed ? (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon(iconColor)}</span>
  ) : (
    <>
      <span style={{ display: 'flex', alignItems: 'center' }}>{icon(iconColor)}</span>
      <span className="flex-1" style={{ color: iconColor, fontSize: 18, fontFamily: 'var(--font-barlow), sans-serif', fontWeight: 600, lineHeight: '18px' }}>{label}</span>
      {chevron && <ChevronDown size={18} style={{ color: iconColor }} />}
    </>
  );

  const cls = ['flex items-center rounded-lg transition-colors', collapsed ? 'justify-center py-3' : 'gap-3 px-2 py-3', !showBg ? 'hover:opacity-80' : ''].join(' ');
  const style = showBg ? { background: C.cream } : undefined;

  if (href) return <Link href={href} className={cls} style={style}>{content}</Link>;
  return <button type="button" className={cls} style={style}>{content}</button>;
}

/* ═══ Breadcrumb ═══ */

function Breadcrumb({ pageType, subPage, businessName, businessId }: { pageType: PageType; subPage: string; businessName?: string; businessId?: string | null }) {
  if (pageType === 'business') {
    const currentLabel = PAGE_LABELS[subPage] ?? subPage;
    return (
      <div className="flex items-center gap-1 text-sm">
        <Link href="/pagetest/pro" className="px-4 py-2 rounded-2xl" style={{ color: 'rgba(0,0,0,0.4)' }}>Entreprise</Link>
        <span style={{ color: 'rgba(0,0,0,0.1)' }}>/</span>
        {businessName && (
          <>
            <Link href={`/pagetest/business/${businessId}`} className="px-2 py-2 rounded-2xl" style={{ color: subPage ? 'rgba(0,0,0,0.4)' : C.dark }}>
              {businessName}
            </Link>
            {subPage && <span style={{ color: 'rgba(0,0,0,0.1)' }}>/</span>}
          </>
        )}
        {subPage && <span className="px-2 py-2 rounded-2xl" style={{ color: C.dark }}>{currentLabel}</span>}
      </div>
    );
  }

  const labels: Record<PageType, string> = { home: 'Accueil', pro: 'Entreprises', focus: 'Focus', business: '' };
  return <span className="px-4 py-2 rounded-2xl text-sm" style={{ color: C.dark }}>{labels[pageType]}</span>;
}

/* ═══ Business Switcher ═══ */

function BusinessSwitcher({ businesses, currentId }: { businesses: Array<{ id: string; name: string }>; currentId: string | null }) {
  const [open, setOpen] = useState(false);
  const current = businesses.find((b) => b.id === currentId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 rounded-lg"
        style={{ background: C.dark, padding: 8 }}
      >
        <div className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, background: 'white' }}>
          <IconEntreprise size={18} color={C.dark} />
        </div>
        {current && <span className="text-white text-sm max-w-[120px] truncate">{current.name}</span>}
        <ChevronDown size={12} className="text-white" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg py-2 z-50 min-w-[200px]" style={{ border: `1px solid ${C.gray}` }}>
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/pagetest/business/${b.id}`}
              className="block px-4 py-2 text-sm hover:bg-black/5 transition-colors"
              style={{ color: b.id === currentId ? C.rose : C.dark, fontWeight: b.id === currentId ? 600 : 400 }}
              onClick={() => setOpen(false)}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ Search Bar ═══ */

function SearchBar() {
  return (
    <div className="flex items-center gap-2 rounded-full overflow-hidden" style={{ background: C.rose, padding: '8px 12px 8px 8px', width: 350, maxWidth: '100%' }}>
      <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: C.roseLight }}>
        <Search size={14} style={{ color: C.searchIcon }} />
      </div>
      <input type="text" placeholder="Recherche" className="flex-1 bg-transparent text-white placeholder-white/80 text-sm outline-none" style={{ fontFamily: 'Inter, sans-serif' }} />
    </div>
  );
}

/* ═══ Nav Icon Button ═══ */

function NavIconButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="relative flex items-center justify-center rounded-full hover:opacity-80 transition-opacity" style={{ width: 32, height: 32, background: 'white' }}>
      {children}
    </button>
  );
}
