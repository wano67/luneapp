// src/app/app/pro/[businessId]/references/numbering/page.tsx
'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatDate,
  getMockNumbering,
  type NumberingSetting,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

export default function NumberingPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [settings, setSettings] = usePersistentState<NumberingSetting[]>(
    `refs-numbering:${businessId}`,
    getMockNumbering()
  );
  const [drafts, setDrafts] = useState<NumberingSetting[]>(settings);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(settings);
  }, [settings]);

  const lastUpdate = useMemo(() => {
    const sorted = [...settings].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return sorted[0]?.updatedAt ?? null;
  }, [settings]);

  function onChange(
    id: string,
    field: keyof Pick<NumberingSetting, 'prefix' | 'suffix' | 'nextNumber' | 'pad'>,
    e: ChangeEvent<HTMLInputElement>
  ) {
    const value = field === 'nextNumber' || field === 'pad' ? Number(e.target.value) : e.target.value;
    setDrafts((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: value } : n))
    );
    setInfo(null);
  }

  function save() {
    const now = new Date().toISOString();
    const updated = drafts.map((d) => ({ ...d, updatedAt: now, updatedBy: 'toi' }));
    setSettings(updated);
    setInfo('Numérotation sauvegardée.');
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · References · Numbering
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Numérotation</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Configurer les préfixes et compteurs des documents pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
          <p>Audit : {lastUpdate ? formatDate(lastUpdate) : '—'}</p>
          {info ? <span className="text-emerald-500">{info}</span> : null}
        </div>

        <div className="space-y-3">
          {drafts.map((setting) => (
            <Card key={setting.id} className="grid gap-3 border border-[var(--border)] bg-[var(--surface)]/60 p-3 md:grid-cols-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{setting.docType}</p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  Mis à jour {formatDate(setting.updatedAt)} par {setting.updatedBy}
                </p>
              </div>
              <Input
                label="Prefix"
                value={setting.prefix}
                onChange={(e) => onChange(setting.id, 'prefix', e)}
              />
              <Input
                label="Suffix"
                value={setting.suffix ?? ''}
                onChange={(e) => onChange(setting.id, 'suffix', e)}
              />
              <Input
                label="Prochain numéro"
                type="number"
                value={setting.nextNumber}
                onChange={(e) => onChange(setting.id, 'nextNumber', e)}
              />
              <Input
                label="Padding"
                type="number"
                value={setting.pad}
                onChange={(e) => onChange(setting.id, 'pad', e)}
              />
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Badge variant="neutral">Business #{businessId}</Badge>
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </Card>
    </div>
  );
}
