// src/app/app/pro/[businessId]/admin/deadlines/page.tsx
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
  formatDate,
  getMockDeadlines,
  paginate,
  type Deadline,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

type SortKey = 'dueAt' | 'title';

export default function AdminDeadlinesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [deadlines, setDeadlines] = usePersistentState<Deadline[]>(
    `deadlines:${businessId}`,
    getMockDeadlines()
  );
  const [status, setStatus] = useState<Deadline['status'] | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('dueAt');
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    dueAt: '',
    recurrence: '',
    linkedTo: '',
    status: 'open' as Deadline['status'],
    owner: 'Admin',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = deadlines;
    if (status !== 'ALL') list = list.filter((d) => d.status === status);
    if (term) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(term) ||
          d.linkedTo.toLowerCase().includes(term)
      );
    }
    return [...list].sort((a, b) =>
      sort === 'dueAt'
        ? new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
        : a.title.localeCompare(b.title)
    );
  }, [deadlines, search, sort, status]);

  const { pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page]
  );

  const displaySelectedId = selectedId ?? pageItems[0]?.id ?? null;
  const selected = deadlines.find((d) => d.id === displaySelectedId) ?? null;

  function addDeadline(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setInfo(null);
    if (!form.title.trim()) {
      setFormError('Titre requis');
      return;
    }
    if (!form.dueAt) {
      setFormError('Échéance requise');
      return;
    }
    const next: Deadline = {
      id: `dl-${Date.now()}`,
      title: form.title.trim(),
      dueAt: new Date(form.dueAt).toISOString(),
      recurrence: form.recurrence || null,
      linkedTo: form.linkedTo || 'Autre',
      status: form.status,
      owner: form.owner,
    };
    const updated = [...deadlines, next];
    setDeadlines(updated);
    setSelectedId(next.id);
    setInfo('Deadline ajoutée.');
    setCreateOpen(false);
    setForm({ title: '', dueAt: '', recurrence: '', linkedTo: '', status: 'open', owner: 'Admin' });
  }

  function markStatus(next: Deadline['status']) {
    if (!selected) return;
    setDeadlines((prev) =>
      prev.map((d) => (d.id === selected.id ? { ...d, status: next } : d))
    );
    setInfo('Statut mis à jour.');
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Admin · Deadlines
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Deadlines</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Échéances légales et administratives pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Échéances</p>
            <p className="text-xs text-[var(--text-secondary)]">Table + filtres + actions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Ajouter
            </Button>
            <Button size="sm" variant="outline" onClick={() => setInfo('Export échéances simulé.')}>
              Export
            </Button>
            {info ? <span className="text-[10px] text-emerald-500">{info}</span> : null}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <Input
            label="Recherche"
            placeholder="Titre, lien…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Statut"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as Deadline['status'] | 'ALL');
              setPage(1);
            }}
          >
            <option value="ALL">Tous</option>
            <option value="open">Ouvert</option>
            <option value="late">En retard</option>
            <option value="done">Clos</option>
          </Select>
          <Select label="Tri" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="dueAt">Échéance</option>
            <option value="title">Titre</option>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Recurrence</TableHead>
              <TableHead>Lié à</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableEmpty>Aucune échéance.</TableEmpty>
            ) : (
              pageItems.map((deadline) => (
                <TableRow
                  key={deadline.id}
                  className={deadline.id === displaySelectedId ? 'bg-[var(--surface-2)]' : ''}
                  onClick={() => setSelectedId(deadline.id)}
                >
                  <TableCell className="font-semibold text-[var(--text-primary)]">
                    {deadline.title}
                  </TableCell>
                  <TableCell>{formatDate(deadline.dueAt)}</TableCell>
                  <TableCell>{deadline.recurrence ?? 'Aucune'}</TableCell>
                  <TableCell>{deadline.linkedTo}</TableCell>
                  <TableCell>
                    <Badge
                      variant="neutral"
                      className={
                        deadline.status === 'done'
                          ? 'bg-emerald-100 text-emerald-700'
                          : deadline.status === 'late'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                      }
                    >
                      {deadline.status}
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
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.title}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Lié à {selected.linkedTo}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{selected.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => markStatus('done')}>
                Marquer fait
              </Button>
              <Button size="sm" variant="outline" onClick={() => markStatus('late')}>
                Marquer en retard
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Échéance</p>
              <p className="text-sm text-[var(--text-primary)]">{formatDate(selected.dueAt)}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Recurrence {selected.recurrence ?? 'Aucune'}
              </p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Owner</p>
              <p className="text-sm text-[var(--text-primary)]">{selected.owner}</p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Business</p>
              <p className="text-sm text-[var(--text-primary)]">#{businessId}</p>
            </Card>
          </div>
        </Card>
      ) : null}

      <Modal
        open={createOpen}
        onCloseAction={() => setCreateOpen(false)}
        title="Ajouter une échéance"
        description="Suivi des obligations et échéances."
      >
        <form onSubmit={addDeadline} className="space-y-3">
          <Input
            label="Titre"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Échéance"
              type="date"
              value={form.dueAt}
              onChange={(e) => setForm((prev) => ({ ...prev, dueAt: e.target.value }))}
            />
            <Input
              label="Recurrence"
              value={form.recurrence}
              onChange={(e) => setForm((prev) => ({ ...prev, recurrence: e.target.value }))}
              placeholder="Trimestrielle, annuelle..."
            />
          </div>
          <Input
            label="Lié à"
            value={form.linkedTo}
            onChange={(e) => setForm((prev) => ({ ...prev, linkedTo: e.target.value }))}
            placeholder="TVA, assurance, compta..."
          />
          <Select
            label="Statut"
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, status: e.target.value as Deadline['status'] }))
            }
          >
            <option value="open">Ouvert</option>
            <option value="late">En retard</option>
            <option value="done">Clos</option>
          </Select>
          <div className="flex items-center justify-between">
            {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Ajouter</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
