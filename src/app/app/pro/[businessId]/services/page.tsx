// src/app/app/pro/[businessId]/services/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ServicesStubPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Services — stub
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Catalogue des services
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Cette page préparera la gestion des offres : packaging, prix, templates de devis.
        </p>
        {/* TODO: créer API services (GET/POST/PATCH /api/pro/businesses/{businessId}/services) */}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Catalogue</p>
            <Badge variant="neutral">À venir</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Liste des offres, tarifs, durées, coûts.
          </p>
        </Card>
        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Process / assets</p>
            <Badge variant="neutral">À venir</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Templates de devis, livrables, SOP par service.
          </p>
        </Card>
      </div>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Détail service</p>
          <Badge variant="neutral">Prévu</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Chaque service aura sa page dédiée. Exemple :
        </p>
        <Link
          href={`/app/pro/${businessId}/services/123`}
          className="text-sm font-semibold text-[var(--accent)] underline"
        >
          Ouvrir un service type →
        </Link>
      </Card>
    </div>
  );
}
