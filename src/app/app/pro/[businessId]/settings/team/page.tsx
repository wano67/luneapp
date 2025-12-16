// src/app/app/pro/[businessId]/settings/team/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BusinessTeamSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const mockMembers = [
    { email: 'admin@example.com', role: 'ADMIN' },
    { email: 'member@example.com', role: 'MEMBER' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Settings · Team
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Équipe</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Gère les membres et rôles pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Membres</p>
          <Button size="sm" variant="outline" disabled>
            Inviter (bientôt)
          </Button>
        </div>
        <div className="space-y-2">
          {mockMembers.map((m) => (
            <div
              key={m.email}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 text-sm"
            >
              <div>
                <p className="font-semibold">{m.email}</p>
                <p className="text-xs text-[var(--text-secondary)]">{m.role}</p>
              </div>
              <Button size="sm" variant="ghost" disabled>
                Modifier
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          API à venir — actions désactivées.
        </p>
      </Card>
    </div>
  );
}
