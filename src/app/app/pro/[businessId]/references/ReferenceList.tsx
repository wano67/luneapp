'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';

type ReferenceType = 'CATEGORY' | 'TAG' | 'NUMBERING' | 'AUTOMATION';

type ReferenceItem = {
  id: string;
  businessId: string;
  type: ReferenceType;
  name: string;
  value: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

type ReferenceListResponse = { items: ReferenceItem[] };
type ReferenceItemResponse = { item: ReferenceItem };

const TYPE_LABELS: Record<ReferenceType, { title: string; helper: string; valuePlaceholder: string }> = {
  CATEGORY: {
    title: 'Catégories',
    helper: 'Catégories communes pour classer projets/finances.',
    valuePlaceholder: 'Valeur optionnelle (ex: code interne)',
  },
  TAG: {
    title: 'Tags',
    helper: 'Tags globaux appliquables aux projets/clients.',
    valuePlaceholder: 'Valeur optionnelle (couleur, code…)',
  },
  NUMBERING: {
    title: 'Numérotation',
    helper: 'Préfixes ou séquences pour devis/factures/projets.',
    valuePlaceholder: 'Ex: DEV-2025, INV-{YY}-{SEQ}',
  },
  AUTOMATION: {
    title: 'Automations',
    helper: 'Règles/automations (description courte).',
    valuePlaceholder: 'Paramètre ou payload JSON léger',
  },
};

type FormState = {
  name: string;
  value: string;
};

const emptyForm: FormState = { name: '', value: '' };

export function ReferenceList({
  businessId,
  type,
}: {
  businessId: string;
  type: ReferenceType;
}) {
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const abortRef = useRef<AbortController | null>(null);

  const typeLabels = TYPE_LABELS[type];

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const lower = search.trim().toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(lower));
  }, [items, search]);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, includeArchived]);

  async function loadItems() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setRequestId(null);

    const params = new URLSearchParams();
    params.set('type', type);
    if (includeArchived) params.set('includeArchived', 'true');

    const res = await fetchJson<ReferenceListResponse>(
      `/api/pro/businesses/${businessId}/references?${params.toString()}`,
      {},
      controller.signal
    );
    if (controller.signal.aborted) return;
    setRequestId(res.requestId);
    setLoading(false);

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de charger les références.';
      setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setItems([]);
      return;
    }

    setItems(res.data.items);
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setFormError(readOnlyMessage);
      return;
    }
    setSaving(true);
    setFormError(null);
    setInfo(null);
    const payload = {
      type,
      name: form.name.trim(),
      value: form.value.trim() || undefined,
    };

    const res = await fetchJson<ReferenceItemResponse>(`/api/pro/businesses/${businessId}/references`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify(payload),
    });
    setRequestId(res.requestId);
    setSaving(false);

    const item = res.data?.item;
    if (!res.ok || !item) {
      const msg = res.error ?? 'Création impossible.';
      setFormError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }

    setItems((prev) => [item, ...prev]);
    setForm(emptyForm);
    setInfo('Référence créée.');
  }

  async function handleEditSubmit(e?: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>) {
    if (e) e.preventDefault();
    if (!editingId) return;
    if (!isAdmin) {
      setEditError(readOnlyMessage);
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const payload: Record<string, unknown> = {
      name: editForm.name.trim(),
      value: editForm.value.trim() || null,
    };

    const res = await fetchJson<ReferenceItemResponse>(
      `/api/pro/businesses/${businessId}/references/${editingId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
        body: JSON.stringify(payload),
      }
    );
    setRequestId(res.requestId);
    setEditSaving(false);

    const item = res.data?.item;
    if (!res.ok || !item) {
      const msg = res.error ?? 'Mise à jour impossible.';
      setEditError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }

    setItems((prev) => prev.map((ref) => (ref.id === editingId ? item : ref)));
    setEditingId(null);
    setEditForm(emptyForm);
    setInfo('Référence mise à jour.');
  }

  async function toggleArchive(item: ReferenceItem) {
    if (!isAdmin) {
      setInfo(readOnlyMessage);
      return;
    }
    const res = await fetchJson<ReferenceItemResponse>(
      `/api/pro/businesses/${businessId}/references/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
        body: JSON.stringify({ isArchived: !item.isArchived }),
      }
    );
    setRequestId(res.requestId);
    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Action impossible.';
      setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    setItems((prev) => prev.map((ref) => (ref.id === item.id ? res.data!.item : ref)));
  }

  async function deleteReference(item: ReferenceItem) {
    if (!isAdmin) {
      setInfo(readOnlyMessage);
      return;
    }
    const confirmed = window.confirm(`Supprimer "${item.name}" ?`);
    if (!confirmed) return;
    const res = await fetchJson<{ ok: boolean }>(
      `/api/pro/businesses/${businessId}/references/${item.id}`,
      {
        method: 'DELETE',
        headers: { Origin: window.location.origin },
      }
    );
    setRequestId(res.requestId);
    if (!res.ok) {
      const msg = res.error ?? 'Suppression impossible.';
      setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    setItems((prev) => prev.filter((ref) => ref.id !== item.id));
  }

  function startEdit(item: ReferenceItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      value: item.value || '',
    });
    setEditError(null);
  }

  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">{typeLabels.title}</h1>
          <p className="text-sm text-muted-foreground">{typeLabels.helper}</p>
        </div>
        <Link href={`/app/pro/${businessId}/references`} className="text-sm text-primary underline">
          Retour aux références
        </Link>
      </div>

      {info && <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">{info}</div>}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </div>
      )}
      {requestId && (
        <div className="text-xs text-muted-foreground">
          Request ID: <code>{requestId}</code>
        </div>
      )}

      <Card className="p-4 space-y-3">
        <form className="flex flex-col gap-2 md:flex-row md:items-end" onSubmit={handleCreate}>
          <div className="flex-1">
            <label className="text-sm font-medium">Nom</label>
            <Input
              required
              placeholder="Nom"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium">Valeur</label>
            <Input
              placeholder={typeLabels.valuePlaceholder}
              value={form.value}
              onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="min-w-[150px]">
            <Button type="submit" disabled={saving || !isAdmin} className="w-full">
              {saving ? 'En cours…' : 'Ajouter'}
            </Button>
            {!isAdmin && <p className="text-xs text-muted-foreground mt-1">{readOnlyMessage}</p>}
          </div>
        </form>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Rechercher"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Inclure archivés
          </label>
          <span className="text-xs text-muted-foreground">Route: {pathname}</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Valeur</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableEmpty>Chargement…</TableEmpty>}
            {!loading && filteredItems.length === 0 && <TableEmpty>Aucune référence.</TableEmpty>}
            {!loading &&
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {editingId === item.id ? (
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                        disabled={editSaving}
                      />
                    ) : (
                      item.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        value={editForm.value}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, value: e.target.value }))}
                        disabled={editSaving}
                      />
                    ) : (
                      item.value || '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isArchived ? 'neutral' : 'pro'}>
                      {item.isArchived ? 'Archivé' : 'Actif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {editingId === item.id ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={editSaving}>
                          Annuler
                        </Button>
                        <Button size="sm" onClick={handleEditSubmit} disabled={editSaving}>
                          {editSaving ? '...' : 'Enregistrer'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(item)} disabled={!isAdmin}>
                          Éditer
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleArchive(item)} disabled={!isAdmin}>
                          {item.isArchived ? 'Restaurer' : 'Archiver'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => deleteReference(item)} disabled={!isAdmin}>
                          Supprimer
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {editError && <p className="text-sm text-red-600">{editError}</p>}
      </Card>
    </div>
  );
}
