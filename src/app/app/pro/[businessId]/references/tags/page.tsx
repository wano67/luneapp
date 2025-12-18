// src/app/app/pro/[businessId]/references/tags/page.tsx
'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getMockTags, paginate, type TagRef } from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

export default function TagsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [tags, setTags] = usePersistentState<TagRef[]>(`refs-tags:${businessId}`, getMockTags());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', color: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? tags.filter((tag) => tag.name.toLowerCase().includes(term))
      : tags;
  }, [search, tags]);

  const { pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page]
  );

  const selected = tags.find((t) => t.id === selectedId) ?? null;

  function createTag(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Nom requis');
      return;
    }
    const next: TagRef = {
      id: `tag-${Date.now()}`,
      name: form.name.trim(),
      color: form.color || null,
    };
    setTags([...tags, next]);
    setSelectedId(next.id);
    setCreateOpen(false);
    setForm({ name: '', color: '' });
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · References · Tags
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Tags</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Étiquettes globales pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Liste des tags</p>
            <p className="text-xs text-[var(--text-secondary)]">Table + pagination</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Créer un tag
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInfo('Export tags simulé.')}
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
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Couleur</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableEmpty>Aucun tag.</TableEmpty>
            ) : (
              pageItems.map((tag) => (
                <TableRow
                  key={tag.id}
                  className={tag.id === selectedId ? 'bg-[var(--surface-2)]' : ''}
                  onClick={() => setSelectedId(tag.id)}
                >
                  <TableCell className="font-semibold text-[var(--text-primary)]">
                    {tag.name}
                  </TableCell>
                  <TableCell>
                    {tag.color ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                          aria-hidden
                        />
                        {tag.color}
                      </span>
                    ) : (
                      '—'
                    )}
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
        <Card className="space-y-2 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.name}</p>
            <Badge variant="neutral">Business #{businessId}</Badge>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Couleur {selected.color ?? '—'}
          </p>
        </Card>
      ) : null}

      <Modal
        open={createOpen}
        onCloseAction={() => setCreateOpen(false)}
        title="Nouveau tag"
        description="Organise tes éléments avec des tags."
      >
        <form onSubmit={createTag} className="space-y-3">
          <Input
            label="Nom"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Couleur (optionnel)"
            value={form.color}
            onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
            placeholder="#e11d48"
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
