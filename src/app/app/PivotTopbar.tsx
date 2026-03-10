'use client';

import type { ReactNode } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronDown, Search, CheckSquare, Calendar, MessageSquare, AlertTriangle, UserPlus, X, Loader2 } from 'lucide-react';
import {
  IconAlert,
  IconMessage,
  IconSettings,
  IconEntreprise,
  PivotLogo,
} from '@/components/pivot-icons';
import { useToast } from '@/components/ui/toast';
import { fetchJson } from '@/lib/apiClient';
import type { Space, BusinessItem } from './PivotShell';

type Props = {
  space: Space;
  pathname: string;
  businessId: string | null;
  businesses: BusinessItem[];
  onToggleMessaging?: () => void;
};

/* ═══ Search types ═══ */

type SearchResultGroup = {
  label: string;
  items: SearchResultItem[];
};

type SearchResultItem = {
  id: string;
  name: string;
  subtitle: string | null;
  href: string;
};

/* ═══ Helpers ═══ */

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const diffDays = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays > 1 && diffDays <= 7) return `Dans ${diffDays}j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

/* ═══ Sub-page labels ═══ */

const PRO_SUB_LABELS: Record<string, string> = {
  projects: 'Projets',
  tasks: 'Mes Tâches',
  clients: 'CRM',
  prospects: 'CRM',
  agenda: 'CRM',
  services: 'Catalogue',
  stock: 'Stock',
  finances: 'Finances',
  settings: 'Paramètres',
  organization: 'Organisation',
  references: 'Références',
  process: 'Processus',
  marketing: 'Marketing',
  invites: 'Invitations',
  calendar: 'Calendrier',
};

const PERSO_SUB_LABELS: Record<string, string> = {
  comptes: 'Comptes',
  transactions: 'Transactions',
  budgets: 'Budgets',
  subscriptions: 'Abonnements',
  epargne: 'Épargne',
  calendar: 'Calendrier',
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

  const mobileTitle = (() => {
    if (proSubPage) return proSubPage.label;
    if (persoSubPage) return persoSubPage.label;
    if (focusSubPage) return focusSubPage.label;
    if (inBusiness && currentBiz) return currentBiz.name;
    if (space === 'perso') return 'Wallet';
    if (space === 'focus') return 'Focus';
    return 'Accueil';
  })();

  return (
    <header className="shrink-0 sticky top-0 z-[55]" style={{ background: 'var(--shell-topbar-bg)', minHeight: 56 }}>
      {/* Desktop header */}
      <div
        className="hidden md:grid items-center"
        style={{ gridTemplateColumns: '1fr auto 1fr', padding: '12px 24px', gap: 16, minHeight: 56 }}
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

        {/* Center: Search */}
        <SearchBar businessId={businessId} onComingSoon={handleComingSoon} />

        {/* Right: Actions */}
        <div className="flex items-center gap-2 justify-end">
          <NotificationsDropdown onToggleMessaging={onToggleMessaging} />
          <NavIconBtn onClick={inBusiness ? onToggleMessaging : handleComingSoon}><IconMessage size={20} color="var(--shell-topbar-text)" /></NavIconBtn>
          <Link href={inBusiness ? `/app/pro/${businessId}/settings` : '/app/account'}>
            <NavIconBtn><IconSettings size={20} color="var(--shell-topbar-text)" /></NavIconBtn>
          </Link>
          {inBusiness && businesses.length > 0 && (
            <BusinessSwitcher businesses={businesses} currentId={businessId} />
          )}
        </div>
      </div>

      {/* Mobile header */}
      <div className="flex md:hidden items-center justify-between px-3 gap-2" style={{ height: 56 }}>
        <div className="flex items-center gap-2.5 min-w-0 shrink">
          <PivotLogo size={28} color="var(--shell-topbar-text)" />
          <span
            className="text-sm font-semibold truncate"
            style={{
              color: 'var(--shell-topbar-text)',
              fontFamily: 'var(--font-barlow), sans-serif',
            }}
          >
            {mobileTitle}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <NotificationsDropdown onToggleMessaging={onToggleMessaging} />
          {inBusiness && (
            <NavIconBtn onClick={onToggleMessaging}><IconMessage size={20} color="var(--shell-topbar-text)" /></NavIconBtn>
          )}
          {inBusiness && businesses.length > 0 && (
            <BusinessSwitcher businesses={businesses} currentId={businessId} />
          )}
          {!inBusiness && (
            <Link href="/app/account">
              <NavIconBtn><IconSettings size={18} color="var(--shell-topbar-text)" /></NavIconBtn>
            </Link>
          )}
        </div>
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

/* ═══ Notifications Dropdown ═══ */

type NotifItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  businessId: string | null;
  taskId: string | null;
  projectId: string | null;
  conversationId: string | null;
  isRead: boolean;
  createdAt: string;
};

function NotificationsDropdown({ onToggleMessaging }: { onToggleMessaging?: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Poll unread count every 60s (cross-business)
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetchJson<{ items: unknown[]; unreadCount: number }>(
          '/api/personal/notifications?limit=0'
        );
        if (res.ok && res.data) setUnreadCount(res.data.unreadCount);
      } catch { /* silent */ }
    }
    void poll();
    const interval = setInterval(() => void poll(), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Load full list when opened
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const res = await fetchJson<{ items: NotifItem[]; unreadCount: number }>(
          '/api/personal/notifications?limit=30', {}, controller.signal
        );
        if (controller.signal.aborted) return;
        if (res.ok && res.data) {
          setItems(res.data.items);
          setUnreadCount(res.data.unreadCount);
        }
      } catch {
        if (!controller.signal.aborted) setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [open]);

  const markAllRead = useCallback(async () => {
    try {
      await fetchJson('/api/personal/notifications/read-all', { method: 'POST' });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }, []);

  const markRead = useCallback(async (notifId: string) => {
    try {
      await fetchJson(`/api/personal/notifications/${notifId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      setItems((prev) => prev.map((n) => n.id === notifId ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }, []);

  const NOTIF_ICONS: Record<string, 'task' | 'interaction' | 'message' | 'project' | 'invite'> = {
    TASK_ASSIGNED: 'task',
    TASK_STATUS_CHANGED: 'task',
    TASK_DUE_SOON: 'task',
    TASK_BLOCKED: 'interaction',
    MESSAGE_RECEIVED: 'message',
    PROJECT_OVERDUE: 'project',
    BUSINESS_INVITE: 'invite',
  };

  return (
    <div className="relative">
      <NavIconBtn onClick={() => setOpen((v) => !v)}>
        <IconAlert size={20} color="var(--shell-topbar-text)" showDot={unreadCount > 0} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </NavIconBtn>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed left-4 right-4 top-[62px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 rounded-xl z-50 overflow-hidden sm:w-[360px]"
            style={{
              maxHeight: 420,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Notifications
              </span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs font-medium transition-colors hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Tout marquer lu
                </button>
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  Aucune nouvelle
                </span>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-faint)' }} />
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Aucune notification</p>
                </div>
              ) : (
                items.map((notif) => {
                  const iconType = NOTIF_ICONS[notif.type] ?? 'task';
                  const href = notif.type === 'BUSINESS_INVITE'
                    ? '/app'
                    : notif.projectId && notif.businessId
                      ? `/app/pro/${notif.businessId}/projects/${notif.projectId}`
                      : notif.taskId && notif.businessId
                        ? `/app/pro/${notif.businessId}/tasks`
                        : null;

                  const inner = (
                    <div className="flex items-start gap-3">
                      {/* Unread dot */}
                      <div className="shrink-0 pt-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: notif.isRead ? 'transparent' : 'var(--accent)' }}
                        />
                      </div>
                      <div
                        className="shrink-0 flex items-center justify-center rounded-full mt-0.5"
                        style={{
                          width: 28,
                          height: 28,
                          background:
                            iconType === 'task' || iconType === 'message' || iconType === 'invite'
                              ? 'var(--shell-accent)'
                              : 'var(--danger-bg)',
                        }}
                      >
                        {iconType === 'task' ? (
                          <CheckSquare size={14} style={{ color: 'white' }} />
                        ) : iconType === 'message' ? (
                          <MessageSquare size={14} style={{ color: 'white' }} />
                        ) : iconType === 'invite' ? (
                          <UserPlus size={14} style={{ color: 'white' }} />
                        ) : iconType === 'project' ? (
                          <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
                        ) : (
                          <Calendar size={14} style={{ color: 'var(--danger)' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text)', fontWeight: notif.isRead ? 400 : 600 }}>{notif.title}</p>
                        {notif.body && (
                          <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{notif.body}</p>
                        )}
                      </div>
                      <span className="text-[10px] shrink-0 mt-1" style={{ color: 'var(--text-faint)' }}>
                        {formatRelativeDate(notif.createdAt)}
                      </span>
                    </div>
                  );

                  const handleClick = () => {
                    if (!notif.isRead) void markRead(notif.id);
                    setOpen(false);
                    if (notif.type === 'MESSAGE_RECEIVED' && onToggleMessaging) {
                      onToggleMessaging();
                    }
                  };

                  return href ? (
                    <Link
                      key={notif.id}
                      href={href}
                      onClick={handleClick}
                      className="block px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={handleClick}
                      className="block w-full px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      {inner}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
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
        className="flex items-center gap-1.5 rounded-lg transition-colors"
        style={{ background: 'var(--shell-sidebar-bg)', padding: '5px 8px' }}
      >
        <div className="flex items-center justify-center rounded shrink-0" style={{ width: 24, height: 24, background: 'var(--surface)' }}>
          <IconEntreprise size={14} color="var(--shell-sidebar-bg)" />
        </div>
        {current && (
          <span className="text-xs font-medium max-w-[80px] sm:max-w-[120px] truncate" style={{ color: 'var(--shell-sidebar-text)' }}>
            {current.name}
          </span>
        )}
        <ChevronDown size={10} style={{ color: 'var(--shell-sidebar-text)' }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 rounded-xl z-50 min-w-[220px] overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
          >
            {/* Business list */}
            <div className="py-1">
              {businesses.map((b) => (
                <Link
                  key={b.id}
                  href={`/app/pro/${b.id}`}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-hover)]"
                  style={{
                    color: b.id === currentId ? 'var(--shell-accent)' : 'var(--text)',
                    fontWeight: b.id === currentId ? 600 : 400,
                  }}
                  onClick={() => setOpen(false)}
                >
                  <div
                    className="shrink-0 flex items-center justify-center rounded"
                    style={{
                      width: 22, height: 22,
                      background: b.id === currentId ? 'var(--shell-accent)' : 'var(--surface-2)',
                    }}
                  >
                    <IconEntreprise size={12} color={b.id === currentId ? 'white' : 'var(--text-faint)'} />
                  </div>
                  <span className="truncate">{b.name}</span>
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Actions */}
            <div className="py-1">
              <Link
                href="/app/pro/new"
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text)' }}
                onClick={() => setOpen(false)}
              >
                <div className="shrink-0 flex items-center justify-center rounded" style={{ width: 22, height: 22, background: 'var(--surface-2)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-faint)' }}>+</span>
                </div>
                Creer ou rejoindre
              </Link>
              {currentId && (
                <Link
                  href={`/app/pro/${currentId}/settings`}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text)' }}
                  onClick={() => setOpen(false)}
                >
                  <div className="shrink-0 flex items-center justify-center rounded" style={{ width: 22, height: 22, background: 'var(--surface-2)' }}>
                    <IconSettings size={12} color="var(--text-faint)" />
                  </div>
                  Parametres
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══ Search Bar ═══ */

function SearchBar({ businessId, onComingSoon }: { businessId: string | null; onComingSoon: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (businessId) setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
        setResults([]);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [businessId, open]);

  // Auto-focus input
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!businessId || !q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      const base = `/api/pro/businesses/${businessId}`;
      const encoded = encodeURIComponent(q.trim());

      try {
        const [projectsRes, clientsRes, prospectsRes] = await Promise.all([
          fetchJson<{ items?: Array<{ id: string | bigint; name: string; clientName?: string | null }> }>(
            `${base}/projects?q=${encoded}&scope=ALL`,
            {},
            controller.signal
          ),
          fetchJson<{ items?: Array<{ id: string | bigint; name: string; company?: string | null }> }>(
            `${base}/clients?q=${encoded}`,
            {},
            controller.signal
          ),
          fetchJson<{ items?: Array<{ id: string | bigint; name: string; contactName?: string | null }> }>(
            `${base}/prospects?q=${encoded}`,
            {},
            controller.signal
          ),
        ]);

        if (controller.signal.aborted) return;

        const groups: SearchResultGroup[] = [];

        if (projectsRes.ok && projectsRes.data?.items?.length) {
          groups.push({
            label: 'Projets',
            items: projectsRes.data.items.slice(0, 5).map((p) => ({
              id: String(p.id),
              name: p.name || 'Sans nom',
              subtitle: p.clientName ?? null,
              href: `/app/pro/${businessId}/projects/${p.id}`,
            })),
          });
        }

        if (clientsRes.ok && clientsRes.data?.items?.length) {
          groups.push({
            label: 'Clients',
            items: clientsRes.data.items.slice(0, 5).map((c) => ({
              id: String(c.id),
              name: c.name || 'Sans nom',
              subtitle: c.company ?? null,
              href: `/app/pro/${businessId}/clients/${c.id}`,
            })),
          });
        }

        if (prospectsRes.ok && prospectsRes.data?.items?.length) {
          groups.push({
            label: 'Prospects',
            items: prospectsRes.data.items.slice(0, 5).map((p) => ({
              id: String(p.id),
              name: p.name || 'Sans nom',
              subtitle: p.contactName ?? null,
              href: `/app/pro/${businessId}/prospects/${p.id}`,
            })),
          });
        }

        setResults(groups);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [businessId]
  );

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => void doSearch(value), 300);
  }

  function close() {
    setOpen(false);
    setQuery('');
    setResults([]);
    abortRef.current?.abort();
  }

  // Static button when no business context
  if (!businessId) {
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
        <span className="flex-1 text-left text-white/70 text-sm">Recherche</span>
      </button>
    );
  }

  return (
    <div className="relative hidden lg:block" style={{ width: 320, maxWidth: '100%' }}>
      {/* Input or trigger button */}
      {open ? (
        <div
          className="flex items-center gap-2 rounded-full overflow-hidden"
          style={{ background: 'var(--surface)', padding: '6px 12px 6px 6px', border: '1.5px solid var(--shell-accent)' }}
        >
          <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: 'var(--shell-accent)' }}>
            <Search size={13} style={{ color: 'white' }} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Rechercher..."
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: 'var(--text)' }}
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); }} className="hover:opacity-70">
              <X size={14} style={{ color: 'var(--text-faint)' }} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 rounded-full overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: 'var(--shell-accent)', padding: '6px 12px 6px 6px' }}
        >
          <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: 'rgba(255,255,255,0.25)' }}>
            <Search size={13} style={{ color: 'white' }} />
          </div>
          <span className="flex-1 text-left text-white/70 text-sm">Recherche</span>
          <kbd className="text-[10px] text-white/40 font-mono px-1.5 py-0.5 rounded border border-white/20">⌘K</kbd>
        </button>
      )}

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40" onClick={close} />}

      {/* Results dropdown */}
      {open && query.trim() && (
        <div
          className="absolute left-0 right-0 top-full mt-2 rounded-xl z-50 overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            maxHeight: 400,
          }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-faint)' }} />
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
                  Aucun résultat pour « {query} »
                </p>
              </div>
            ) : (
              results.map((group) => (
                <div key={group.label}>
                  <div className="px-4 py-2" style={{ background: 'var(--surface-2)' }}>
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={close}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{item.name}</p>
                        {item.subtitle && (
                          <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{item.subtitle}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Nav Icon Button ═══ */

function NavIconBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center justify-center rounded-full hover:opacity-80 transition-opacity"
      style={{ width: 40, height: 40, background: 'var(--surface)' }}
    >
      {children}
    </button>
  );
}
