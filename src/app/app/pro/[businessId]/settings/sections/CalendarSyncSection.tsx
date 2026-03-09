'use client';

import { Card } from '@/components/ui/card';
import { CalendarSyncPanel } from '@/components/ui/calendar/CalendarSyncPanel';

export function CalendarSyncSection({ businessId }: { businessId: string }) {
  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Synchronisation calendrier</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Synchronisez vos tâches, rendez-vous et charges récurrentes avec votre app calendrier.
        </p>
      </div>
      <CalendarSyncPanel apiBase={`/api/pro/businesses/${businessId}/calendar/sync`} />
    </Card>
  );
}
