"use client";

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { SearchSelect } from '@/components/ui/search-select';
import { Modal } from '@/components/ui/modal';
import { sanitizeEuroInput } from '@/lib/money';
import type { SetupServicesModalProps } from './setup-types';

export default function SetupServicesModal({
  isAdmin,
  saving,
  modalError,
  catalogSearchResults,
  serviceSearch,
  serviceSelections,
  generateTasksOnAdd,
  taskAssigneeId,
  taskDueOffsetDays,
  serviceTemplates,
  templatesLoading,
  selectedServiceIds,
  quickServiceDraft,
  quickServiceSaving,
  quickServiceError,
  members,
  setServiceSearch,
  setServiceSelections,
  setGenerateTasksOnAdd,
  setTaskAssigneeId,
  setTaskDueOffsetDays,
  setQuickServiceDraft,
  onLoadCatalogServices,
  onAddServices,
  onQuickCreateService,
  onCloseModal,
}: SetupServicesModalProps) {
  const memberItems = useMemo(
    () => [{ code: '', label: 'Non assigné' }, ...members.map((m) => ({ code: m.userId, label: m.name ?? m.email }))],
    [members]
  );

  return (
    <Modal
      open
      onCloseAction={onCloseModal}
      title="Ajouter des services au projet"
      description="Sélectionne les services du catalogue."
      size="lg"
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Créer un service rapide</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Crée un service et ajoute-le immédiatement au projet.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              label="Nom *"
              value={quickServiceDraft.name}
              onChange={(e) => setQuickServiceDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              label="Code (optionnel)"
              value={quickServiceDraft.code}
              onChange={(e) => setQuickServiceDraft((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="SER-ABC"
            />
            <Input
              label="Prix (€)"
              type="text"
              inputMode="decimal"
              value={quickServiceDraft.price}
              onChange={(e) =>
                setQuickServiceDraft((prev) => ({ ...prev, price: sanitizeEuroInput(e.target.value) }))
              }
              placeholder="1500"
            />
            <Select
              label="Rythme"
              value={quickServiceDraft.billingUnit}
              onChange={(e) =>
                setQuickServiceDraft((prev) => ({ ...prev, billingUnit: e.target.value }))
              }
            >
              <option value="ONE_OFF">Ponctuel</option>
              <option value="MONTHLY">Mensuel</option>
            </Select>
          </div>
          {quickServiceError ? <p className="mt-2 text-xs text-[var(--danger)]">{quickServiceError}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onQuickCreateService}
              disabled={quickServiceSaving || !isAdmin}
            >
              {quickServiceSaving ? 'Création…' : 'Créer & ajouter'}
            </Button>
          </div>
        </div>
        <Input
          placeholder="Rechercher un service"
          value={serviceSearch}
          onChange={(e) => {
            setServiceSearch(e.target.value);
            onLoadCatalogServices(e.target.value);
          }}
        />
        <div className="max-h-72 space-y-2 overflow-auto">
          {catalogSearchResults.map((svc) => (
            <div
              key={svc.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)]/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{svc.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{svc.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={serviceSelections[svc.id] !== undefined}
                  onChange={(e) =>
                    setServiceSelections((prev) => {
                      const next = { ...prev };
                      if (e.target.checked) next[svc.id] = next[svc.id] ?? 1;
                      else delete next[svc.id];
                      return next;
                    })
                  }
                />
                <Input
                  type="number"
                  className="w-20"
                  min={1}
                  value={serviceSelections[svc.id] ?? ''}
                  onChange={(e) =>
                    setServiceSelections((prev) => ({
                      ...prev,
                      [svc.id]: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="Qté"
                />
              </div>
            </div>
          ))}
          {catalogSearchResults.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Aucun service trouvé.</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={generateTasksOnAdd}
              onChange={(e) => setGenerateTasksOnAdd(e.target.checked)}
              disabled={!isAdmin}
            />
            Créer les tâches recommandées (templates)
          </label>
          {generateTasksOnAdd ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <SearchSelect
                  label="Assigner à"
                  items={memberItems}
                  value={taskAssigneeId}
                  onChange={setTaskAssigneeId}
                  disabled={!isAdmin}
                />
                <Input
                  label="Décalage échéance (jours)"
                  type="number"
                  min={0}
                  max={365}
                  value={taskDueOffsetDays}
                  onChange={(e) => setTaskDueOffsetDays(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--text-primary)]">Aperçu des tâches</p>
                {selectedServiceIds.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Sélectionne un service pour voir les templates.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedServiceIds.map((serviceId) => {
                      const svc = catalogSearchResults.find((item) => item.id === serviceId);
                      const templates = serviceTemplates[serviceId] ?? [];
                      const isLoading = templatesLoading[serviceId];
                      return (
                        <div
                          key={serviceId}
                          className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)] p-2"
                        >
                          <p className="text-xs font-semibold text-[var(--text-primary)]">
                            {svc?.name ?? `Service #${serviceId}`}
                          </p>
                          {isLoading ? (
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              Chargement des templates…
                            </p>
                          ) : templates.length ? (
                            <ul className="mt-1 space-y-1 text-[11px] text-[var(--text-secondary)]">
                              {templates.map((tpl) => (
                                <li key={tpl.id}>
                                  • {tpl.title}
                                  {tpl.phase ? ` · ${tpl.phase}` : ''}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              Aucun template pour ce service.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Les services seront ajoutés sans tâches associées.
            </p>
          )}
        </div>
        {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCloseModal}>
            Annuler
          </Button>
          <Button onClick={onAddServices} disabled={saving}>
            {saving ? 'Ajout…' : 'Ajouter au projet'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
