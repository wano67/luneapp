// src/app/app/pro/[businessId]/services/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DebugRequestId } from '@/components/ui/debug-request-id';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ProPageShell } from '@/components/pro/ProPageShell';
import RoleBanner from '@/components/RoleBanner';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { useServiceData } from '@/components/pro/services/hooks/useServiceData';
import { ServicesKpis } from '@/components/pro/services/ServicesKpis';
import { ServicesTable } from '@/components/pro/services/ServicesTable';
import { ServiceFormModal } from '@/components/pro/services/ServiceFormModal';
import { ServiceImportModal } from '@/components/pro/services/ServiceImportModal';
import { ServiceTemplatesModal } from '@/components/pro/services/ServiceTemplatesModal';
import { ServiceDeleteConfirmModal } from '@/components/pro/services/ServiceDeleteConfirmModal';
import type { ServiceItem } from '@/components/pro/services/service-types';

export default function ServicesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const data = useServiceData(businessId);

  // Modal controls
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [templatesService, setTemplatesService] = useState<ServiceItem | null>(null);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);

  function openCreate() {
    if (!isAdmin) { setReadOnlyInfo(readOnlyMessage); return; }
    setEditing(null);
    data.setInfo(null);
    setModalOpen(true);
  }

  function openEdit(service: ServiceItem) {
    if (!isAdmin) { setReadOnlyInfo(readOnlyMessage); return; }
    setEditing(service);
    data.setInfo(null);
    setModalOpen(true);
  }

  function openImport() {
    if (!isAdmin) { setReadOnlyInfo(readOnlyMessage); return; }
    setImportOpen(true);
  }

  function openTemplates(service: ServiceItem) {
    setTemplatesService(service);
    setTemplatesModalOpen(true);
  }

  function openDelete(service: ServiceItem) {
    if (!isAdmin) { setReadOnlyInfo(readOnlyMessage); return; }
    setDeleteTarget(service);
  }

  return (
    <>
      <RoleBanner role={role} />
      <ProPageShell
        backHref={`/app/pro/${businessId}`}
        title="Services"
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={openCreate} disabled={!isAdmin}>Nouveau service</Button>
            <Button variant="outline" onClick={openImport} disabled={!isAdmin}>Importer CSV</Button>
            <Button variant="outline" asChild>
              <Link href={`/app/pro/${businessId}/settings/team`}>Équipes</Link>
            </Button>
          </div>
        }
      >
        {/* KPIs */}
        <ServicesKpis services={data.services} />

        {/* Filters */}
        <Card className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <form
              onSubmit={(e) => { e.preventDefault(); void data.loadServices(); }}
              className="flex gap-2 sm:col-span-2 lg:col-span-2"
            >
              <Input
                placeholder="Rechercher (nom, code)…"
                value={data.search}
                onChange={(e) => data.setSearch(e.target.value)}
              />
              <Button type="submit" variant="outline" className="shrink-0">Filtrer</Button>
            </form>
            <Select label="Type" value={data.typeFilter} onChange={(e) => data.setTypeFilter(e.target.value)}>
              <option value="ALL">Tous les types</option>
              {data.typeOptions.map((t) => (
                <option key={t || 'empty'} value={t}>{t || '—'}</option>
              ))}
            </Select>
            <Select label="Catégorie" value={data.categoryFilter} onChange={(e) => data.setCategoryFilter(e.target.value)}>
              <option value="">Toutes</option>
              {data.categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          {data.tagOptions.length > 0 ? (
            <Select label="Tag" value={data.tagFilter} onChange={(e) => data.setTagFilter(e.target.value)}>
              <option value="">Tous</option>
              {data.tagOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          ) : null}
        </Card>

        {/* Table */}
        {data.loading ? (
          <p className="text-sm text-[var(--text-faint)]">Chargement du catalogue…</p>
        ) : data.error ? (
          <Card className="p-4">
            <p className="text-sm font-semibold text-[var(--danger)]">{data.error}</p>
          </Card>
        ) : (
          <ServicesTable
            services={data.filtered}
            isAdmin={isAdmin}
            onEdit={openEdit}
            onDelete={openDelete}
            onTemplates={openTemplates}
            onCreateFirst={openCreate}
          />
        )}

        {data.info ? <p className="text-sm text-[var(--success)]">{data.info}</p> : null}
        {readOnlyInfo ? <p className="text-xs text-[var(--text-faint)]">{readOnlyInfo}</p> : null}
        <DebugRequestId requestId={data.requestId} />
      </ProPageShell>

      {/* Modals */}
      <ServiceImportModal
        open={importOpen}
        businessId={businessId}
        isAdmin={isAdmin}
        onClose={() => setImportOpen(false)}
        onAfterImport={() => void data.loadServices()}
      />

      <ServiceTemplatesModal
        open={templatesModalOpen}
        service={templatesService}
        businessId={businessId}
        isAdmin={isAdmin}
        onClose={() => { setTemplatesModalOpen(false); setTemplatesService(null); }}
        onTemplateCountChange={data.updateTemplateCount}
      />

      <ServiceFormModal
        open={modalOpen}
        editing={editing}
        businessId={businessId}
        isAdmin={isAdmin}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onAfterSave={async (_createdId, isEdit) => {
          data.setInfo(isEdit ? 'Service mis à jour.' : 'Service créé.');
          await data.loadServices();
        }}
      />

      <ServiceDeleteConfirmModal
        target={deleteTarget}
        businessId={businessId}
        isAdmin={isAdmin}
        onClose={() => setDeleteTarget(null)}
        onAfterDelete={() => void data.loadServices()}
      />
    </>
  );
}
