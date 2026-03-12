import type { Dispatch, SetStateAction } from 'react';

export type ClientLite = { id: string; name: string; email: string | null };

export type MemberItem = {
  membershipId: string;
  userId: string;
  email: string;
  name?: string | null;
  role: string;
  organizationUnit?: { id: string; name: string } | null;
};

export type ProjectAccessMember = {
  membershipId: string;
  implicit?: boolean;
  role: string;
  user: { id: string; name: string | null; email: string | null };
};

export type AvailableMember = {
  membershipId: string;
  name?: string | null;
  email: string | null;
  role: string;
};

export type TaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

export type CatalogService = {
  id: string;
  code: string;
  name: string;
};

export type ServiceTemplate = {
  id: string;
  title: string;
  phase: string | null;
};

export type ServiceItem = {
  id: string;
  service: { name: string };
};

export type OrganizationUnitItem = {
  id: string;
  name: string;
  order: number;
};

export type QuickServiceDraft = {
  name: string;
  code: string;
  price: string;
  billingUnit: string;
};

export type SetupServicesModalProps = {
  isAdmin: boolean;
  saving: boolean;
  modalError: string | null;
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
  members: MemberItem[];
  setServiceSearch: (v: string) => void;
  setServiceSelections: Dispatch<SetStateAction<Record<string, number>>>;
  setGenerateTasksOnAdd: (v: boolean) => void;
  setTaskAssigneeId: (v: string) => void;
  setTaskDueOffsetDays: (v: string) => void;
  setQuickServiceDraft: Dispatch<SetStateAction<QuickServiceDraft>>;
  onLoadCatalogServices: (search: string) => void;
  onAddServices: () => void;
  onQuickCreateService: () => void;
  onCloseModal: () => void;
};

export type SetupAccessModalProps = {
  isAdmin: boolean;
  projectMembers: ProjectAccessMember[];
  availableMembers: AvailableMember[];
  accessInfo: string | null;
  onAddProjectMember: (membershipId: string) => void;
  onRemoveProjectMember: (membershipId: string) => void;
  onCloseAccessModal: () => void;
};

export type SetupUnitsModalProps = {
  isAdmin: boolean;
  organizationUnits: OrganizationUnitItem[];
  unitDraftName: string;
  unitDraftOrder: string;
  unitErrors: string | null;
  teamInfo: string | null;
  unitDrafts: Record<string, { name: string; order: string }>;
  members: MemberItem[];
  setUnitDraftName: (v: string) => void;
  setUnitDraftOrder: (v: string) => void;
  setUnitDrafts: Dispatch<SetStateAction<Record<string, { name: string; order: string }>>>;
  onCreateUnit: () => void;
  onUpdateUnit: (id: string) => void;
  onDeleteUnit: (id: string) => void;
  onAssignMemberToUnit: (membershipId: string, unitId: string | null) => void;
  onCloseUnitsModal: () => void;
};
