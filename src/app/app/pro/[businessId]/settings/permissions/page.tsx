// src/app/app/pro/[businessId]/settings/permissions/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BusinessPermissionsSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const rules = [
    { role: 'OWNER', scope: 'Full access' },
    { role: 'ADMIN', scope: 'Manage + billing' },
    { role: 'MEMBER', scope: 'Opérations' },
    { role: 'VIEWER', scope: 'Lecture seule' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Settings · Permissions
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Permissions</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Contrôle d’accès avancé pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-2">
        {rules.map((r) => (
          <div
            key={r.role}
            className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3"
          >
            <div>
              <p className="font-semibold">{r.role}</p>
              <p className="text-sm text-[var(--text-secondary)]">{r.scope}</p>
            </div>
            <Button size="sm" variant="outline" disabled>
              Éditer (bientôt)
            </Button>
          </div>
        ))}
        <p className="text-xs text-[var(--text-secondary)]">API ACL à venir.</p>
      </Card>
    </div>
  );
}
