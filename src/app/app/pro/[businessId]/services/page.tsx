// src/app/app/pro/[businessId]/services/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type Service = {
  id: string;
  businessId: string;
  code: string;
  name: string;
  type: string | null;
  description: string | null;
  defaultPriceCents: string | null;
  tjmCents: string | null;
  durationHours: number | null;
  vatRate: number | null;
  createdAt: string;
  updatedAt: string;
};

type ServiceListResponse = { items: Service[] };
type ServiceItemResponse = { item: Service };

type ServiceFormState = {
  code: string;
  name: string;
  type: string;
  defaultPrice: string;
  tjm: string;
  durationHours: string;
  vatRate: string;
  description: string;
};

const emptyForm: ServiceFormState = {
  code: '',
  name: '',
  type: '',
  defaultPrice: '',
  tjm: '',
  durationHours: '',
  vatRate: '',
  description: '',
};

function formatMoney(cents: string | null) {
  if (!cents) return '—';
  const num = Number(cents);
  if (Number.isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(num / 100);
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

export default function ServicesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [editing, setEditing] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchController = useRef<AbortController | null>(null);

  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    services.forEach((s) => {
      if (s.type) values.add(s.type);
    });
    return Array.from(values);
  }, [services]);

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

      const res = await fetchJson<ServiceListResponse>(
        `/api/pro/businesses/${businessId}/services${paramsQuery.toString() ? `?${paramsQuery.toString()}` : ''}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setRequestId(res.requestId);

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les services.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setServices([]);
        return;
      }

      setServices(res.data.items);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void loadServices();
    return () => fetchController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, typeFilter]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    setInfo(null);

    const priceNum = form.defaultPrice.trim() ? Number(form.defaultPrice) : null;
    const tjmNum = form.tjm.trim() ? Number(form.tjm) : null;
    const durationNum = form.durationHours.trim() ? Number(form.durationHours) : null;
    const vatNum = form.vatRate.trim() ? Number(form.vatRate) : null;

    if (
      (priceNum != null && Number.isNaN(priceNum)) ||
      (tjmNum != null && Number.isNaN(tjmNum)) ||
      (durationNum != null && Number.isNaN(durationNum)) ||
      (vatNum != null && Number.isNaN(vatNum))
    ) {
      setFormError('Merci de vérifier les valeurs numériques.');
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type.trim() || null,
      description: form.description.trim() || null,
    };

    if (priceNum != null) payload.defaultPriceCents = Math.round(priceNum * 100);
    if (tjmNum != null) payload.tjmCents = Math.round(tjmNum * 100);
    if (durationNum != null) payload.durationHours = durationNum;
    if (vatNum != null) payload.vatRate = vatNum;

    const isEdit = Boolean(editing);
    const endpoint = isEdit
      ? `/api/pro/businesses/${businessId}/services/${editing?.id}`
      : `/api/pro/businesses/${businessId}/services`;

    const res = await fetchJson<ServiceItemResponse>(endpoint, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setRequestId(res.requestId);

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de sauvegarder.';
      setFormError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setSaving(false);
      return;
    }

    setInfo(isEdit ? 'Service mis à jour.' : 'Service créé.');
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setSaving(false);
    await loadServices();
  }

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setFormError(null);
    setInfo(null);
    setModalOpen(true);
  }

  function openEdit(service: Service) {
    setEditing(service);
    setForm({
      code: service.code,
      name: service.name,
      type: service.type ?? '',
      description: service.description ?? '',
      defaultPrice: service.defaultPriceCents ? (Number(service.defaultPriceCents) / 100).toString() : '',
      tjm: service.tjmCents ? (Number(service.tjmCents) / 100).toString() : '',
      durationHours: service.durationHours != null ? String(service.durationHours) : '',
      vatRate: service.vatRate != null ? String(service.vatRate) : '',
    });
    setFormError(null);
    setInfo(null);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const res = await fetchJson<null>(
      `/api/pro/businesses/${businessId}/services/${deleteTarget.id}`,
      { method: 'DELETE' }
    );
    setRequestId(res.requestId);
    if (!res.ok) {
      const msg = res.error ?? 'Suppression impossible.';
      setDeleteError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    setDeleteTarget(null);
    await loadServices();
  }

  const filtered = useMemo(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return services.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.type ?? '').toLowerCase().includes(q)
      );
    }
    return services;
  }, [services, search]);

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Services
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Catalogue des services
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Structure tes offres : code clair, prix et durée pour les proposer dans les projets.
            </p>
          </div>
          <Button onClick={openCreate}>Créer un service</Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadServices();
            }}
            className="col-span-2 flex flex-col gap-2 sm:flex-row"
          >
            <Input
              placeholder="Rechercher (nom, code)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="outline" className="whitespace-nowrap">
              Filtrer
            </Button>
          </form>
          <Select label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">Tous les types</option>
            {typeOptions.map((t) => (
              <option key={t || 'empty'} value={t}>
                {t || '—'}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement du catalogue…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-rose-400">{error}</p>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 border-dashed border-[var(--border)] bg-transparent p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Crée ton premier service pour le vendre dans tes projets.
            </p>
            <Button onClick={openCreate}>Créer un service</Button>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Prix défaut</TableHead>
                <TableHead>TJM</TableHead>
                <TableHead>Durée</TableHead>
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
                  <TableCell>{formatMoney(service.defaultPriceCents)}</TableCell>
                  <TableCell>{formatMoney(service.tjmCents)}</TableCell>
                  <TableCell>{formatHours(service.durationHours)}</TableCell>
                  <TableCell className="text-xs text-[var(--text-secondary)]">
                    {formatDate(service.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(service)}>
                      Éditer
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(service)}>
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? <TableEmpty>Aucun service.</TableEmpty> : null}
            </TableBody>
          </Table>
        )}

        {info ? <p className="text-sm text-emerald-500">{info}</p> : null}
        {requestId ? (
          <p className="text-[10px] text-[var(--text-faint)]">Req: {requestId}</p>
        ) : null}
      </Card>

      <Modal
        open={modalOpen}
        onCloseAction={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Éditer le service' : 'Créer un service'}
        description="Renseigne les informations clés pour que l’équipe puisse le vendre."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Identité</p>
              <Input
                label="Code"
                required
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="SER-UX"
              />
              <Input
                label="Nom"
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Atelier UX"
              />
              <Input
                label="Type"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                placeholder="Workshop / Audit / Build…"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Tarification</p>
              <Input
                label="Prix par défaut (€)"
                type="number"
                inputMode="decimal"
                value={form.defaultPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, defaultPrice: e.target.value }))}
                placeholder="1500"
              />
              <Input
                label="TJM (€)"
                type="number"
                inputMode="decimal"
                value={form.tjm}
                onChange={(e) => setForm((prev) => ({ ...prev, tjm: e.target.value }))}
                placeholder="800"
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  label="Durée (h)"
                  type="number"
                  inputMode="numeric"
                  value={form.durationHours}
                  onChange={(e) => setForm((prev) => ({ ...prev, durationHours: e.target.value }))}
                  placeholder="12"
                />
                <Input
                  label="TVA (%)"
                  type="number"
                  inputMode="numeric"
                  value={form.vatRate}
                  onChange={(e) => setForm((prev) => ({ ...prev, vatRate: e.target.value }))}
                  placeholder="20"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Description</p>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Pitch commercial, livrables clés, exclusions…"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors hover:border-[var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            />
          </div>

          {formError ? <p className="text-sm font-semibold text-rose-500">{formError}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le service'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onCloseAction={() => setDeleteTarget(null)}
        title="Supprimer le service ?"
        description="Cette action est définitive et retire le service du catalogue."
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {deleteTarget ? `${deleteTarget.name} (${deleteTarget.code})` : ''}
          </p>
          {deleteError ? <p className="text-sm font-semibold text-rose-500">{deleteError}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="ghost" onClick={confirmDelete}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
