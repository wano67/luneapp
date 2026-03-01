"use client";

import type { Dispatch, SetStateAction } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { InitialsAvatar } from '@/components/pro/projects/workspace-ui';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';
import { sanitizeEuroInput } from '@/lib/money';

// ─── Local types ──────────────────────────────────────────────────────────────

type ClientLite = { id: string; name: string; email: string | null };

type MemberItem = {
  membershipId: string;
  userId: string;
  email: string;
  name?: string | null;
  role: string;
  organizationUnit?: { id: string; name: string } | null;
};

type ProjectAccessMember = {
  membershipId: string;
  implicit?: boolean;
  role: string;
  user: { id: string; name: string | null; email: string | null };
};

type AvailableMember = {
  membershipId: string;
  name?: string | null;
  email: string | null;
  role: string;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

type CatalogService = {
  id: string;
  code: string;
  name: string;
};

type ServiceTemplate = {
  id: string;
  title: string;
  phase: string | null;
};

type ServiceItem = {
  id: string;
  service: { name: string };
};

type OrganizationUnitItem = {
  id: string;
  name: string;
  order: number;
};

type QuickServiceDraft = {
  name: string;
  code: string;
  price: string;
  billingUnit: string;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export type SetupModalsProps = {
  // Routing
  activeSetupModal: null | 'client' | 'deadline' | 'services' | 'tasks' | 'team' | 'documents' | 'tags';
  accessModalOpen: boolean;
  unitsModalOpen: boolean;
  isAdmin: boolean;
  saving: boolean;
  modalError: string | null;
  hasClientId: boolean;

  // Client modal
  clients: ClientLite[];
  clientSearch: string;
  selectedClientId: string | null;
  clientCreateMode: boolean;
  newClientName: string;
  newClientEmail: string;
  setClientSearch: (v: string) => void;
  setSelectedClientId: (id: string) => void;
  setClientCreateMode: (v: boolean) => void;
  setNewClientName: (v: string) => void;
  setNewClientEmail: (v: string) => void;
  onLoadClients: (search: string) => void;
  onAttachClient: () => void;
  onCreateAndAttachClient: () => void;

  // Deadline modal
  startDateInput: string;
  endDateInput: string;
  setStartDateInput: (v: string) => void;
  setEndDateInput: (v: string) => void;
  onUpdateDates: () => void;

  // Services modal
  catalogSearchResults: CatalogService[];
  serviceSearch: string;
  serviceSelections: Record<string, number>;
  generateTasksOnAdd: boolean;
  taskAssigneeId: string;
  taskDueOffsetDays: string;
  serviceTemplates: Record<string, ServiceTemplate[]>;
  templatesLoading: Record<string, boolean>;
  selectedServiceIds: string[];
  quickServiceDraft: QuickServiceDraft;
  quickServiceSaving: boolean;
  quickServiceError: string | null;
  services: ServiceItem[];
  setServiceSearch: (v: string) => void;
  setServiceSelections: Dispatch<SetStateAction<Record<string, number>>>;
  setGenerateTasksOnAdd: (v: boolean) => void;
  setTaskAssigneeId: (v: string) => void;
  setTaskDueOffsetDays: (v: string) => void;
  setQuickServiceDraft: Dispatch<SetStateAction<QuickServiceDraft>>;
  members: MemberItem[];
  onLoadCatalogServices: (search: string) => void;
  onAddServices: () => void;
  onQuickCreateService: () => void;

  // Tasks modal
  tasks: TaskItem[];
  taskAssignments: Record<string, string>;
  setTaskAssignments: Dispatch<SetStateAction<Record<string, string>>>;
  onUpdateTaskDueDate: (taskId: string, value: string) => Promise<void>;
  onAssignTasks: () => void;

  // Team modal
  inviteEmail: string;
  inviteRole: string;
  setInviteEmail: (v: string) => void;
  setInviteRole: (v: string) => void;
  onInviteMember: () => void;

  // Documents modal
  documentKind: 'Administratif' | 'Projet';
  setDocumentKind: (v: 'Administratif' | 'Projet') => void;
  setDocumentFile: (f: File | null) => void;
  onUploadDocument: () => void;

  // Tags modal
  availableTags: Array<{ id: string; name: string }>;
  selectedTagIds: Set<string>;
  tagsLoading: boolean;
  onToggleTag: (id: string) => void;
  onUpdateTags: () => void;

  // Access modal
  projectMembers: ProjectAccessMember[];
  availableMembers: AvailableMember[];
  accessInfo: string | null;
  onAddProjectMember: (membershipId: string) => void;
  onRemoveProjectMember: (membershipId: string) => void;

  // Units modal
  organizationUnits: OrganizationUnitItem[];
  unitDraftName: string;
  unitDraftOrder: string;
  unitErrors: string | null;
  teamInfo: string | null;
  unitDrafts: Record<string, { name: string; order: string }>;
  setUnitDraftName: (v: string) => void;
  setUnitDraftOrder: (v: string) => void;
  setUnitDrafts: Dispatch<SetStateAction<Record<string, { name: string; order: string }>>>;
  onCreateUnit: () => void;
  onUpdateUnit: (id: string) => void;
  onDeleteUnit: (id: string) => void;
  onAssignMemberToUnit: (membershipId: string, unitId: string | null) => void;

  // Close handlers
  onCloseModal: () => void;
  onCloseAccessModal: () => void;
  onCloseUnitsModal: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SetupModals({
  activeSetupModal,
  accessModalOpen,
  unitsModalOpen,
  isAdmin,
  saving,
  modalError,
  hasClientId,
  clients,
  clientSearch,
  selectedClientId,
  clientCreateMode,
  newClientName,
  newClientEmail,
  setClientSearch,
  setSelectedClientId,
  setClientCreateMode,
  setNewClientName,
  setNewClientEmail,
  onLoadClients,
  onAttachClient,
  onCreateAndAttachClient,
  startDateInput,
  endDateInput,
  setStartDateInput,
  setEndDateInput,
  onUpdateDates,
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
  services,
  setServiceSearch,
  setServiceSelections,
  setGenerateTasksOnAdd,
  setTaskAssigneeId,
  setTaskDueOffsetDays,
  setQuickServiceDraft,
  members,
  onLoadCatalogServices,
  onAddServices,
  onQuickCreateService,
  tasks,
  taskAssignments,
  setTaskAssignments,
  onUpdateTaskDueDate,
  onAssignTasks,
  inviteEmail,
  inviteRole,
  setInviteEmail,
  setInviteRole,
  onInviteMember,
  documentKind,
  setDocumentKind,
  setDocumentFile,
  onUploadDocument,
  availableTags,
  selectedTagIds,
  tagsLoading,
  onToggleTag,
  onUpdateTags,
  projectMembers,
  availableMembers,
  accessInfo,
  onAddProjectMember,
  onRemoveProjectMember,
  organizationUnits,
  unitDraftName,
  unitDraftOrder,
  unitErrors,
  teamInfo,
  unitDrafts,
  setUnitDraftName,
  setUnitDraftOrder,
  setUnitDrafts,
  onCreateUnit,
  onUpdateUnit,
  onDeleteUnit,
  onAssignMemberToUnit,
  onCloseModal,
  onCloseAccessModal,
  onCloseUnitsModal,
}: SetupModalsProps) {
  return (
    <>
      {/* ── Client ─────────────────────────────────────────────────────────── */}
      <Modal
        open={activeSetupModal === 'client'}
        onCloseAction={onCloseModal}
        title="Associer un client"
        description={clientCreateMode ? 'Crée un nouveau client et associe-le au projet.' : 'Sélectionne un client existant ou crée-en un nouveau.'}
      >
        <div className="space-y-3">
          {/* Toggle Chercher / Créer */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={clientCreateMode ? 'ghost' : 'outline'}
              onClick={() => setClientCreateMode(false)}
            >
              Chercher
            </Button>
            <Button
              size="sm"
              variant={clientCreateMode ? 'outline' : 'ghost'}
              onClick={() => setClientCreateMode(true)}
            >
              Créer
            </Button>
          </div>

          {clientCreateMode ? (
            /* ── Mode création ── */
            <div className="space-y-3">
              <Input
                label="Nom *"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nom du client"
              />
              <Input
                label="Email (optionnel)"
                type="email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
            </div>
          ) : (
            /* ── Mode recherche ── */
            <>
              <Input
                placeholder="Rechercher un client"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  onLoadClients(e.target.value);
                }}
              />
              <div className="max-h-64 space-y-2 overflow-auto">
                {clients.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)]/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{c.email ?? '—'}</p>
                    </div>
                    <input
                      type="radio"
                      name="client"
                      checked={selectedClientId === c.id}
                      onChange={() => setSelectedClientId(c.id)}
                    />
                  </label>
                ))}
                {clients.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Aucun client trouvé.</p>
                ) : null}
              </div>
            </>
          )}

          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>
              Annuler
            </Button>
            {clientCreateMode ? (
              <Button onClick={onCreateAndAttachClient} disabled={saving}>
                {saving ? 'Création…' : 'Créer & associer'}
              </Button>
            ) : (
              <Button onClick={onAttachClient} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Associer'}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Deadline ───────────────────────────────────────────────────────── */}
      <Modal
        open={activeSetupModal === 'deadline'}
        onCloseAction={onCloseModal}
        title="Définir l'échéance"
        description="Renseigne les dates clés du projet."
      >
        <div className="space-y-3">
          <Input
            label="Début"
            type="date"
            value={startDateInput}
            onChange={(e) => setStartDateInput(e.target.value)}
          />
          <Input
            label="Fin"
            type="date"
            value={endDateInput}
            onChange={(e) => setEndDateInput(e.target.value)}
          />
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>
              Annuler
            </Button>
            <Button onClick={onUpdateDates} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Services ───────────────────────────────────────────────────────── */}
      <Modal
        open={activeSetupModal === 'services'}
        onCloseAction={onCloseModal}
        title="Ajouter des services au projet"
        description="Sélectionne les services du catalogue."
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
                  <Select
                    label="Assigner à"
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    disabled={!isAdmin}
                  >
                    <option value="">Non assigné</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.email}
                      </option>
                    ))}
                  </Select>
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

      {/* ── Tasks ──────────────────────────────────────────────────────────── */}
      <Modal
        open={activeSetupModal === 'tasks'}
        onCloseAction={onCloseModal}
        title="Configurer les tâches"
        description="Assigne rapidement les tâches existantes."
      >
        <div className="space-y-3">
          {services.length === 0 ? (
            <GuidedCtaCard
              title="Aucun service"
              description="Ajoute des services pour générer des tâches."
              primary={{ label: 'Ajouter des services', href: '#' }}
            />
          ) : null}
          <div className="space-y-2">
            {tasks
              .filter((t) => t.status !== 'DONE')
              .slice(0, 10)
              .map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-2)]/70 p-3"
                >
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
                  <div className="mt-2 flex gap-2">
                    <Select
                      value={taskAssignments[task.id] ?? ''}
                      onChange={(e) =>
                        setTaskAssignments((prev) => ({ ...prev, [task.id]: e.target.value }))
                      }
                    >
                      <option value="">Non assigné</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.email}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="date"
                      value={task.dueDate ?? ''}
                      onChange={(e) => void onUpdateTaskDueDate(task.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            {tasks.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Aucune tâche.</p>
            ) : null}
          </div>
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>
              Annuler
            </Button>
            <Button onClick={onAssignTasks} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Team ───────────────────────────────────────────────────────────── */}
      <Modal
        open={activeSetupModal === 'team'}
        onCloseAction={onCloseModal}
        title="Ajouter des membres"
        description="Invite un membre de l'entreprise."
      >
        <div className="space-y-3">
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select label="Rôle" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <option value="MEMBER">Membre</option>
            <option value="VIEWER">Viewer</option>
            <option value="ADMIN">Admin</option>
          </Select>
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>
              Annuler
            </Button>
            <Button onClick={onInviteMember} disabled={saving}>
              {saving ? 'Invitation…' : 'Inviter'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Documents ──────────────────────────────────────────────────────── */}
      <Modal
        open={activeSetupModal === 'documents'}
        onCloseAction={onCloseModal}
        title="Ajouter un document"
        description={hasClientId ? 'Charge un document lié au client.' : "Associe d'abord un client."}
      >
        <div className="space-y-3">
          <Select
            label="Catégorie"
            value={documentKind}
            onChange={(e) => setDocumentKind(e.target.value as 'Administratif' | 'Projet')}
          >
            <option value="Administratif">Administratif</option>
            <option value="Projet">Projet</option>
          </Select>
          <input
            type="file"
            onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
            className="text-sm text-[var(--text-secondary)]"
          />
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>
              Annuler
            </Button>
            <Button onClick={onUploadDocument} disabled={saving || !hasClientId}>
              {saving ? 'Upload…' : 'Uploader'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Tags ────────────────────────────────────────────────────────────── */}
      <Modal
        open={activeSetupModal === 'tags'}
        onCloseAction={onCloseModal}
        title="Tags du projet"
        description="Sélectionne les tags à associer au projet."
      >
        <div className="space-y-3">
          {tagsLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
          ) : availableTags.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Aucun tag disponible.</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Crée des tags dans Références pour les utiliser ici.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const selected = selectedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggleTag(tag.id)}
                    className={
                      selected
                        ? 'rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 text-sm font-medium text-[var(--accent)] transition'
                        : 'rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-sm text-[var(--text-secondary)] transition hover:border-[var(--accent)]'
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>
              Annuler
            </Button>
            <Button onClick={onUpdateTags} disabled={saving || tagsLoading}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Access ─────────────────────────────────────────────────────────── */}
      <Modal
        open={accessModalOpen}
        onCloseAction={onCloseAccessModal}
        title="Accès au projet"
        description="Ajoute ou retire les membres autorisés à voir ce projet."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Accès actuel</p>
            {projectMembers.length ? (
              <div className="space-y-2">
                {projectMembers.map((member) => {
                  const implicit = member.implicit || member.role === 'OWNER' || member.role === 'ADMIN';
                  return (
                    <div
                      key={member.membershipId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <InitialsAvatar name={member.user.name} email={member.user.email} size={24} />
                        <div className="min-w-0">
                          <p className="truncate text-[var(--text-primary)]">
                            {member.user.name ?? member.user.email}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)]">{member.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {implicit ? <Badge variant="neutral">Accès implicite</Badge> : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRemoveProjectMember(member.membershipId)}
                          disabled={!isAdmin || implicit}
                        >
                          Retirer
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Aucun membre associé.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Ajouter un collaborateur</p>
            {availableMembers.length ? (
              <div className="space-y-2">
                {availableMembers.map((member) => (
                  <div
                    key={member.membershipId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <InitialsAvatar name={member.name} email={member.email} size={24} />
                      <div className="min-w-0">
                        <p className="truncate text-[var(--text-primary)]">
                          {member.name ?? member.email}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{member.role}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onAddProjectMember(member.membershipId)}
                      disabled={!isAdmin}
                    >
                      Ajouter
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Tous les membres sont déjà associés.</p>
            )}
          </div>
          {accessInfo ? <p className="text-sm text-[var(--success)]">{accessInfo}</p> : null}
          <div className="flex justify-end">
            <Button variant="outline" onClick={onCloseAccessModal}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Units (pôles) ──────────────────────────────────────────────────── */}
      <Modal
        open={unitsModalOpen}
        onCloseAction={onCloseUnitsModal}
        title="Gérer les pôles"
        description="Créez des pôles et assignez les membres."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Nouveau pôle</p>
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
              <Input
                placeholder="Nom du pôle"
                value={unitDraftName}
                onChange={(e) => setUnitDraftName(e.target.value)}
              />
              <Input
                placeholder="Ordre"
                type="number"
                value={unitDraftOrder}
                onChange={(e) => setUnitDraftOrder(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={onCreateUnit} disabled={!isAdmin}>
              Ajouter
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Pôles existants</p>
            {organizationUnits.length ? (
              <div className="space-y-2">
                {organizationUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-center">
                      <Input
                        value={unitDrafts[unit.id]?.name ?? unit.name}
                        onChange={(e) =>
                          setUnitDrafts((prev) => ({
                            ...prev,
                            [unit.id]: {
                              name: e.target.value,
                              order: prev[unit.id]?.order ?? String(unit.order),
                            },
                          }))
                        }
                      />
                      <Input
                        type="number"
                        value={unitDrafts[unit.id]?.order ?? String(unit.order)}
                        onChange={(e) =>
                          setUnitDrafts((prev) => ({
                            ...prev,
                            [unit.id]: {
                              name: prev[unit.id]?.name ?? unit.name,
                              order: e.target.value,
                            },
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateUnit(unit.id)}
                        disabled={!isAdmin}
                      >
                        Enregistrer
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteUnit(unit.id)}
                        disabled={!isAdmin}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">Aucun pôle créé.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Assigner les membres</p>
            {members.map((member) => (
              <div
                key={member.membershipId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
              >
                <span className="text-sm text-[var(--text-primary)]">
                  {member.name ?? member.email}
                </span>
                <Select
                  value={member.organizationUnit?.id ?? ''}
                  onChange={(e) => onAssignMemberToUnit(member.membershipId, e.target.value || null)}
                  disabled={!isAdmin}
                >
                  <option value="">Sans pôle</option>
                  {organizationUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          {unitErrors ? <p className="text-sm text-[var(--danger)]">{unitErrors}</p> : null}
          {teamInfo ? <p className="text-sm text-[var(--success)]">{teamInfo}</p> : null}
          <div className="flex justify-end">
            <Button variant="outline" onClick={onCloseUnitsModal}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
