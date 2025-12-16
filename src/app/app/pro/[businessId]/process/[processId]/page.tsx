// src/app/app/pro/[businessId]/process/[processId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProcessDetailStubPage() {
  const params = useParams();
  const processId = (params?.processId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Process — stub
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Process #{processId}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Détail d’un SOP : étapes, responsables, assets.
        </p>
        {/* TODO: API process detail (GET/PATCH /api/pro/businesses/{businessId}/process/{processId}) */}
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Étapes</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: séquencer les étapes, inputs/outputs et responsables.
        </p>
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Documents</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: lier les assets (templates, checklists).
        </p>
      </Card>
    </div>
  );
}
