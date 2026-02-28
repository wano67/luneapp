// src/app/app/AppSidebar.tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Wallet2, Building2, Banknote, FileText } from 'lucide-react';
import { useActiveBusiness } from './pro/ActiveBusinessProvider';
import { normalizeWebsiteUrl } from '@/lib/website';
import { proNavSections, type ProNavSectionConfig } from '@/config/proNav';

export type Space = 'home' | 'pro' | 'perso' | 'focus' | null;

type AppSidebarProps = {
  space: Space;
  pathname: string;
  businessId: string | null;
  collapsed?: boolean;
  onNavigateAction?: () => void;
};

export type NavItem = {
  href?: string;
  label: string;
  icon: ReactNode;
  accent?: 'wallet' | 'studio' | 'focus';
  onClick?: () => void;
  disabled?: boolean;
  hint?: string;
  activePatterns?: RegExp[];
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function matchLength(pathname: string, item: NavItem): number {
  let best = -1;
  if (item.activePatterns) {
    for (const re of item.activePatterns) {
      const m = pathname.match(re);
      if (m?.[0]) best = Math.max(best, m[0].length);
    }
  }
  if (item.href) {
    const clean = item.href.split('?')[0];
    if (pathname === clean) {
      best = Math.max(best, clean.length + 0.5); // exact match wins ties
    } else if (pathname.startsWith(`${clean}/`)) {
      best = Math.max(best, clean.length);
    }
  }
  return best;
}

export function getActiveNavKey(pathname: string, sections: NavSection[]): string | null {
  let bestKey: string | null = null;
  let bestLen = -1;
  for (const section of sections) {
    for (const item of section.items) {
      const len = matchLength(pathname, item);
      if (len > bestLen) {
        bestLen = len;
        bestKey = item.href ?? item.label;
      }
    }
  }
  return bestKey;
}

function accentClasses(accent?: NavItem['accent']) {
  if (accent === 'wallet') return 'data-[active=true]:border-[var(--border)] data-[active=true]:bg-[var(--surface)]';
  if (accent === 'studio') return 'data-[active=true]:border-[var(--border)] data-[active=true]:bg-[var(--surface)]';
  if (accent === 'focus') return 'data-[active=true]:border-[var(--border)] data-[active=true]:bg-[var(--surface)]';
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
  ];
}

function getProSections(businessId: string | null): NavSection[] {
  const base = businessId ? `/app/pro/${businessId}` : '/app/pro';
  const disabled = !businessId;

  function sectionToNav(section: ProNavSectionConfig): NavSection {
    return {
      title: section.title,
      items: section.items.map((item) => {
        const href = disabled ? base : item.href(businessId as string);
        return {
          href,
          label: item.label,
          icon: <item.icon size={18} />,
          disabled,
          hint: section.secondary || item.secondary ? 'Secondaire' : undefined,
          activePatterns: disabled ? undefined : item.activePatterns?.(businessId as string),
        };
      }),
    };
  }

  return proNavSections.map(sectionToNav);
}

function getWalletSections(): NavSection[] {
  const base = '/app/personal';
  return [
    {
      title: 'Wallet',
      items: [
        { href: `${base}`, label: 'Vue d’accueil', icon: <Wallet2 size={18} />, accent: 'wallet' },
        { href: `${base}/comptes`, label: 'Comptes', icon: <Banknote size={18} /> },
        { href: `${base}/transactions`, label: 'Transactions', icon: <FileText size={18} /> },
      ],
    },
  ];
}

function getFocusSections(): NavSection[] {
  return [];
}

function buildSections(space: Space, businessId: string | null): NavSection[] {
  if (space === 'pro') return getProSections(businessId);
  if (space === 'perso') return getWalletSections();
  if (space === 'focus') return getFocusSections();
  return getGlobalSections();
}

/* ---------------- COMPONENT ---------------- */

