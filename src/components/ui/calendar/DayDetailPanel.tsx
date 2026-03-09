'use client';

import { X } from 'lucide-react';
import { EVENT_COLORS, EVENT_TYPE_LABELS, type CalendarEvent } from '@/lib/calendar';
import { formatCents } from '@/lib/money';

type DayDetailPanelProps = {
  date: string;
  events: CalendarEvent[];
  open: boolean;
  onClose: () => void;
  businessId?: string;
};

export function DayDetailPanel({ date, events, open, onClose, businessId }: DayDetailPanelProps) {
  if (!open) return null;

  const formatted = (() => {
    try {
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return date;
    }
  })();

  // Group events by type
  const grouped = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const list = grouped.get(ev.type) ?? [];
    list.push(ev);
    grouped.set(ev.type, list);
  }

  return (
    <>
      {/* Backdrop (mobile) */}
      <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed md:sticky md:top-0 bottom-0 left-0 right-0 md:left-auto md:right-auto md:bottom-auto z-50 md:z-auto
                   md:w-[340px] md:shrink-0 md:rounded-xl overflow-hidden
                   rounded-t-2xl md:rounded-b-xl"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          maxHeight: 'min(80vh, 520px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-semibold capitalize" style={{ color: 'var(--text)' }}>{formatted}</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {events.length} événement{events.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
            style={{ width: 28, height: 28, background: 'var(--surface-2)' }}
          >
            <X size={14} style={{ color: 'var(--text-faint)' }} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-3 space-y-4" style={{ maxHeight: 'calc(min(80vh, 520px) - 56px)' }}>
          {events.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-faint)' }}>
              Aucun événement ce jour
            </p>
          ) : (
            Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type} className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                  {EVENT_TYPE_LABELS[type as keyof typeof EVENT_TYPE_LABELS] ?? type}
                </p>
                {items.map((ev) => (
                  <EventCard key={ev.id} event={ev} businessId={businessId} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function EventCard({ event, businessId }: { event: CalendarEvent; businessId?: string }) {
  const colors = EVENT_COLORS[event.type];
  const meta = event.meta ?? {};

  // Build link if available
  const href = (() => {
    if (event.type === 'task' && businessId) {
      return meta.projectId
        ? `/app/pro/${businessId}/projects/${meta.projectId}`
        : `/app/pro/${businessId}/tasks`;
    }
    if (event.type === 'subscription') return '/app/personal/subscriptions';
    if (event.type === 'savings') return '/app/personal/epargne';
    return null;
  })();

  const content = (
    <div className="flex items-start gap-2.5">
      <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5" style={{ background: colors.text }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{event.title}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          {meta.projectName ? (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{String(meta.projectName)}</span>
          ) : null}
          {meta.assigneeName ? (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{String(meta.assigneeName)}</span>
          ) : null}
          {meta.clientName ? (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{String(meta.clientName)}</span>
          ) : null}
          {meta.interactionType ? (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{String(meta.interactionType)}</span>
          ) : null}
          {meta.status ? (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{String(meta.status)}</span>
          ) : null}
          {meta.categoryName ? (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{String(meta.categoryName)}</span>
          ) : null}
          {meta.category && !meta.categoryName ? (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{String(meta.category)}</span>
          ) : null}
          {meta.amountCents ? (
            <span className="text-xs font-medium" style={{ color: colors.text }}>
              {formatCents(Number(meta.amountCents))}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--surface-hover)]"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className="rounded-lg px-2.5 py-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {content}
    </div>
  );
}
