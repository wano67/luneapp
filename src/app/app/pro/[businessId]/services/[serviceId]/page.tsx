// src/app/app/pro/[businessId]/services/[serviceId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ServiceDetailStubPage() {
  const params = useParams();
  const serviceId = (params?.serviceId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Service — stub
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Service #{serviceId}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Page de détail d’un service : description, prix, livrables, SOP.
        </p>
        {/* TODO: API service détail (GET/PATCH /api/pro/businesses/{businessId}/services/{serviceId}) */}
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Packaging</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Détails prix, options, délais et livrables clés.
        </p>
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Process associé</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Lier SOP, checklists et assets de production.
        </p>
      </Card>

      <Button variant="outline" disabled>
        Actions service (bientôt)
      </Button>
    </div>
  );
}
