// src/app/app/pro/[businessId]/settings/integrations/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  defaultIntegrations,
  formatDate,
  type IntegrationSetting,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

export default function BusinessIntegrationsSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const [integrations, setIntegrations] = usePersistentState<IntegrationSetting[]>(
    `integrations:${businessId}`,
    defaultIntegrations
  );
  const [info, setInfo] = useState<string | null>(null);

  function toggle(key: string) {
    setInfo(null);
    setIntegrations((prev) =>
      prev.map((int) =>
        int.key === key
          ? {
              ...int,
              status: int.status === 'connected' ? 'disconnected' : 'connected',
              connectedAt: int.status === 'connected' ? null : new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              updatedBy: 'toi',
            }
          : int
      )
    );
    setInfo('État mis à jour.');
  }

  const lastUpdate = useMemo(() => {
    const sorted = [...integrations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return sorted[0]?.updatedAt ?? null;
  }, [integrations]);

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Settings · Integrations
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Intégrations</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Connecte tes outils pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {integrations.map((it) => (
            <div key={it.name} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4">
              <p className="font-semibold text-[var(--text-primary)]">{it.name}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {it.status === 'connected' ? 'Connecté' : 'Non connecté'}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {it.connectedAt ? `Connecté le ${formatDate(it.connectedAt)}` : 'Jamais connecté'}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => toggle(it.key)}
              >
                {it.status === 'connected' ? 'Déconnecter' : 'Connecter'}
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
          <p>Audit : {lastUpdate ? formatDate(lastUpdate) : '—'}</p>
          {info ? <span className="text-emerald-500">{info}</span> : null}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">API/intégrations à venir (mock persistant local).</p>
      </Card>
    </div>
  );
}
