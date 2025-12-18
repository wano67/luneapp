// src/app/app/pro/[businessId]/references/categories/page.tsx
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
  getMockCategories,
  paginate,
  type CategoryRef,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

type Scope = CategoryRef['scope'] | 'ALL';

export default function CategoriesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [categories, setCategories] = usePersistentState<CategoryRef[]>(
    `refs-categories:${businessId}`,
    getMockCategories()
  );
  const [scope, setScope] = useState<Scope>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    scope: 'income' as CategoryRef['scope'],
    parentId: '',
    color: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = categories;
    if (scope !== 'ALL') list = list.filter((c) => c.scope === scope);
    if (term) {
      list = list.filter((c) => c.name.toLowerCase().includes(term));
    }
    return list;
  }, [categories, scope, search]);

  const { pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page]
  );

  const selected = categories.find((c) => c.id === selectedId) ?? null;

  function parentName(id: string | null | undefined) {
    if (!id) return '—';
    return categories.find((c) => c.id === id)?.name ?? '—';
  }

  function createCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Nom requis');
      return;
    }
    const next: CategoryRef = {
      id: `cat-${Date.now()}`,
      name: form.name.trim(),
      scope: form.scope,
      parentId: form.parentId || null,
      color: form.color || null,
    };
    setCategories([...categories, next]);
    setSelectedId(next.id);
    setCreateOpen(false);
    setForm({ name: '', scope: 'income', parentId: '', color: '' });
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · References · Categories
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Catégories</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Organise les revenus/dépenses pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Liste des catégories</p>
            <p className="text-xs text-[var(--text-secondary)]">Table + filtres + actions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Créer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInfo('Export catégories simulé.')}
            >
              Export
            </Button>
            {info ? <span className="text-[10px] text-emerald-500">{info}</span> : null}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <Input
            label="Recherche"
            placeholder="Nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={scope} label="Scope" onChange={(e) => setScope(e.target.value as Scope)}>
            <option value="ALL">Tous</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="task">Task</option>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Parent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableEmpty>Aucune catégorie.</TableEmpty>
            ) : (
              pageItems.map((cat) => (
                <TableRow
                  key={cat.id}
                  className={cat.id === selectedId ? 'bg-[var(--surface-2)]' : ''}
                  onClick={() => setSelectedId(cat.id)}
                >
                  <TableCell className="font-semibold text-[var(--text-primary)]">
                    {cat.name}
                  </TableCell>
                  <TableCell>{cat.scope}</TableCell>
                  <TableCell>{parentName(cat.parentId)}</TableCell>
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
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">Scope {selected.scope}</p>
            </div>
            <Badge variant="neutral">Parent: {parentName(selected.parentId)}</Badge>
          </div>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs text-[var(--text-secondary)]">Business</p>
            <p className="text-sm text-[var(--text-primary)]">#{businessId}</p>
          </Card>
        </Card>
      ) : null}

      <Modal
        open={createOpen}
        onCloseAction={() => setCreateOpen(false)}
        title="Nouvelle catégorie"
        description="Ajoute une catégorie pour classer les opérations."
      >
        <form onSubmit={createCategory} className="space-y-3">
          <Input
            label="Nom"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Select
            label="Scope"
            value={form.scope}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, scope: e.target.value as CategoryRef['scope'] }))
            }
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="task">Task</option>
          </Select>
          <Select
            label="Parent (optionnel)"
            value={form.parentId}
            onChange={(e) => setForm((prev) => ({ ...prev, parentId: e.target.value }))}
          >
            <option value="">—</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
          <Input
            label="Couleur (optionnel)"
            value={form.color}
            onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
            placeholder="#2563eb"
          />
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
