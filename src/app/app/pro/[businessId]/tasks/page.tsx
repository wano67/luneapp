// src/app/app/pro/[businessId]/tasks/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TasksStubPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Tâches — stub
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Tâches & production</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Base de tâches liée aux projets pour suivre la charge et les urgences.
        </p>
        {/* TODO: API tasks (GET/POST /api/pro/businesses/{businessId}/tasks) */}
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Liste</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Filtrer par projet, assignee, statut.
        </p>
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Détail</p>
          <Badge variant="neutral">Prévu</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Chaque tâche aura sa fiche.
        </p>
        <Link
          href={`/app/pro/${businessId}/tasks/xyz`}
          className="text-sm font-semibold text-[var(--accent)] underline"
        >
          Voir un exemple →
        </Link>
      </Card>
    </div>
  );
}
