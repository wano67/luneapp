// src/app/app/pro/[businessId]/services/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import RoleBanner from '@/components/RoleBanner';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { ServiceFormModal } from '@/components/pro/services/ServiceFormModal';
import { ServiceImportModal } from '@/components/pro/services/ServiceImportModal';
import { ServiceTemplatesModal } from '@/components/pro/services/ServiceTemplatesModal';
import { ServiceDeleteConfirmModal } from '@/components/pro/services/ServiceDeleteConfirmModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type Service = {
  id: string;
  businessId: string;
  code: string;
  name: string;
  categoryReferenceId: string | null;
  categoryReferenceName?: string | null;
  tagReferences?: { id: string; name: string }[];
  type: string | null;
  description: string | null;
  defaultPriceCents: string | null;
  tjmCents: string | null;
  durationHours: number | null;
  vatRate: number | null;
  createdAt: string;
  updatedAt: string;
  templateCount?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(cents: string | null) {
  if (!cents) return '—';
  const num = Number(cents);
  if (Number.isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num / 100);
  } catch {
    return `${(num / 100).toFixed(0)} €`;
  }
}

function formatHours(value: number | null) {
  if (value == null) return '—';
  return `${value} h`;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  // ── Main data ──
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [tagOptions, setTagOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceRequestId, setReferenceRequestId] = useState<string | null>(null);

  // ── Modal open controls ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [templatesService, setTemplatesService] = useState<Service | null>(null);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);

  const fetchController = useRef<AbortController | null>(null);

  // ── Derived ──
  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    services.forEach((s) => { if (s.type) values.add(s.type); });
    return Array.from(values);
  }, [services]);

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.trim().toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.type ?? '').toLowerCase().includes(q)
    );
  }, [services, search]);

  // ── Loaders ──
  async function loadServices(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }
    try {
      setLoading(true);
      setError(null);
      setRequestId(null);
      const paramsQuery = new URLSearchParams();
      if (search.trim()) paramsQuery.set('q', search.trim());
      if (typeFilter !== 'ALL') paramsQuery.set('type', typeFilter);
      if (categoryFilter) paramsQuery.set('categoryReferenceId', categoryFilter);
      if (tagFilter) paramsQuery.set('tagReferenceId', tagFilter);
      const res = await fetchJson<{ items: Service[] }>(
        `/api/pro/businesses/${businessId}/services${paramsQuery.toString() ? `?${paramsQuery.toString()}` : ''}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setRequestId(res.requestId);
      if (res.status === 401) {
        window.location.href = `/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les services.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setServices([]);
        return;
      }
      setServices(
        res.data.items.map((item) => ({ ...item, tagReferences: item.tagReferences ?? [], templateCount: item.templateCount ?? 0 }))
      );
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  async function loadReferenceOptions(signal?: AbortSignal) {
    try {
      setReferenceError(null);
      setReferenceRequestId(null);
      const [catRes, tagRes] = await Promise.all([
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=CATEGORY`, {}, signal
        ),
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=TAG`, {}, signal
        ),
      ]);
      if (signal?.aborted) return;
      if (catRes.ok && catRes.data) setCategoryOptions(catRes.data.items);
      if (tagRes.ok && tagRes.data) setTagOptions(tagRes.data.items);
      if (!catRes.ok || !tagRes.ok) {
        const reqId = catRes.requestId ?? tagRes.requestId ?? null;
        setReferenceRequestId(reqId);
        setReferenceError('Impossible de charger les références.');
      }
    } catch (err) {
      if (signal?.aborted) return;
      setReferenceError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    void loadServices();
    return () => { fetchController.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, typeFilter, categoryFilter, tagFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReferenceOptions(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // ── Modal openers ──
  function openCreate() {
    if (!isAdmin) { setReadOnlyInfo(readOnlyMessage); return; }
    setEditing(null);
    setInfo(null);
    setModalOpen(true);
  }

  function openEdit(service: Service) {
    if (!isAdmin) { setReadOnlyInfo(readOnlyMessage); return; }
    setEditing(service);
    setInfo(null);
    setModalOpen(true);
  }

  function openImport() {
    if (!isAdmin) { setReadOnlyInfo(readOnlyMessage); return; }
    setImportOpen(true);
  }

  function openTemplates(service: Service) {
    setTemplatesService(service);
    setTemplatesModalOpen(true);
  }

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <RoleBanner role={role} />
      <Card className="space-y-4 p-5">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Services
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Catalogue des services</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Structure tes offres : code clair, prix et durée pour les proposer dans les projets.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1">
            <div className="flex flex-wrap gap-2">
              <Button onClick={openCreate} disabled={!isAdmin}>Créer un service</Button>
              <Button variant="outline" onClick={openImport} disabled={!isAdmin}>Importer CSV</Button>
            </div>
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">
                Lecture seule : nécessite ADMIN/OWNER pour créer ou éditer.
              </p>
            ) : null}
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-3 md:grid-cols-3">
          <form
            onSubmit={(e) => { e.preventDefault(); void loadServices(); }}
            className="col-span-2 flex flex-col gap-2 sm:flex-row"
          >
            <Input
              placeholder="Rechercher (nom, code)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="outline" className="w-full sm:w-auto">Filtrer</Button>
          </form>
          <Select label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">Tous les types</option>
            {typeOptions.map((t) => (
              <option key={t || 'empty'} value={t}>{t || '—'}</option>
            ))}
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select label="Catégorie" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Toutes</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select label="Tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">Tous</option>
            {tagOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          {referenceError ? (
            <p className="text-xs text-[var(--danger)]">
              {referenceError}
              {referenceRequestId ? ` (Ref: ${referenceRequestId})` : ''}
            </p>
          ) : null}
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement du catalogue…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 border-dashed border-[var(--border)] bg-transparent p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Crée ton premier service pour le vendre dans tes projets.
            </p>
            <Button onClick={openCreate} disabled={!isAdmin}>Créer un service</Button>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Références</TableHead>
                <TableHead>Prix défaut</TableHead>
                <TableHead>TJM</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Templates</TableHead>
                <TableHead>Mis à jour</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-semibold text-[var(--text-primary)]">{service.code}</TableCell>
                  <TableCell>{service.name}</TableCell>
                  <TableCell>{service.type || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {service.categoryReferenceName ? (
                        <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
                          {service.categoryReferenceName}
                        </Badge>
                      ) : null}
                      {service.tagReferences?.map((tag) => (
                        <Badge key={tag.id} variant="neutral" className="bg-[var(--success-bg)] text-[var(--success)]">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{formatMoney(service.defaultPriceCents)}</TableCell>
                  <TableCell>{formatMoney(service.tjmCents)}</TableCell>
                  <TableCell>{formatHours(service.durationHours)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[var(--text-primary)]">{service.templateCount ?? 0}</span>
                      <Button variant="ghost" size="sm" onClick={() => openTemplates(service)}>Gérer</Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-[var(--text-secondary)]">
                    {formatDate(service.updatedAt)}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(service)} disabled={!isAdmin}>
                      Éditer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!isAdmin) { setReadOnlyInfo(readOnlyMessage); return; }
                        setDeleteTarget(service);
                      }}
                      disabled={!isAdmin}
                    >
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? <TableEmpty>Aucun service.</TableEmpty> : null}
            </TableBody>
          </Table>
        )}

        {info ? <p className="text-sm text-[var(--success)]">{info}</p> : null}
        {readOnlyInfo ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyInfo}</p> : null}
        {requestId ? <p className="text-[10px] text-[var(--text-faint)]">Req: {requestId}</p> : null}
      </Card>

      {/* ── Modals ── */}
      <ServiceImportModal
        open={importOpen}
        businessId={businessId}
        isAdmin={isAdmin}
        onClose={() => setImportOpen(false)}
        onAfterImport={() => void loadServices()}
      />

      <ServiceTemplatesModal
        open={templatesModalOpen}
        service={templatesService}
        businessId={businessId}
        isAdmin={isAdmin}
        onClose={() => { setTemplatesModalOpen(false); setTemplatesService(null); }}
        onTemplateCountChange={(serviceId, count) =>
          setServices((prev) => prev.map((s) => s.id === serviceId ? { ...s, templateCount: count } : s))
        }
      />

      <ServiceFormModal
        open={modalOpen}
        editing={editing}
        businessId={businessId}
        isAdmin={isAdmin}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onAfterSave={async (_createdId, isEdit) => {
          setInfo(isEdit ? 'Service mis à jour.' : 'Service créé.');
          await loadServices();
        }}
      />

      <ServiceDeleteConfirmModal
        target={deleteTarget}
        businessId={businessId}
        isAdmin={isAdmin}
        onClose={() => setDeleteTarget(null)}
        onAfterDelete={() => void loadServices()}
      />
    </div>
  );
}
