import { Card } from '@/components/ui/card';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';

type RiskTask = {
  id: string;
  title: string;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

export function RisksBlock({ overdueTasks, businessId }: { overdueTasks: RiskTask[]; businessId: string }) {
  if (!overdueTasks.length) {
    return (
      <GuidedCtaCard
        title="Aucun retard détecté."
        description="Suivez vos tâches pour anticiper les risques."
        primary={{ label: 'Créer des tâches', href: `/app/pro/${businessId}/tasks` }}
      />
    );
  }

  return (
    <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Risques & délais</p>
        <p className="text-xs text-[var(--text-secondary)]">{overdueTasks.length} tâche(s) en retard</p>
      </div>
      <div className="space-y-2 text-sm text-[var(--text-secondary)]">
        {overdueTasks.slice(0, 3).map((task) => (
          <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-2)]/70 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[var(--text-primary)] font-medium">{task.title}</p>
              <p className="text-[11px]">{task.assigneeName || task.assigneeEmail || 'Non assigné'}</p>
            </div>
            <p className="text-[11px] text-rose-500">{formatDate(task.dueDate)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