export default function AppSidebar(props: AppSidebarProps) {
  const { space, pathname, businessId, collapsed = false, onNavigateAction } = props;
  const [businesses, setBusinesses] = useState<SidebarBusiness[] | null>(null);
  const [recentBusinessIds, setRecentBusinessIds] = useState<string[]>([]);
  const sections = buildSections(space, businessId);
  const activeNavKey = useMemo(() => getActiveNavKey(pathname, sections), [pathname, sections]);
  const activeCtx = useActiveBusiness({ optional: true });

  // hydrate recent business list
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('recentProBusinessIds');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecentBusinessIds(parsed.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      // ignore
    }
  }, []);

  // update recents when visiting a business
  useEffect(() => {
    const currentBiz = businessId ?? getBusinessIdFromPath(pathname);
    if (!currentBiz || typeof window === 'undefined') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentBusinessIds((prev) => {
      const next = [currentBiz, ...prev.filter((id) => id !== currentBiz)].slice(0, 3);
      try {
        window.localStorage.setItem('recentProBusinessIds', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [businessId, pathname]);

  useEffect(() => {
    if (space !== 'pro') return;
    let aborted = false;
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch('/api/pro/businesses', { signal: controller.signal });
        if (!res.ok) return;
        const json: { items?: Array<{ business: SidebarBusiness; role?: string }> } = await res.json();
        if (aborted) return;
        const items =
          json?.items?.map((item) => ({
            id: item?.business?.id,
            name: item?.business?.name ?? `Business ${item?.business?.id ?? ''}`,
            websiteUrl: item?.business?.websiteUrl,
            role: item?.role,
          })) ?? [];
        setBusinesses(items.filter((b) => b.id));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load businesses for sidebar', err);
      }
    }
    void load();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [space]);

  const activeBusinessId = businessId ?? getBusinessIdFromPath(pathname);
  const activeBusiness = activeBusinessId
    ? businesses?.find((b) => b.id === activeBusinessId)
    : null;
  const businessMap = useMemo(() => {
    const map = new Map<string, SidebarBusiness>();
    (businesses ?? []).forEach((b) => {
      if (b.id) map.set(b.id, b);
    });
    return map;
  }, [businesses]);

  const recentSection =
    space === 'pro' && !activeBusinessId && recentBusinessIds.length
      ? [
          {
            title: 'Récents',
            items: recentBusinessIds.map(
              (id): NavItem => ({
                href: `/app/pro/${id}`,
                label: businessMap.get(id)?.name ?? 'Entreprise',
                icon: (
                  <LogoMark
                    name={businessMap.get(id)?.name ?? 'Entreprise'}
                    websiteUrl={businessMap.get(id)?.websiteUrl}
                  />
                ),
              })
            ),
          },
        ]
      : [];

  return (
    <nav
      className={classNames(
        'flex-1 overflow-y-auto px-2 py-3 text-[var(--text-primary)]',
        collapsed ? 'items-center' : ''
      )}
      aria-label="Navigation latérale"
    >
      <div className="flex flex-col gap-4">
        {space === 'pro' ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)]/80 bg-[var(--surface)] p-3">
            <LogoMark name={activeBusiness?.name ?? 'Entreprise'} websiteUrl={activeBusiness?.websiteUrl} size={32} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Entreprise active
              </p>
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {activeBusiness?.name ?? 'Aucune sélection'}
              </p>
              {!activeBusinessId ? (
                <Link
                  href="/app/pro"
                  className="text-[11px] text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                >
                  Choisir une entreprise
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {[...sections, ...recentSection].map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                {section.title}
              </p>
            )}

            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active = activeNavKey === (item.href ?? item.label);

                const baseClasses =
                  'group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ease-out';
                const inactiveClasses =
                  'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]';
                const activeClasses =
                  'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-sm data-[active=true]:border-l-2 data-[active=true]:border-l-[var(--border)]';

                const isDisabled = item.disabled;
                const sharedClasses = classNames(
                  baseClasses,
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
                      onNavigateAction?.();
                    }}
                    title={collapsed ? item.label : item.hint ?? item.label}
                    data-active={active ? 'true' : 'false'}
                    className={sharedClasses}
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    aria-current={active ? 'page' : undefined}
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
                      onNavigateAction?.();
                    }}
                    title={collapsed ? item.label : item.hint ?? item.label}
                    data-active={active ? 'true' : 'false'}
                    className={sharedClasses}
                    aria-disabled={isDisabled}
                    aria-current={active ? 'page' : undefined}
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
  const activeKey = getActiveNavKey(pathname, sections);

  for (const section of sections) {
    for (const item of section.items) {
      if (!item.href) continue;
      if (activeKey === (item.href ?? item.label)) {
        return { sectionTitle: section.title, itemLabel: item.label, itemHref: item.href };
      }
    }
  }

  return {};
}

function getBusinessIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'app' || parts[1] !== 'pro') return null;
  const maybeId = parts[2];
  if (!maybeId) return null;
  if (!/^\d+$/.test(maybeId)) return null;
  return maybeId;
}

type SidebarBusiness = {
  id: string;
  name: string;
  websiteUrl?: string | null;
  role?: string;
};

type LogoProps = { name: string; websiteUrl?: string | null; size?: number };

function LogoMark({ name, websiteUrl, size = 28 }: LogoProps) {
  const normalized = normalizeWebsiteUrl(websiteUrl).value;
  const src = normalized ? `/api/logo?url=${encodeURIComponent(normalized)}` : null;
  const initials =
    name?.trim().split(/\s+/).map((part) => part[0] || '')?.join('').slice(0, 2).toUpperCase() ||
    '??';
  const [errored, setErrored] = useState(false);

  return (
    <span
      className="inline-flex items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]"
      style={{ width: size, height: size, minWidth: size }}
      aria-hidden
    >
      {src && !errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full rounded-lg object-cover"
          width={size}
          height={size}
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <span className="text-[10px] font-semibold text-[var(--text-primary)]">{initials}</span>
      )}
    </span>
  );
}
