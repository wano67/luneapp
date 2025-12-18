// src/app/app/pro/[businessId]/settings/permissions/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  defaultPermissions,
  formatDate,
  type PermissionRow,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

const RIGHTS = [
  { value: 'none', label: 'Aucun' },
  { value: 'view', label: 'Lecture' },
  { value: 'edit', label: 'Édition' },
  { value: 'full', label: 'Admin' },
] as const;

export default function BusinessPermissionsSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const [rows, setRows] = usePersistentState<PermissionRow[]>(
    `permissions:${businessId}`,
    defaultPermissions
  );
  const [info, setInfo] = useState<string | null>(null);

  function updateRow(
    role: PermissionRow['role'],
    field: 'finance' | 'admin' | 'references',
    value: PermissionRow['finance']
  ) {
    setInfo(null);
    const next = rows.map((row) =>
      row.role === role
        ? {
            ...row,
            [field]: value,
            updatedAt: new Date().toISOString(),
            updatedBy: 'toi',
          }
        : row
    );
    setRows(next);
    setInfo('Droits mis à jour.');
  }

  const lastUpdate = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return sorted[0]?.updatedAt ?? null;
  }, [rows]);

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

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
          <p>Audit : {lastUpdate ? formatDate(lastUpdate) : '—'}</p>
          {info ? <span className="text-emerald-500">{info}</span> : null}
        </div>
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.role}
              className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="space-y-1">
                <p className="font-semibold text-[var(--text-primary)]">{r.role}</p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  Mis à jour {formatDate(r.updatedAt)} par {r.updatedBy}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Finance</span>
                  <Select
                    value={r.finance}
                    onChange={(e) =>
                      updateRow(r.role, 'finance', e.target.value as PermissionRow['finance'])
                    }
                  >
                    {RIGHTS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Admin</span>
                  <Select
                    value={r.admin}
                    onChange={(e) =>
                      updateRow(r.role, 'admin', e.target.value as PermissionRow['finance'])
                    }
                  >
                    {RIGHTS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Référentiels</span>
                  <Select
                    value={r.references}
                    onChange={(e) =>
                      updateRow(r.role, 'references', e.target.value as PermissionRow['finance'])
                    }
                  >
                    {RIGHTS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="neutral">Business #{businessId}</Badge>
          <Button size="sm" variant="outline" disabled>
            Exporter ACL (bientôt)
          </Button>
        </div>
      </Card>
    </div>
  );
}
