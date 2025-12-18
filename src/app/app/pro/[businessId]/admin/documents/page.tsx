// src/app/app/pro/[businessId]/admin/documents/page.tsx
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
  getMockDocuments,
  paginate,
  type AdminDocument,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

type SortKey = 'title' | 'expiresAt';

export default function AdminDocumentsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [docs, setDocs] = usePersistentState<AdminDocument[]>(
    `admin-docs:${businessId}`,
    getMockDocuments()
  );
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminDocument['status'] | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortKey>('title');
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: '',
    status: 'valid' as AdminDocument['status'],
    expiresAt: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = docs;
    if (status !== 'ALL') list = list.filter((d) => d.status === status);
    if (term) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(term) ||
          d.category.toLowerCase().includes(term)
      );
    }
    return [...list].sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : new Date(a.expiresAt ?? '').getTime() - new Date(b.expiresAt ?? '').getTime()
    );
  }, [docs, search, sort, status]);

  const { pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page]
  );

  const displaySelectedId = selectedId ?? pageItems[0]?.id ?? null;
  const selected = docs.find((d) => d.id === displaySelectedId) ?? null;

  function addDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setInfo(null);
    if (!form.title.trim()) {
      setFormError('Titre requis');
      return;
    }
    if (!form.category.trim()) {
      setFormError('Catégorie requise');
      return;
    }
    const next: AdminDocument = {
      id: `doc-${Date.now()}`,
      title: form.title.trim(),
      category: form.category.trim(),
      status: form.status,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      owner: 'Admin',
      fileUrl: '#',
      updatedAt: new Date().toISOString(),
    };
    const updated = [...docs, next];
    setDocs(updated);
    setSelectedId(next.id);
    setInfo('Document ajouté.');
    setCreateOpen(false);
    setForm({ title: '', category: '', status: 'valid', expiresAt: '' });
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Admin · Documents
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Documents</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Centralise les documents légaux et administratifs de Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Dossiers</p>
            <p className="text-xs text-[var(--text-secondary)]">Table + filtres + actions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Importer / Ajouter
            </Button>
            <Button size="sm" variant="outline" onClick={() => setInfo('Export documents simulé.')}>
              Export
            </Button>
            {info ? <span className="text-[10px] text-emerald-500">{info}</span> : null}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <Input
            label="Recherche"
            placeholder="Titre, catégorie…"
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
              setStatus(e.target.value as AdminDocument['status'] | 'ALL');
              setPage(1);
            }}
          >
            <option value="ALL">Tous</option>
            <option value="valid">Valide</option>
            <option value="expiring">Expire bientôt</option>
            <option value="expired">Expiré</option>
          </Select>
          <Select label="Tri" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="title">Titre</option>
            <option value="expiresAt">Échéance</option>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableEmpty>Aucun document.</TableEmpty>
            ) : (
              pageItems.map((doc) => (
                <TableRow
                  key={doc.id}
                  className={doc.id === displaySelectedId ? 'bg-[var(--surface-2)]' : ''}
                  onClick={() => setSelectedId(doc.id)}
                >
                  <TableCell className="font-semibold text-[var(--text-primary)]">
                    {doc.title}
                  </TableCell>
                  <TableCell>{doc.category}</TableCell>
                  <TableCell>{doc.expiresAt ? formatDate(doc.expiresAt) : '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="neutral"
                      className={
                        doc.status === 'expired'
                          ? 'bg-rose-100 text-rose-700'
                          : doc.status === 'expiring'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }
                    >
                      {doc.status}
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
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {selected.title}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">{selected.category}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{selected.status}</Badge>
              <Button size="sm" variant="outline">
                Ouvrir
              </Button>
              <Button size="sm" variant="outline">
                Remplacer
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Échéance</p>
              <p className="text-sm text-[var(--text-primary)]">
                {selected.expiresAt ? formatDate(selected.expiresAt) : 'Aucune'}
              </p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Owner</p>
              <p className="text-sm text-[var(--text-primary)]">{selected.owner}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Mis à jour {formatDate(selected.updatedAt)}
              </p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Audit</p>
              <p className="text-sm text-[var(--text-primary)]">Business #{businessId}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">{selected.fileUrl ?? '—'}</p>
            </Card>
          </div>
        </Card>
      ) : null}

      <Modal
        open={createOpen}
        onCloseAction={() => setCreateOpen(false)}
        title="Ajouter un document"
        description="Ajoute un document administratif."
      >
        <form onSubmit={addDocument} className="space-y-3">
          <Input
            label="Titre"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <Input
            label="Catégorie"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          />
          <Select
            label="Statut"
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as AdminDocument['status'] }))}
          >
            <option value="valid">Valide</option>
            <option value="expiring">Expire bientôt</option>
            <option value="expired">Expiré</option>
          </Select>
          <Input
            label="Expiration"
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
          />
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
