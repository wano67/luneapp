"use client";

import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { SearchSelect } from '@/components/ui/search-select';
import { Modal } from '@/components/ui/modal';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';
import type {
  ClientLite,
  MemberItem,
  ProjectAccessMember,
  AvailableMember,
  TaskItem,
  CatalogService,
  ServiceTemplate,
  ServiceItem,
  OrganizationUnitItem,
  QuickServiceDraft,
} from './setup-types';

const SetupServicesModal = dynamic(() => import('./SetupServicesModal'), { ssr: false });
const SetupAccessModal = dynamic(() => import('./SetupAccessModal'), { ssr: false });
const SetupUnitsModal = dynamic(() => import('./SetupUnitsModal'), { ssr: false });

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

export function SetupModals(props: SetupModalsProps) {
  const {
    activeSetupModal,
    accessModalOpen,
    unitsModalOpen,
    isAdmin,
    saving,
    modalError,
    hasClientId,
    onCloseModal,
    onCloseAccessModal,
    onCloseUnitsModal,
  } = props;

  const memberItems = useMemo(
    () => [{ code: '', label: 'Non assigné' }, ...props.members.map((m) => ({ code: m.userId, label: m.name ?? m.email }))],
    [props.members]
  );

  return (
    <>
      {/* ── Client ─────────────────────────────────────────────────────────── */}
      <Modal
        open={activeSetupModal === 'client'}
        onCloseAction={onCloseModal}
        title="Associer un client"
        description={props.clientCreateMode ? 'Crée un nouveau client et associe-le au projet.' : 'Sélectionne un client existant ou crée-en un nouveau.'}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={props.clientCreateMode ? 'ghost' : 'outline'} onClick={() => props.setClientCreateMode(false)}>Chercher</Button>
            <Button size="sm" variant={props.clientCreateMode ? 'outline' : 'ghost'} onClick={() => props.setClientCreateMode(true)}>Créer</Button>
          </div>
          {props.clientCreateMode ? (
            <div className="space-y-3">
              <Input label="Nom *" value={props.newClientName} onChange={(e) => props.setNewClientName(e.target.value)} placeholder="Nom du client" />
              <Input label="Email (optionnel)" type="email" value={props.newClientEmail} onChange={(e) => props.setNewClientEmail(e.target.value)} placeholder="email@exemple.com" />
            </div>
          ) : (
            <>
              <Input placeholder="Rechercher un client" value={props.clientSearch} onChange={(e) => { props.setClientSearch(e.target.value); props.onLoadClients(e.target.value); }} />
              <div className="max-h-64 space-y-2 overflow-auto">
                {props.clients.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)]/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{c.email ?? '—'}</p>
                    </div>
                    <input type="radio" name="client" checked={props.selectedClientId === c.id} onChange={() => props.setSelectedClientId(c.id)} />
                  </label>
                ))}
                {props.clients.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Aucun client trouvé.</p> : null}
              </div>
            </>
          )}
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>Annuler</Button>
            {props.clientCreateMode ? (
              <Button onClick={props.onCreateAndAttachClient} disabled={saving}>{saving ? 'Création…' : 'Créer & associer'}</Button>
            ) : (
              <Button onClick={props.onAttachClient} disabled={saving}>{saving ? 'Enregistrement…' : 'Associer'}</Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Deadline ───────────────────────────────────────────────────────── */}
      <Modal open={activeSetupModal === 'deadline'} onCloseAction={onCloseModal} title="Définir l'échéance" description="Renseigne les dates clés du projet.">
        <div className="space-y-3">
          <Input label="Début" type="date" value={props.startDateInput} onChange={(e) => props.setStartDateInput(e.target.value)} />
          <Input label="Fin" type="date" value={props.endDateInput} onChange={(e) => props.setEndDateInput(e.target.value)} />
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>Annuler</Button>
            <Button onClick={props.onUpdateDates} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Services (dynamic) ─────────────────────────────────────────────── */}
      {activeSetupModal === 'services' && (
        <SetupServicesModal
          isAdmin={isAdmin}
          saving={saving}
          modalError={modalError}
          catalogSearchResults={props.catalogSearchResults}
          serviceSearch={props.serviceSearch}
          serviceSelections={props.serviceSelections}
          generateTasksOnAdd={props.generateTasksOnAdd}
          taskAssigneeId={props.taskAssigneeId}
          taskDueOffsetDays={props.taskDueOffsetDays}
          serviceTemplates={props.serviceTemplates}
          templatesLoading={props.templatesLoading}
          selectedServiceIds={props.selectedServiceIds}
          quickServiceDraft={props.quickServiceDraft}
          quickServiceSaving={props.quickServiceSaving}
          quickServiceError={props.quickServiceError}
          services={props.services}
          members={props.members}
          setServiceSearch={props.setServiceSearch}
          setServiceSelections={props.setServiceSelections}
          setGenerateTasksOnAdd={props.setGenerateTasksOnAdd}
          setTaskAssigneeId={props.setTaskAssigneeId}
          setTaskDueOffsetDays={props.setTaskDueOffsetDays}
          setQuickServiceDraft={props.setQuickServiceDraft}
          onLoadCatalogServices={props.onLoadCatalogServices}
          onAddServices={props.onAddServices}
          onQuickCreateService={props.onQuickCreateService}
          onCloseModal={onCloseModal}
        />
      )}

      {/* ── Tasks ──────────────────────────────────────────────────────────── */}
      <Modal open={activeSetupModal === 'tasks'} onCloseAction={onCloseModal} title="Configurer les tâches" description="Assigne rapidement les tâches existantes.">
        <div className="space-y-3">
          {props.services.length === 0 ? <GuidedCtaCard title="Aucun service" description="Ajoute des services pour générer des tâches." primary={{ label: 'Ajouter des services', href: '#' }} /> : null}
          <div className="space-y-2">
            {props.tasks.filter((t) => t.status !== 'DONE').slice(0, 10).map((task) => (
              <div key={task.id} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-2)]/70 p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
                <div className="mt-2 flex gap-2">
                  <SearchSelect label="Assigné" items={memberItems} value={props.taskAssignments[task.id] ?? ''} onChange={(v) => props.setTaskAssignments((prev) => ({ ...prev, [task.id]: v }))} />
                  <Input type="date" value={task.dueDate ?? ''} onChange={(e) => void props.onUpdateTaskDueDate(task.id, e.target.value)} />
                </div>
              </div>
            ))}
            {props.tasks.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Aucune tâche.</p> : null}
          </div>
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>Annuler</Button>
            <Button onClick={props.onAssignTasks} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Team ───────────────────────────────────────────────────────────── */}
      <Modal open={activeSetupModal === 'team'} onCloseAction={onCloseModal} title="Ajouter des membres" description="Invite un membre de l'entreprise.">
        <div className="space-y-3">
          <Input label="Email" type="email" value={props.inviteEmail} onChange={(e) => props.setInviteEmail(e.target.value)} />
          <Select label="Rôle" value={props.inviteRole} onChange={(e) => props.setInviteRole(e.target.value)}>
            <option value="MEMBER">Membre</option>
            <option value="VIEWER">Viewer</option>
            <option value="ADMIN">Admin</option>
          </Select>
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>Annuler</Button>
            <Button onClick={props.onInviteMember} disabled={saving}>{saving ? 'Invitation…' : 'Inviter'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Documents ──────────────────────────────────────────────────────── */}
      <Modal open={activeSetupModal === 'documents'} onCloseAction={onCloseModal} title="Ajouter un document" description={hasClientId ? 'Charge un document lié au client.' : "Associe d'abord un client."}>
        <div className="space-y-3">
          <Select label="Catégorie" value={props.documentKind} onChange={(e) => props.setDocumentKind(e.target.value as 'Administratif' | 'Projet')}>
            <option value="Administratif">Administratif</option>
            <option value="Projet">Projet</option>
          </Select>
          <input type="file" onChange={(e) => props.setDocumentFile(e.target.files?.[0] ?? null)} className="text-sm text-[var(--text-secondary)]" />
          {modalError ? <p className="text-sm text-[var(--danger)]">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseModal}>Annuler</Button>
            <Button onClick={props.onUploadDocument} disabled={saving || !hasClientId}>{saving ? 'Upload…' : 'Uploader'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Tags ────────────────────────────────────────────────────────────── */}
      <Modal open={activeSetupModal === 'tags'} onCloseAction={onCloseModal} title="Tags du projet" description="Sélectionne les tags à associer au projet.">
        <div className="space-y-3">
          {props.tagsLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
          ) : props.availableTags.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Aucun tag disponible.</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Crée des tags dans Références pour les utiliser ici.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {props.availableTags.map((tag) => {
                const selected = props.selectedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => props.onToggleTag(tag.id)}
                    className={selected
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
            <Button variant="outline" onClick={onCloseModal}>Annuler</Button>
            <Button onClick={props.onUpdateTags} disabled={saving || props.tagsLoading}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Access (dynamic) ───────────────────────────────────────────────── */}
      {accessModalOpen && (
        <SetupAccessModal
          isAdmin={isAdmin}
          projectMembers={props.projectMembers}
          availableMembers={props.availableMembers}
          accessInfo={props.accessInfo}
          onAddProjectMember={props.onAddProjectMember}
          onRemoveProjectMember={props.onRemoveProjectMember}
          onCloseAccessModal={onCloseAccessModal}
        />
      )}

      {/* ── Units (dynamic) ────────────────────────────────────────────────── */}
      {unitsModalOpen && (
        <SetupUnitsModal
          isAdmin={isAdmin}
          organizationUnits={props.organizationUnits}
          unitDraftName={props.unitDraftName}
          unitDraftOrder={props.unitDraftOrder}
          unitErrors={props.unitErrors}
          teamInfo={props.teamInfo}
          unitDrafts={props.unitDrafts}
          members={props.members}
          setUnitDraftName={props.setUnitDraftName}
          setUnitDraftOrder={props.setUnitDraftOrder}
          setUnitDrafts={props.setUnitDrafts}
          onCreateUnit={props.onCreateUnit}
          onUpdateUnit={props.onUpdateUnit}
          onDeleteUnit={props.onDeleteUnit}
          onAssignMemberToUnit={props.onAssignMemberToUnit}
          onCloseUnitsModal={onCloseUnitsModal}
        />
      )}
    </>
  );
}
