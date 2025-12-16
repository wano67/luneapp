// src/app/app/pro/[businessId]/process/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProcessStubPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Process — stub
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Process & SOP
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Centralise les procédures par service : web, design, SEO, gestion client, administratif.
        </p>
        {/* TODO: API process (GET/POST/PATCH /api/pro/businesses/{businessId}/process) */}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Process</p>
            <Badge variant="neutral">À venir</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Liste des SOP avec owners, fréquence, assets.
          </p>
        </Card>
        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Qualité</p>
            <Badge variant="neutral">À venir</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Contrôles qualité, audits et amélioration continue.
          </p>
        </Card>
      </div>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Détail process</p>
          <Badge variant="neutral">Prévu</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Chaque SOP aura sa page dédiée.
        </p>
        <Link
          href={`/app/pro/${businessId}/process/abc`}
          className="text-sm font-semibold text-[var(--accent)] underline"
        >
          Voir un process type →
        </Link>
      </Card>
    </div>
  );
}
