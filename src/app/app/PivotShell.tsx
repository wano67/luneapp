'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FileDropProvider } from '@/components/file-drop/FileDropProvider';
import { fetchJson } from '@/lib/apiClient';
import PivotSidebar from './PivotSidebar';
import PivotTopbar from './PivotTopbar';
import PivotMobileNav from './PivotMobileNav';

const GlobalInboxPanel = dynamic(() => import('@/components/messaging/GlobalInboxPanel'), { ssr: false });

export type Space = 'home' | 'pro' | 'perso' | 'focus' | null;

export function getCurrentSpace(pathname: string): Space {
  if (pathname === '/app' || pathname === '/app/') return 'home';
  if (pathname.startsWith('/app/pro')) return 'pro';
  if (pathname.startsWith('/app/personal')) return 'perso';
  if (pathname.startsWith('/app/focus') || pathname.startsWith('/app/performance')) return 'focus';
  if (pathname.startsWith('/app/account')) return null;
  return null;
}

export function getBusinessIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/app\/pro\/(\d+)/);
  return m ? m[1] : null;
}

export type BusinessItem = { id: string; name: string };

export default function PivotShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const space = getCurrentSpace(pathname);
  const businessId = getBusinessIdFromPath(pathname);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userName, setUserName] = useState('');
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [messagingOpen, setMessagingOpen] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const [me, biz] = await Promise.all([
        fetchJson<{ user?: { name?: string } }>('/api/auth/me', {}, ctrl.signal),
        fetchJson<{ items?: Array<{ business?: { id?: bigint | string; name?: string } }> }>(
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
            .filter((b) => b.id && b.id !== '0')
        );
      }
    })();
    return () => ctrl.abort();
  }, []);

  return (
    <FileDropProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
        {/* Desktop sidebar */}
        <PivotSidebar
          space={space}
          pathname={pathname}
          businessId={businessId}
          businesses={businesses}
          userName={userName}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />

        {/* Main content area */}
        <div className="flex flex-1 flex-col min-h-0 min-w-0">
          <PivotTopbar
            space={space}
            pathname={pathname}
            businessId={businessId}
            businesses={businesses}
            onToggleMessaging={() => setMessagingOpen((v) => !v)}
          />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
        </div>

        {/* Mobile nav */}
        <PivotMobileNav
          space={space}
          pathname={pathname}
          businessId={businessId}
          businesses={businesses}
          userName={userName}
        />
      </div>

      {/* Global messaging panel */}
      {businessId && (
        <GlobalInboxPanel
          businessId={businessId}
          open={messagingOpen}
          onClose={() => setMessagingOpen(false)}
        />
      )}
    </FileDropProvider>
  );
}
