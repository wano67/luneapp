// src/app/app/pro/[businessId]/tasks/[taskId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function TaskDetailStubPage() {
  const params = useParams();
  const taskId = (params?.taskId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Tâche — stub
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Tâche #{taskId}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Fiche tâche : statut, assignee, échéance, checklist.
        </p>
        {/* TODO: API tasks detail (GET/PATCH /api/pro/businesses/{businessId}/tasks/{taskId}) */}
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Statut & charge</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: statut, priorité, charge estimée/réelle.
        </p>
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Checklist</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: items de checklist, pièces jointes, commentaires.
        </p>
      </Card>

      <Button variant="outline" disabled>
        Actions tâche (désactivé)
      </Button>
    </div>
  );
}
