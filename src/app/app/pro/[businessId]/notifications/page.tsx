'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckSquare, AlertOctagon, MessageSquare, UserPlus,
  AlertTriangle, Calendar, Users, UserSearch, FileText, Receipt, Bell,
} from 'lucide-react';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';

type NotifItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  businessId: string | null;
  taskId: string | null;
  projectId: string | null;
  conversationId: string | null;
  clientId: string | null;
  prospectId: string | null;
  calendarEventId: string | null;
  isRead: boolean;
  createdAt: string;
};

const FILTER_TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'unread', label: 'Non lues' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'clients', label: 'Clients' },
  { key: 'documents', label: 'Documents' },
  { key: 'billing', label: 'Facturation' },
] as const;

const FILTER_TYPE_MAP: Record<string, string> = {
  tasks: 'TASK_ASSIGNED,TASK_STATUS_CHANGED,TASK_DUE_SOON,TASK_BLOCKED,TASK_OVERDUE',
  clients: 'CLIENT_FOLLOWUP,PROSPECT_FOLLOWUP,INTERACTION_ADDED',
  documents: 'DOCUMENT_UPLOADED',
  billing: 'INVOICE_CREATED,QUOTE_CREATED',
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'À l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Hier';
  if (diffD < 7) return `Il y a ${diffD}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

function NotifIcon({ type }: { type: string }) {
  const iconProps = { size: 14, style: { color: 'white' } as React.CSSProperties };
  const dangerProps = { size: 14, style: { color: 'var(--danger)' } as React.CSSProperties };

  const isDanger = type === 'PROJECT_OVERDUE' || type === 'TASK_BLOCKED';
  const bgColor = isDanger ? 'var(--danger-bg)' : 'var(--shell-accent)';
  const props = isDanger ? dangerProps : iconProps;

  let icon;
  switch (type) {
    case 'TASK_ASSIGNED':
    case 'TASK_STATUS_CHANGED':
    case 'TASK_DUE_SOON':
    case 'TASK_OVERDUE':
      icon = <CheckSquare {...iconProps} />; break;
    case 'TASK_BLOCKED':
      icon = <AlertOctagon {...props} />; break;
    case 'MESSAGE_RECEIVED':
      icon = <MessageSquare {...iconProps} />; break;
    case 'BUSINESS_INVITE':
      icon = <UserPlus {...iconProps} />; break;
    case 'PROJECT_OVERDUE':
      icon = <AlertTriangle {...props} />; break;
    case 'CALENDAR_REMINDER':
      icon = <Calendar {...iconProps} />; break;
    case 'CLIENT_FOLLOWUP':
    case 'INTERACTION_ADDED':
      icon = <Users {...iconProps} />; break;
    case 'PROSPECT_FOLLOWUP':
      icon = <UserSearch {...iconProps} />; break;
    case 'DOCUMENT_UPLOADED':
      icon = <FileText {...iconProps} />; break;
    case 'INVOICE_CREATED':
    case 'QUOTE_CREATED':
      icon = <Receipt {...iconProps} />; break;
    default:
      icon = <Bell {...iconProps} />;
  }

  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-full"
      style={{ width: 32, height: 32, background: bgColor }}
    >
      {icon}
    </div>
  );
}

function getNotifHref(notif: NotifItem): string | null {
  const biz = notif.businessId;
  if (!biz) return null;
  if (notif.type === 'BUSINESS_INVITE') return '/app/pro';
  if (notif.type === 'DOCUMENT_UPLOADED' && notif.projectId) return `/app/pro/${biz}/projects/${notif.projectId}?tab=files`;
  if ((notif.type === 'INVOICE_CREATED' || notif.type === 'QUOTE_CREATED') && notif.projectId) return `/app/pro/${biz}/projects/${notif.projectId}?tab=billing`;
  if (notif.type === 'INTERACTION_ADDED' && notif.clientId) return `/app/pro/${biz}/clients/${notif.clientId}`;
  if (notif.type === 'INTERACTION_ADDED' && notif.prospectId) return `/app/pro/${biz}/prospects/${notif.prospectId}`;
  if (notif.conversationId) return `/app/pro/${biz}/tasks`;
  if (notif.clientId) return `/app/pro/${biz}/clients/${notif.clientId}`;
  if (notif.prospectId) return `/app/pro/${biz}/prospects/${notif.prospectId}`;
  if (notif.calendarEventId) return `/app/pro/${biz}/calendar`;
  if (notif.projectId) return `/app/pro/${biz}/projects/${notif.projectId}`;
  if (notif.taskId) return `/app/pro/${biz}/tasks`;
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function NotificationsPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  /* ---- Fetch ---- */

  const loadNotifs = useCallback(async (cursor?: string | null) => {
    if (!businessId) return;
    const isLoadMore = !!cursor;
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const qs = new URLSearchParams();
      qs.set('limit', '30');
      if (filter === 'unread') qs.set('unreadOnly', 'true');
      const typeFilter = FILTER_TYPE_MAP[filter];
      if (typeFilter) qs.set('type', typeFilter);
      if (cursor) qs.set('cursor', cursor);

      const res = await fetchJson<{ items: NotifItem[]; unreadCount: number; nextCursor: string | null }>(
        `/api/pro/businesses/${businessId}/notifications?${qs.toString()}`,
      );
      if (res.ok && res.data) {
        if (isLoadMore) {
          setItems((prev) => [...prev, ...res.data!.items]);
        } else {
          setItems(res.data.items);
        }
        setUnreadCount(res.data.unreadCount);
        setNextCursor(res.data.nextCursor);
        setError(null);
      } else {
        setError(res.error ?? 'Impossible de charger les notifications.');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [businessId, filter]);

  useEffect(() => { void loadNotifs(); }, [loadNotifs]);

  /* ---- Actions ---- */

  async function markRead(notifId: string) {
    await fetchJson(`/api/pro/businesses/${businessId}/notifications/${notifId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    });
    setItems((prev) => prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetchJson(`/api/pro/businesses/${businessId}/notifications/read-all`, { method: 'POST' });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    toast.success('Toutes les notifications marquées comme lues.');
  }

  function handleNotifClick(notif: NotifItem) {
    if (!notif.isRead) void markRead(notif.id);
    const href = getNotifHref(notif);
    if (href) router.push(href);
  }

  /* ---- Render ---- */

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Activité récente de votre entreprise.'}
      actions={
        unreadCount > 0 ? (
          <Button variant="outline" onClick={() => void markAllRead()}>
            Tout marquer lu
          </Button>
        ) : null
      }
      tabs={FILTER_TABS}
      activeTab={filter}
      onTabChange={setFilter}
    >
      {/* Notification list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 space-y-2">
              <Skeleton width="60%" height="14px" />
              <Skeleton width="40%" height="12px" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void loadNotifs()}>Réessayer</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <Bell size={40} style={{ color: 'var(--text-faint)', margin: '0 auto 12px' }} />
          <p className="text-sm text-[var(--text-secondary)]">Aucune notification.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((notif) => (
            <button
              key={notif.id}
              type="button"
              onClick={() => handleNotifClick(notif)}
              className="flex w-full items-start gap-3 rounded-xl border border-[var(--border)] p-4 text-left transition-colors hover:bg-[var(--surface-hover)]"
              style={{
                background: notif.isRead ? 'var(--surface)/70' : 'var(--surface)',
                opacity: notif.isRead ? 0.7 : 1,
              }}
            >
              <div className="shrink-0 pt-0.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: notif.isRead ? 'transparent' : 'var(--accent)' }}
                />
              </div>
              <NotifIcon type={notif.type} />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm truncate"
                  style={{ fontWeight: notif.isRead ? 400 : 600, color: 'var(--text-primary)' }}
                >
                  {notif.title}
                </p>
                {notif.body ? (
                  <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{notif.body}</p>
                ) : null}
              </div>
              <span className="text-[10px] shrink-0 mt-1 text-[var(--text-faint)]">
                {formatRelativeDate(notif.createdAt)}
              </span>
            </button>
          ))}

          {nextCursor ? (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadNotifs(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Chargement…' : 'Charger plus'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </ProPageShell>
  );
}
