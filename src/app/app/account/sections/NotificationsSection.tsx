'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fetchJson } from '@/lib/apiClient';

type BusinessItem = { id: string; name: string };
type MembershipItem = { business: { id: string; name: string }; role: string };

export function NotificationsSection() {
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const res = await fetchJson<{ items: MembershipItem[] }>('/api/pro/businesses', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok && res.data) {
        setBusinesses(
          (res.data.items ?? []).map((m) => ({ id: String(m.business.id), name: m.business.name }))
        );
      }
    })();
    return () => ctrl.abort();
  }, []);

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Notifications</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Les préférences de notifications sont configurables par business. Activez ou désactivez chaque type de notification
          (tâches, messages, échéances, projets en retard).
        </p>
      </div>

      {businesses.length > 0 ? (
        <div className="space-y-2">
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/app/pro/${b.id}/settings?section=notifications`}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]"
            >
              <div className="flex items-center gap-3">
                <Bell size={16} className="text-[var(--text-secondary)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">{b.name}</span>
              </div>
              <ChevronRight size={16} className="text-[var(--text-secondary)]" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">
          Aucun espace PRO. Créez ou rejoignez un business pour configurer vos notifications.
        </p>
      )}
    </Card>
  );
}
