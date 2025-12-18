// src/app/app/pro/[businessId]/references/automations/page.tsx
'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getMockAutomations,
  paginate,
  type AutomationRule,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

export default function AutomationsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [rules, setRules] = usePersistentState<AutomationRule[]>(
    `refs-automations:${businessId}`,
    getMockAutomations()
  );
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AutomationRule['status'] | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    trigger: '',
    action: '',
    config: '',
    status: 'active' as AutomationRule['status'],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = rules;
    if (status !== 'ALL') list = list.filter((r) => r.status === status);
    if (term) {
      list = list.filter(
        (r) =>
          r.trigger.toLowerCase().includes(term) ||
          r.action.toLowerCase().includes(term) ||
          r.config.toLowerCase().includes(term)
      );
    }
    return list;
  }, [rules, search, status]);

  const { pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page]
  );

  const selected = rules.find((r) => r.id === selectedId) ?? null;

  function createAutomation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!form.trigger.trim() || !form.action.trim()) {
      setFormError('Trigger et action requis');
      return;
    }
    const next: AutomationRule = {
      id: `auto-${Date.now()}`,
      trigger: form.trigger.trim(),
      action: form.action.trim(),
      config: form.config || '—',
      status: form.status,
    };
    setRules([...rules, next]);
    setSelectedId(next.id);
    setCreateOpen(false);
    setForm({ trigger: '', action: '', config: '', status: 'active' });
  }

  function toggleStatus(id: string) {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: r.status === 'active' ? 'paused' : 'active' } : r
      )
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · References · Automations
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Automations</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Règles et SOP pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Règles</p>
            <p className="text-xs text-[var(--text-secondary)]">Table + filtres + actions.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Nouvelle règle
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInfo('Export automations simulé.')}
            >
              Export
            </Button>
            {info ? <span className="text-[10px] text-emerald-500">{info}</span> : null}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <Input
            label="Recherche"
            placeholder="Trigger, action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Statut"
            value={status}
            onChange={(e) => setStatus(e.target.value as AutomationRule['status'] | 'ALL')}
          >
            <option value="ALL">Tous</option>
            <option value="active">Actif</option>
            <option value="paused">En pause</option>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trigger</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Config</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableEmpty>Aucune règle.</TableEmpty>
            ) : (
              pageItems.map((rule) => (
                <TableRow
                  key={rule.id}
                  className={rule.id === selectedId ? 'bg-[var(--surface-2)]' : ''}
                  onClick={() => setSelectedId(rule.id)}
                >
                  <TableCell className="font-semibold text-[var(--text-primary)]">
                    {rule.trigger}
                  </TableCell>
                  <TableCell>{rule.action}</TableCell>
                  <TableCell className="max-w-xs truncate">{rule.config}</TableCell>
                  <TableCell>
                    <Badge
                      variant="neutral"
                      className={rule.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}
                    >
                      {rule.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Page précédente
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Page suivante
            </Button>
          </div>
          <p>
            Page {page}/{totalPages}
          </p>
        </div>
      </Card>

      {selected ? (
        <Card className="space-y-3 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.trigger}</p>
              <p className="text-xs text-[var(--text-secondary)]">{selected.action}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{selected.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => toggleStatus(selected.id)}>
                {selected.status === 'active' ? 'Mettre en pause' : 'Activer'}
              </Button>
            </div>
          </div>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs text-[var(--text-secondary)]">Config</p>
            <p className="text-sm text-[var(--text-primary)]">{selected.config}</p>
            <p className="text-[10px] text-[var(--text-secondary)]">Business #{businessId}</p>
          </Card>
        </Card>
      ) : null}

      <Modal
        open={createOpen}
        onCloseAction={() => setCreateOpen(false)}
        title="Nouvelle automation"
        description="Déclencheurs et actions."
      >
        <form onSubmit={createAutomation} className="space-y-3">
          <Input
            label="Trigger"
            value={form.trigger}
            onChange={(e) => setForm((prev) => ({ ...prev, trigger: e.target.value }))}
            placeholder="Projet créé"
          />
          <Input
            label="Action"
            value={form.action}
            onChange={(e) => setForm((prev) => ({ ...prev, action: e.target.value }))}
            placeholder="Créer tâches, notifier..."
          />
          <Input
            label="Config"
            value={form.config}
            onChange={(e) => setForm((prev) => ({ ...prev, config: e.target.value }))}
            placeholder="Checklist, Slack..."
          />
          <Select
            label="Statut"
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, status: e.target.value as AutomationRule['status'] }))
            }
          >
            <option value="active">Actif</option>
            <option value="paused">En pause</option>
          </Select>
          <div className="flex items-center justify-between">
            {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Créer</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
