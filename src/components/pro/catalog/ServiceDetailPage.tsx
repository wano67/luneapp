"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';

type Template = {
  id: string;
  title: string;
  phase: string | null;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

type ServiceDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string | null;
  defaultPriceCents: string | null;
  vatRate: number | null;
  billingType?: 'ONE_OFF' | 'RECURRING';
  recurrenceInterval?: string | null;
  recurrenceDayOfMonth?: number | null;
  isArchived?: boolean;
  taskTemplates: Template[];
};

type ServiceForm = {
  code: string;
  name: string;
  description: string;
  price: string;
  vatRate: string;
  type: string;
};

type TemplateForm = {
  id?: string | null;
  title: string;
  phase: string;
  defaultAssigneeRole: string;
  defaultDueOffsetDays: string;
};

const TABS = [
  { key: 'overview', label: 'Vue d’ensemble' },
  { key: 'templates', label: 'Étapes' },
  { key: 'settings', label: 'Paramètres' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function ServiceDetailPage({ businessId, serviceId }: { businessId: string; serviceId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedTab = (searchParams?.get('tab') ?? TABS[0].key) as TabKey;
  const currentTab = useMemo(
    () => (TABS.some((t) => t.key === requestedTab) ? requestedTab : TABS[0].key),
    [requestedTab]
  );

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [templateAutoOpened, setTemplateAutoOpened] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    code: '',
    name: '',
    description: '',
    price: '',
    vatRate: '',
    type: '',
  });

  const [templateForm, setTemplateForm] = useState<TemplateForm>({
    id: null,
    title: '',
    phase: '',
    defaultAssigneeRole: '',
    defaultDueOffsetDays: '',
  });

  const loadService = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchJson<ServiceDetail>(`/api/pro/businesses/${businessId}/services/${serviceId}`);
    setLoading(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Service introuvable.');
      return;
    }
    setService(res.data);
    setTemplates(res.data.taskTemplates ?? []);
    setServiceForm({
      code: res.data.code,
      name: res.data.name,
      description: res.data.description ?? '',
      price: res.data.defaultPriceCents ? String(Number(res.data.defaultPriceCents)) : '',
      vatRate: res.data.vatRate != null ? String(res.data.vatRate) : '',
      type: res.data.type ?? '',
    });
  }, [businessId, serviceId]);

  const loadTemplates = useCallback(async () => {
      const res = await fetchJson<{ items: Template[] }>(
        `/api/pro/businesses/${businessId}/services/${serviceId}/templates`
      );
      if (res.ok && res.data?.items) {
        setTemplates(res.data.items);
      }
  }, [businessId, serviceId]);

  useEffect(() => {
    void loadService();
  }, [loadService]);

  useEffect(() => {
    if (templateAutoOpened) return;
    const shouldOpen = searchParams?.get('openTemplate') === '1';
    if (!shouldOpen) return;
    setTemplateOpen(true);
    setInfo('Service créé. Ajoutez des tâches recommandées.');
    setTemplateAutoOpened(true);
  }, [searchParams, templateAutoOpened]);

  const handleTabChange = (key: string) => {
    if (!TABS.some((t) => t.key === key)) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const saveService = async () => {
    if (!serviceForm.name.trim() || !serviceForm.code.trim()) {
      setFormError('Code et nom requis.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      code: serviceForm.code.trim(),
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      defaultPriceCents: serviceForm.price ? Number(serviceForm.price) : null,
      vatRate: serviceForm.vatRate ? Number(serviceForm.vatRate) : null,
      type: serviceForm.type.trim() || null,
    };
    const res = await fetchJson(`/api/pro/businesses/${businessId}/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Enregistrement impossible.');
      return;
    }
    setEditOpen(false);
    void loadService();
  };

  const openTemplateCreate = () => {
    setFormError(null);
    setTemplateForm({ id: null, title: '', phase: '', defaultAssigneeRole: '', defaultDueOffsetDays: '' });
    setTemplateOpen(true);
  };

  const openTemplateEdit = (tpl: Template) => {
    setFormError(null);
    setTemplateForm({
      id: tpl.id,
      title: tpl.title,
      phase: tpl.phase ?? '',
      defaultAssigneeRole: tpl.defaultAssigneeRole ?? '',
      defaultDueOffsetDays: tpl.defaultDueOffsetDays != null ? String(tpl.defaultDueOffsetDays) : '',
    });
    setTemplateOpen(true);
  };

  const saveTemplate = async () => {
    if (!templateForm.title.trim()) {
      setFormError('Titre requis.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      title: templateForm.title.trim(),
      phase: templateForm.phase || null,
      defaultAssigneeRole: templateForm.defaultAssigneeRole.trim() || null,
      defaultDueOffsetDays: templateForm.defaultDueOffsetDays
        ? Number(templateForm.defaultDueOffsetDays)
        : null,
    };
    const isEdit = !!templateForm.id;
    const url = isEdit
      ? `/api/pro/businesses/${businessId}/services/${serviceId}/templates/${templateForm.id}`
      : `/api/pro/businesses/${businessId}/services/${serviceId}/templates`;
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetchJson(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Impossible d’enregistrer le template.');
      return;
    }
    setTemplateOpen(false);
    await loadTemplates();
  };

  const deleteTemplate = async (id: string) => {
    const confirmDelete = window.confirm('Supprimer ce template ?');
    if (!confirmDelete) return;
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/services/${serviceId}/templates/${id}`,
      { method: 'DELETE' }
    );
    if (!res.ok) return;
    await loadTemplates();
  };

  const price = service?.defaultPriceCents
    ? formatCurrencyEUR(Number(service.defaultPriceCents), { minimumFractionDigits: 0 })
    : '—';
  const billing = service?.billingType === 'RECURRING' ? 'Abonnement mensuel' : 'Ponctuel';
  const totalDuration = templates.reduce(
    (acc, tpl) => acc + (tpl.defaultDueOffsetDays != null ? Math.max(0, tpl.defaultDueOffsetDays) : 0),
    0
  );
  const needsCompletion = !service?.description || templates.length === 0;

  const overview = (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 space-y-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Présentation</p>
        <p className="text-sm text-[var(--text-secondary)]">{service?.description || 'Aucune description.'}</p>
        <p className="text-xs text-[var(--text-secondary)]">Type: {service?.type || '—'}</p>
        <p className="text-xs text-[var(--text-secondary)]">Code: {service?.code}</p>
        {needsCompletion ? (
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setEditOpen(true)}>
            Compléter le service
          </Button>
        ) : null}
      </Card>
      <Card className="p-4 space-y-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Facturation</p>
        <p className="text-sm text-[var(--text-secondary)]">Prix: {price}</p>
        <p className="text-sm text-[var(--text-secondary)]">TVA: {service?.vatRate ?? '—'}%</p>
        <p className="text-sm text-[var(--text-secondary)]">Mode: {billing}</p>
        {service?.recurrenceDayOfMonth && service.billingType === 'RECURRING' ? (
          <p className="text-sm text-[var(--text-secondary)]">Jour: {service.recurrenceDayOfMonth}</p>
        ) : null}
        <p className="text-sm text-[var(--text-secondary)]">
          Durée totale estimée: {totalDuration ? `${totalDuration} j` : '—'}
        </p>
      </Card>
    </div>
  );

  const templatesSection = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Étapes ({templates.length})</p>
        <Button size="sm" className="gap-2" onClick={openTemplateCreate}>
          <Plus size={14} /> Ajouter une étape
        </Button>
      </div>
      {templates.length === 0 ? (
        <Card className="p-4 text-sm text-[var(--text-secondary)]">
          Les étapes permettent de générer des tâches automatiquement lors de l’ajout du service dans un projet.
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="text-[var(--text-primary)]">{tpl.title}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Phase: {tpl.phase || '—'} · Durée/échéance: {tpl.defaultDueOffsetDays != null ? `J+${tpl.defaultDueOffsetDays}` : '—'} · Assignation:{' '}
                  {tpl.defaultAssigneeRole || '—'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openTemplateEdit(tpl)}>
                  Modifier
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteTemplate(tpl.id)}>
                  Supprimer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Card className="p-4 text-sm text-[var(--text-secondary)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[var(--text-primary)]">Automatisation projet</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Générer automatiquement les tâches de ces étapes lors de l’ajout du service à un projet.
            </p>
          </div>
          <Button size="sm" variant="outline" disabled>
            Bientôt
          </Button>
        </div>
      </Card>
    </div>
  );

  const settingsPlaceholder = (
    <Card className="p-4 text-sm text-[var(--text-secondary)]">
      Paramètres supplémentaires à venir. Utilisez “Modifier” pour mettre à jour les informations principales.
    </Card>
  );

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}/catalog?tab=services`}
      backLabel="Catalogue"
      title={service?.name ?? 'Service'}
      subtitle={`${service?.code ?? ''} · ${billing}${service?.isArchived ? ' · Archivé' : ''}`}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setFormError(null);
            setEditOpen(true);
          }}
        >
          Modifier
        </Button>
      }
      tabs={TABS}
      activeTab={currentTab}
      onTabChange={handleTabChange}
    >
      {loading ? (
        <Card className="p-4 text-sm text-[var(--text-secondary)]">Chargement…</Card>
      ) : error ? (
        <Card className="p-4 text-sm text-rose-500">{error}</Card>
      ) : (
        <div className="space-y-4">
          {info ? <Card className="p-4 text-sm text-emerald-600">{info}</Card> : null}
          {currentTab === 'overview' ? overview : null}
          {currentTab === 'templates' ? templatesSection : null}
          {currentTab === 'settings' ? settingsPlaceholder : null}
        </div>
      )}

      <Modal
        open={editOpen}
        onCloseAction={() => setEditOpen(false)}
        title="Modifier le service"
      >
        <div className="space-y-3">
          <Input label="Code" value={serviceForm.code} onChange={(e) => setServiceForm((p) => ({ ...p, code: e.target.value }))} />
          <Input label="Nom" value={serviceForm.name} onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))} />
          <Input
            label="Description"
            value={serviceForm.description}
            onChange={(e) => setServiceForm((p) => ({ ...p, description: e.target.value }))}
          />
          <Input
            label="Prix (cents)"
            type="number"
            value={serviceForm.price}
            onChange={(e) => setServiceForm((p) => ({ ...p, price: e.target.value }))}
          />
          <Input
            label="TVA (%)"
            type="number"
            value={serviceForm.vatRate}
            onChange={(e) => setServiceForm((p) => ({ ...p, vatRate: e.target.value }))}
          />
          <Input label="Type" value={serviceForm.type} onChange={(e) => setServiceForm((p) => ({ ...p, type: e.target.value }))} />
          <p className="text-xs text-[var(--text-secondary)]">
            Les paramètres d’abonnement sont conservés via l’API existante. Les champs non supportés ne sont pas envoyés.
          </p>
          {formError ? <p className="text-sm text-rose-500">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveService} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={templateOpen}
        onCloseAction={() => setTemplateOpen(false)}
        title={templateForm.id ? 'Modifier l’étape' : 'Ajouter une étape'}
      >
        <div className="space-y-3">
          <Input
            label="Titre"
            value={templateForm.title}
            onChange={(e) => setTemplateForm((p) => ({ ...p, title: e.target.value }))}
          />
          <Input
            label="Phase (optionnel)"
            value={templateForm.phase}
            onChange={(e) => setTemplateForm((p) => ({ ...p, phase: e.target.value }))}
          />
          <Input
            label="Rôle assigné par défaut"
            value={templateForm.defaultAssigneeRole}
            onChange={(e) => setTemplateForm((p) => ({ ...p, defaultAssigneeRole: e.target.value }))}
          />
          <Input
            label="Échéance relative (jours, ex: 7 pour J+7)"
            type="number"
            value={templateForm.defaultDueOffsetDays}
            onChange={(e) => setTemplateForm((p) => ({ ...p, defaultDueOffsetDays: e.target.value }))}
          />
          {formError ? <p className="text-sm text-rose-500">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveTemplate} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>
    </ProPageShell>
  );
}
