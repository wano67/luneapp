"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { TabsPills } from '@/components/pro/TabsPills';
import { cn } from '@/lib/cn';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import {
  getInvoiceStatusLabelFR,
  getPaymentStatusLabelFR,
  getProjectDepositStatusLabelFR,
  getProjectQuoteStatusLabelFR,
  getQuoteStatusLabelFR,
} from '@/lib/billingStatus';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';
import { ProjectSetupChecklist, type ChecklistItem } from '@/components/pro/projects/ProjectSetupChecklist';
import { ServiceProgressRow } from '@/components/pro/projects/ServiceProgressRow';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';
import {
  getProjectScopeLabelFR,
  getProjectScopeVariant,
  getProjectStatusLabelFR,
  isProjectOverdue,
  shouldWarnProjectCompletion,
} from '@/lib/projectStatusUi';

type ProjectDetail = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  status: string;
  quoteStatus?: string | null;
  depositStatus?: string | null;
  depositPaidAt?: string | null;
  billingQuoteId?: string | null;
  billingSummary?: BillingSummary | null;
  valueCents?: string | null;
  archivedAt?: string | null;
  startDate: string | null;
  endDate: string | null;
  prestationsText?: string | null;
  updatedAt: string;
  tasksSummary?: { total: number; open: number; done: number; progressPct: number };
  projectServices?: Array<{
    id: string;
    serviceId: string;
    priceCents: string | null;
    quantity: number;
    notes: string | null;
    service: { id: string; code: string; name: string; type: string | null };
  }>;
};

type ServiceItem = {
  id: string;
  projectId: string;
  serviceId: string;
  priceCents: string | null;
  quantity: number;
  notes: string | null;
  titleOverride?: string | null;
  description?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
  billingUnit?: string | null;
  unitLabel?: string | null;
  position?: number;
  service: { id: string; code: string; name: string; type: string | null };
};

type CatalogService = {
  id: string;
  code: string;
  name: string;
  type: string | null;
  defaultPriceCents: string | null;
  tjmCents: string | null;
  durationHours: number | null;
};

type WizardLineSource = 'catalog' | 'custom';

type WizardLine = {
  id: string;
  source: WizardLineSource;
  serviceId?: string | null;
  code?: string | null;
  title: string;
  description: string;
  quantity: number;
  unitPriceCents: number | null;
  priceLocked: boolean;
};

type ServiceTemplate = {
  id: string;
  title: string;
  phase: string | null;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeUserId: string | null;
  projectServiceId: string | null;
  projectId: string | null;
  progress?: number;
};

type MemberItem = {
  membershipId: string;
  userId: string;
  email: string;
  name?: string | null;
  role: string;
  organizationUnit?: { id: string; name: string } | null;
};
type ClientDocument = { id: string; title: string };
type ClientLite = { id: string; name: string; email: string | null };

type ProjectAccessMember = {
  membershipId: string;
  user: { id: string; name: string | null; email: string | null };
  role: string;
  organizationUnit: { id: string; name: string } | null;
  createdAt: string;
  implicit?: boolean;
};

type OrganizationUnitItem = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type ActivityItem = {
  type: 'TASK_STATUS_UPDATED';
  taskId: string;
  title: string;
  status: string;
  serviceName?: string | null;
  occurredAt: string | null;
  actor: { id: string; name: string | null; email: string | null } | null;
};

type BillingSummary = {
  source: 'QUOTE' | 'PRICING';
  referenceQuoteId: string | null;
  currency: string;
  totalCents: string;
  depositPercent: number;
  depositCents: string;
  balanceCents: string;
  alreadyInvoicedCents: string;
  alreadyPaidCents: string;
  remainingToCollectCents: string;
  remainingCents: string;
};

type QuoteItem = {
  id: string;
  status: string;
  number: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  depositPercent: number;
  currency: string;
  issuedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
  items?: Array<{
    id: string;
    serviceId: string | null;
    label: string;
    description?: string | null;
    quantity: number;
    unitPriceCents: string;
    totalCents: string;
  }>;
};

type InvoiceItem = {
  id: string;
  status: string;
  number: string | null;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  paidCents?: string;
  remainingCents?: string;
  paymentStatus?: string | null;
  lastPaidAt?: string | null;
  createdAt: string;
  quoteId: string | null;
};

type EditableLine = {
  id: string;
  label: string;
  description: string;
  quantity: string;
  unitPrice: string;
  serviceId?: string | null;
  productId?: string | null;
};

type InvoiceLineItem = {
  id: string;
  serviceId: string | null;
  productId: string | null;
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: string;
  totalCents: string;
};

type PaymentItem = {
  id: string;
  amountCents: string;
  paidAt: string;
  method: string;
  reference: string | null;
  note: string | null;
  createdBy?: { id: string; name?: string | null; email?: string | null } | null;
  createdAt: string;
};

type QuoteEditorState = {
  quoteId: string;
  status: string;
  number: string | null;
  issuedAt: string;
  expiresAt: string;
  note: string;
  lines: EditableLine[];
};

type InvoiceEditorState = {
  invoiceId: string;
  status: string;
  number: string | null;
  issuedAt: string;
  dueAt: string;
  note: string;
  lines: EditableLine[];
};

type InvoiceDetail = InvoiceItem & {
  note: string | null;
  items: InvoiceLineItem[];
};

const tabs = [
  { key: 'overview', label: 'Vue d’ensemble' },
  { key: 'work', label: 'Travail' },
  { key: 'team', label: 'Équipe' },
  { key: 'billing', label: 'Facturation' },
  { key: 'files', label: 'Documents' },
];

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

function formatTaskStatus(status: string) {
  if (status === 'DONE') return 'Terminée';
  if (status === 'IN_PROGRESS') return 'En cours';
  if (status === 'TODO') return 'À faire';
  return status || '—';
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  TODO: 'border-slate-200 bg-slate-50 text-slate-700',
};

function getStatusBadgeClasses(status: string) {
  return STATUS_BADGE_STYLES[status] ?? 'border-[var(--border)]/60 bg-[var(--surface-2)] text-[var(--text-secondary)]';
}

function getInitials(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split('@')[0]?.trim() || '';
  if (!base) return '??';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function InitialsAvatar({
  name,
  email,
  size = 28,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  const initials = getInitials(name, email);
  return (
    <span
      className="flex items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-secondary)]"
      style={{ width: size, height: size }}
      aria-label={name ?? email ?? 'Utilisateur'}
    >
      {initials}
    </span>
  );
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function parseCents(value?: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function parseEuroInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function formatEuroInput(value?: string | null): string {
  const cents = parseCents(value);
  if (cents == null) return '';
  return (cents / 100).toString();
}

function getInvoicePaidCents(invoice: InvoiceItem): number {
  const paid = invoice.paidCents != null ? Number(invoice.paidCents) : NaN;
  if (Number.isFinite(paid)) return paid;
  return invoice.status === 'PAID' ? Number(invoice.totalCents) : 0;
}

function getInvoiceRemainingCents(invoice: InvoiceItem): number {
  const remaining = invoice.remainingCents != null ? Number(invoice.remainingCents) : NaN;
  if (Number.isFinite(remaining)) return Math.max(0, remaining);
  const paid = getInvoicePaidCents(invoice);
  return Math.max(0, Number(invoice.totalCents) - paid);
}

function normalizePaymentStatus(value?: string | null): 'UNPAID' | 'PARTIAL' | 'PAID' | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === 'PARTIALLY_PAID') return 'PARTIAL';
  if (upper === 'PARTIAL') return 'PARTIAL';
  if (upper === 'PAID') return 'PAID';
  if (upper === 'UNPAID') return 'UNPAID';
  return null;
}

function getInvoicePaymentStatus(invoice: InvoiceItem): 'UNPAID' | 'PARTIAL' | 'PAID' {
  const normalized = normalizePaymentStatus(invoice.paymentStatus);
  if (normalized) return normalized;
  const paid = getInvoicePaidCents(invoice);
  const total = Number(invoice.totalCents);
  if (paid <= 0) return 'UNPAID';
  if (paid >= total) return 'PAID';
  return 'PARTIAL';
}

function toEditableLine(item: {
  id: string;
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: string;
  serviceId?: string | null;
  productId?: string | null;
}): EditableLine {
  return {
    id: item.id,
    label: item.label,
    description: item.description ?? '',
    quantity: String(item.quantity),
    unitPrice: formatEuroInput(item.unitPriceCents),
    serviceId: item.serviceId ?? null,
    productId: item.productId ?? null,
  };
}

const UI = {
  page: 'mx-auto max-w-6xl space-y-6 px-4 py-6',
  section: 'rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm',
  sectionSoft: 'rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 p-3',
  sectionTitle: 'text-sm font-semibold text-[var(--text-primary)]',
  sectionSubtitle: 'text-xs text-[var(--text-secondary)]',
  label: 'text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]',
  value: 'text-sm font-semibold text-[var(--text-primary)]',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  WIRE: 'Virement',
  CARD: 'Carte',
  CHECK: 'Chèque',
  CASH: 'Espèces',
  OTHER: 'Autre',
};

const WIZARD_STEPS = ['Prestations', 'Tâches', 'Résumé'] as const;
const OVERVIEW_PREVIEW_COUNT = 3;
const OVERVIEW_ACTIVITY_COUNT = 5;
const OVERVIEW_MEMBERS_COUNT = 6;

function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn(UI.section, className)}>{children}</Card>
  );
}

function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | null;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <p className={UI.sectionTitle}>{title}</p>
        {subtitle ? <p className={UI.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  align = 'left',
}: {
  label: string;
  value: string;
  highlight?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        UI.sectionSoft,
        align === 'right' ? 'text-right' : 'text-left',
        highlight ? 'border-[var(--accent-strong)]/40 bg-[var(--surface)]' : ''
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        {label}
      </p>
      <p className={cn('text-lg font-semibold text-[var(--text-primary)]', highlight ? 'text-xl' : '')}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-1 text-xs text-[var(--text-secondary)]">
      <span className="font-semibold uppercase tracking-[0.14em]">{label}</span>
      <span className="text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function StickyHeaderActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-3 z-10 -mx-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--surface)]/90 px-3 py-2 shadow-sm backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none">
      {children}
    </div>
  );
}

export function ProjectWorkspace({ businessId, projectId }: { businessId: string; projectId: string }) {
  const searchParams = useSearchParams();
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.isAdmin ?? false;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectAccessMember[]>([]);
  const [organizationUnits, setOrganizationUnits] = useState<OrganizationUnitItem[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [billingSettings, setBillingSettings] = useState<{
    defaultDepositPercent: number;
    vatEnabled: boolean;
    vatRatePercent: number;
    paymentTermsDays: number;
    cgvText?: string | null;
    paymentTermsText?: string | null;
    lateFeesText?: string | null;
    fixedIndemnityText?: string | null;
    legalMentionsText?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingInfo, setBillingInfo] = useState<string | null>(null);
  const [quoteEditor, setQuoteEditor] = useState<QuoteEditorState | null>(null);
  const [invoiceEditor, setInvoiceEditor] = useState<InvoiceEditorState | null>(null);
  const [quoteEditError, setQuoteEditError] = useState<string | null>(null);
  const [invoiceEditError, setInvoiceEditError] = useState<string | null>(null);
  const [quoteEditing, setQuoteEditing] = useState(false);
  const [invoiceEditing, setInvoiceEditing] = useState(false);
  const [stagedInvoiceModal, setStagedInvoiceModal] = useState<{
    kind: 'DEPOSIT' | 'MID' | 'FINAL';
    mode: 'PERCENT' | 'AMOUNT';
    value: string;
  } | null>(null);
  const [stagedInvoiceError, setStagedInvoiceError] = useState<string | null>(null);
  const [stagedInvoiceLoading, setStagedInvoiceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'work' | 'team' | 'billing' | 'files'>('overview');
  const [statusFilter, setStatusFilter] = useState<'TODO' | 'IN_PROGRESS' | 'DONE' | 'all'>('all');
  const [showAllServicesOverview, setShowAllServicesOverview] = useState(false);
  const [showAllActionsOverview, setShowAllActionsOverview] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [unitsModalOpen, setUnitsModalOpen] = useState(false);
  const [unitDraftName, setUnitDraftName] = useState('');
  const [unitDraftOrder, setUnitDraftOrder] = useState('0');
  const [unitErrors, setUnitErrors] = useState<string | null>(null);
  const [unitDrafts, setUnitDrafts] = useState<Record<string, { name: string; order: string }>>({});
  const [accessInfo, setAccessInfo] = useState<string | null>(null);
  const [teamInfo, setTeamInfo] = useState<string | null>(null);
  const [taskGroupExpanded, setTaskGroupExpanded] = useState<Record<string, boolean>>({});
  const [activeSetupModal, setActiveSetupModal] = useState<
    null | 'client' | 'deadline' | 'services' | 'tasks' | 'team' | 'documents'
  >(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [catalogSearchResults, setCatalogSearchResults] = useState<CatalogService[]>([]);
  const [saving, setSaving] = useState(false);
  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');
  const [serviceSelections, setServiceSelections] = useState<Record<string, number>>({});
  const [serviceDrafts, setServiceDrafts] = useState<
    Record<
      string,
      {
        quantity: string;
        price: string;
        title: string;
        description: string;
        discountType: string;
        discountValue: string;
        billingUnit: string;
        unitLabel: string;
      }
    >
  >({});
  const [lineSavingId, setLineSavingId] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [quoteActionId, setQuoteActionId] = useState<string | null>(null);
  const [invoiceActionId, setInvoiceActionId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ invoice: InvoiceItem } | null>(null);
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentDeletingId, setPaymentDeletingId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paidAt: '',
    method: 'WIRE',
    reference: '',
    note: '',
  });
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  const [quoteWizardStep, setQuoteWizardStep] = useState(0);
  const [quoteWizardLines, setQuoteWizardLines] = useState<WizardLine[]>([]);
  const [quoteWizardSearch, setQuoteWizardSearch] = useState('');
  const [quoteWizardGenerateTasks, setQuoteWizardGenerateTasks] = useState(true);
  const [quoteWizardAssigneeId, setQuoteWizardAssigneeId] = useState('');
  const [quoteWizardDueOffsetDays, setQuoteWizardDueOffsetDays] = useState('');
  const [quoteWizardError, setQuoteWizardError] = useState<string | null>(null);
  const [quoteWizardInfo, setQuoteWizardInfo] = useState<string | null>(null);
  const [quoteWizardSaving, setQuoteWizardSaving] = useState(false);
  const [quoteWizardResult, setQuoteWizardResult] = useState<{
    quoteId: string;
    pdfUrl: string;
    downloadUrl: string;
  } | null>(null);
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string>>({});
  const [serviceTemplates, setServiceTemplates] = useState<Record<string, ServiceTemplate[]>>({});
  const [templatesLoading, setTemplatesLoading] = useState<Record<string, boolean>>({});
  const [generateTasksOnAdd, setGenerateTasksOnAdd] = useState(true);
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueOffsetDays, setTaskDueOffsetDays] = useState('');
  const [openServiceTasks, setOpenServiceTasks] = useState<Record<string, boolean>>({});
  const [taskUpdating, setTaskUpdating] = useState<Record<string, boolean>>({});
  const [templatesApplying, setTemplatesApplying] = useState<Record<string, boolean>>({});
  const [quoteDateEditor, setQuoteDateEditor] = useState<{
    quoteId: string;
    number: string | null;
    status: string;
    signedAt: string;
  } | null>(null);
  const [cancelQuoteEditor, setCancelQuoteEditor] = useState<{
    quoteId: string;
    number: string | null;
    status: string;
    reason: string;
  } | null>(null);
  const [cancelQuoteError, setCancelQuoteError] = useState<string | null>(null);
  const [cancelQuoteSaving, setCancelQuoteSaving] = useState(false);
  const [invoiceDateEditor, setInvoiceDateEditor] = useState<{
    invoiceId: string;
    number: string | null;
    status: string;
    paidAt: string;
  } | null>(null);
  const [depositDateEditorOpen, setDepositDateEditorOpen] = useState(false);
  const [depositPaidDraft, setDepositPaidDraft] = useState('');
  const [dateModalError, setDateModalError] = useState<string | null>(null);
  const [dateModalSaving, setDateModalSaving] = useState(false);
  const [referenceUpdatingId, setReferenceUpdatingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState<'Administratif' | 'Projet'>('Administratif');
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [draggingServiceId, setDraggingServiceId] = useState<string | null>(null);
  const [dragOverServiceId, setDragOverServiceId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [prestationsDraft, setPrestationsDraft] = useState('');
  const [prestationsSaving, setPrestationsSaving] = useState(false);
  const [prestationsError, setPrestationsError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentNotice) return;
    const timer = setTimeout(() => setPaymentNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [paymentNotice]);

  const closeModal = () => {
    setActiveSetupModal(null);
    setModalError(null);
    setSaving(false);
    setDocumentFile(null);
  };

  const updateTaskDueDate = async (taskId: string, value: string) => {
    try {
      setModalError(null);
      const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: value || null }),
      });
      if (!res.ok) {
        setModalError(res.error ?? 'Impossible de mettre à jour la date.');
        return;
      }
      await loadTasks();
    } catch (err) {
      setModalError(getErrorMessage(err));
    }
  };

  const updateTask = async (taskId: string, payload: Record<string, unknown>) => {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setTaskUpdating((prev) => ({ ...prev, [taskId]: true }));
    try {
      setBillingError(null);
      const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setBillingError(res.error ?? 'Impossible de mettre à jour la tâche.');
        return;
      }
      await loadTasks();
      if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
        await loadActivity();
      }
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setTaskUpdating((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const loadProject = useCallback(async (): Promise<string | null> => {
    const res = await fetchJson<{ item: ProjectDetail }>(`/api/pro/businesses/${businessId}/projects/${projectId}`);
    if (!res.ok || !res.data) {
      setProject(null);
      setError(res.error ?? 'Projet introuvable');
      return null;
    }
    setProject(res.data.item);
    return res.data.item.clientId ?? null;
  }, [businessId, projectId]);

  useEffect(() => {
    if (!project) return;
    setPrestationsDraft(project.prestationsText ?? '');
    setPrestationsError(null);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    setDepositPaidDraft(project.depositPaidAt ? project.depositPaidAt.slice(0, 10) : '');
  }, [project?.depositPaidAt, project]);

  const loadServices = useCallback(async () => {
    const res = await fetchJson<{ items: ServiceItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/services`
    );
    if (res.ok && res.data) setServices(res.data.items);
  }, [businessId, projectId]);

  const loadTasks = useCallback(async () => {
    const res = await fetchJson<{ items: TaskItem[] }>(
      `/api/pro/businesses/${businessId}/tasks?projectId=${projectId}`
    );
    if (res.ok && res.data) setTasks(res.data.items);
  }, [businessId, projectId]);

  const loadMembers = useCallback(async () => {
    const res = await fetchJson<{ items: MemberItem[] }>(`/api/pro/businesses/${businessId}/members`);
    if (res.ok && res.data) setMembers(res.data.items);
  }, [businessId]);

  const loadProjectMembers = useCallback(async () => {
    const res = await fetchJson<{ items: ProjectAccessMember[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/members`
    );
    if (res.ok && res.data) setProjectMembers(res.data.items);
  }, [businessId, projectId]);

  const loadOrganizationUnits = useCallback(async () => {
    const res = await fetchJson<{ items: OrganizationUnitItem[] }>(
      `/api/pro/businesses/${businessId}/organization/units`
    );
    if (res.ok && res.data) setOrganizationUnits(res.data.items);
  }, [businessId]);

  const loadActivity = useCallback(async () => {
    const res = await fetchJson<{ items: ActivityItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/activity?limit=20`
    );
    if (res.ok && res.data) setActivityItems(res.data.items);
  }, [businessId, projectId]);

  const loadDocuments = useCallback(async (clientIdOverride?: string | null) => {
    const clientId = clientIdOverride ?? project?.clientId;
    if (!clientId) {
      setDocuments([]);
      return;
    }
    const res = await fetchJson<{ uploads: ClientDocument[] }>(
      `/api/pro/businesses/${businessId}/clients/${clientId}/documents`
    );
    if (res.ok && res.data) setDocuments(res.data.uploads);
  }, [businessId, project?.clientId]);

  const loadBillingSettings = useCallback(async () => {
    const res = await fetchJson<{
      item: {
        defaultDepositPercent: number;
        vatEnabled: boolean;
        vatRatePercent: number;
        paymentTermsDays: number;
        cgvText?: string | null;
        paymentTermsText?: string | null;
        lateFeesText?: string | null;
        fixedIndemnityText?: string | null;
        legalMentionsText?: string | null;
      };
    }>(`/api/pro/businesses/${businessId}/settings`, { cache: 'no-store' });
    if (!res.ok || !res.data) {
      setBillingSettings(null);
      return;
    }
    setBillingSettings(res.data.item);
  }, [businessId]);

  const loadQuotes = useCallback(async () => {
    const res = await fetchJson<{ items: QuoteItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
      { cache: 'no-store' }
    );
    if (!res.ok || !res.data) {
      setBillingError(res.error ?? 'Devis indisponibles.');
      setQuotes([]);
      return;
    }
    setBillingError(null);
    setQuotes(res.data.items ?? []);
  }, [businessId, projectId]);

  const loadInvoices = useCallback(async () => {
    const res = await fetchJson<{ items: InvoiceItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/invoices`,
      { cache: 'no-store' }
    );
    if (!res.ok || !res.data) {
      setBillingError(res.error ?? 'Factures indisponibles.');
      setInvoices([]);
      return;
    }
    setBillingError(null);
    setInvoices(res.data.items ?? []);
  }, [businessId, projectId]);

  const loadPayments = useCallback(
    async (invoiceId: string) => {
      if (!invoiceId) return;
      setPaymentLoading(true);
      setPaymentError(null);
      try {
        const res = await fetchJson<{ items: PaymentItem[] }>(
          `/api/pro/businesses/${businessId}/invoices/${invoiceId}/payments`,
          { cache: 'no-store' }
        );
        if (!res.ok || !res.data) {
          setPaymentError(res.error ?? 'Paiements indisponibles.');
          setPaymentItems([]);
          return;
        }
        setPaymentItems(res.data.items ?? []);
      } catch (err) {
        setPaymentError(getErrorMessage(err));
        setPaymentItems([]);
      } finally {
        setPaymentLoading(false);
      }
    },
    [businessId]
  );

  async function openPaymentModal(invoice: InvoiceItem, presetAmountCents?: number) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setPaymentError(null);
    setPaymentNotice(null);
    setPaymentItems([]);
    setPaymentModal({ invoice });
    setPaymentForm({
      amount: presetAmountCents != null ? formatEuroInput(String(presetAmountCents)) : '',
      paidAt: new Date().toISOString().slice(0, 10),
      method: 'WIRE',
      reference: '',
      note: '',
    });
    await loadPayments(invoice.id);
  }

  function closePaymentModal() {
    setPaymentModal(null);
    setPaymentItems([]);
    setPaymentError(null);
    setPaymentNotice(null);
    setPaymentLoading(false);
    setPaymentSaving(false);
    setPaymentDeletingId(null);
  }

  function resetQuoteWizard() {
    setQuoteWizardStep(0);
    setQuoteWizardLines([]);
    setQuoteWizardSearch('');
    setQuoteWizardGenerateTasks(true);
    setQuoteWizardAssigneeId('');
    setQuoteWizardDueOffsetDays('');
    setQuoteWizardError(null);
    setQuoteWizardInfo(null);
    setQuoteWizardResult(null);
    setQuoteWizardSaving(false);
  }

  function openQuoteWizard() {
    resetQuoteWizard();
    setQuoteWizardOpen(true);
    void loadCatalogServices();
    void loadMembers();
  }

  function closeQuoteWizard() {
    setQuoteWizardOpen(false);
    resetQuoteWizard();
  }

  function createWizardLineId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `wiz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function addCatalogLine(service: CatalogService) {
    setQuoteWizardLines((prev) => {
      const existing = prev.find((line) => line.source === 'catalog' && line.serviceId === service.id);
      if (existing) {
        return prev.map((line) =>
          line.id === existing.id ? { ...line, quantity: Math.max(1, line.quantity + 1) } : line
        );
      }
      const defaultCents = service.defaultPriceCents ?? service.tjmCents;
      const unitPriceCents = defaultCents != null ? Number(defaultCents) : null;
      return [
        ...prev,
        {
          id: createWizardLineId(),
          source: 'catalog',
          serviceId: service.id,
          code: service.code,
          title: service.name,
          description: '',
          quantity: 1,
          unitPriceCents,
          priceLocked: defaultCents != null,
        },
      ];
    });
    if (quoteWizardGenerateTasks && !serviceTemplates[service.id] && !templatesLoading[service.id]) {
      void loadServiceTemplates(service.id);
    }
  }

  function addCustomLine() {
    setQuoteWizardLines((prev) => [
      ...prev,
      {
        id: createWizardLineId(),
        source: 'custom',
        title: '',
        description: '',
        quantity: 1,
        unitPriceCents: null,
        priceLocked: false,
      },
    ]);
  }

  function updateWizardLine(id: string, patch: Partial<WizardLine>) {
    setQuoteWizardLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function removeWizardLine(id: string) {
    setQuoteWizardLines((prev) => prev.filter((line) => line.id !== id));
  }

  function buildCustomServiceCode() {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SER-CUSTOM-${stamp}-${rand}`;
  }

  const loadClients = useCallback(async (q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetchJson<{ items: ClientLite[] }>(
      `/api/pro/businesses/${businessId}/clients${query}`
    );
    if (res.ok && res.data) setClients(res.data.items);
  }, [businessId]);

  const loadCatalogServices = useCallback(
    async (q?: string) => {
      const query = q ? `?q=${encodeURIComponent(q)}` : '';
      const res = await fetchJson<{ items: CatalogService[] }>(
        `/api/pro/businesses/${businessId}/services${query}`
      );
      if (res.ok && res.data) {
        if (q) {
          setCatalogSearchResults(res.data.items);
        } else {
          setCatalogServices(res.data.items);
          setCatalogSearchResults(res.data.items);
        }
      }
    },
    [businessId]
  );

  const loadServiceTemplates = useCallback(
    async (serviceId: string) => {
      if (!serviceId) return;
      setTemplatesLoading((prev) => ({ ...prev, [serviceId]: true }));
      const res = await fetchJson<{ items: ServiceTemplate[] }>(
        `/api/pro/businesses/${businessId}/services/${serviceId}/templates`
      );
      if (res.ok) {
        const items = res.data?.items ?? [];
        setServiceTemplates((prev) => ({ ...prev, [serviceId]: items }));
      }
      setTemplatesLoading((prev) => ({ ...prev, [serviceId]: false }));
    },
    [businessId]
  );

  const refetchAll = useCallback(async () => {
    const cid = await loadProject();
    await Promise.all([
      loadServices(),
      loadTasks(),
      loadMembers(),
      loadProjectMembers(),
      loadOrganizationUnits(),
      loadActivity(),
      loadDocuments(cid),
      loadQuotes(),
      loadInvoices(),
      loadBillingSettings(),
      loadCatalogServices(),
    ]);
  }, [
    loadBillingSettings,
    loadCatalogServices,
    loadDocuments,
    loadInvoices,
    loadMembers,
    loadProjectMembers,
    loadOrganizationUnits,
    loadActivity,
    loadProject,
    loadQuotes,
    loadServices,
    loadTasks,
  ]);

  const patchProject = async (body: Record<string, unknown>) => {
    return fetchJson<{ item: ProjectDetail }>(`/api/pro/businesses/${businessId}/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const prestationsDirty = useMemo(() => {
    const current = (project?.prestationsText ?? '').trim();
    return prestationsDraft.trim() !== current;
  }, [prestationsDraft, project?.prestationsText]);

  async function handleSavePrestations() {
    if (!project) return;
    if (!isAdmin) {
      setPrestationsError('Réservé aux admins/owners.');
      return;
    }
    if (!prestationsDirty) return;
    setPrestationsSaving(true);
    setPrestationsError(null);
    try {
      const payload = { prestationsText: prestationsDraft.trim() || null };
      const res = await patchProject(payload);
      if (!res.ok) {
        setPrestationsError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      setBillingInfo('Détail des prestations mis à jour.');
      await loadProject();
    } catch (err) {
      setPrestationsError(getErrorMessage(err));
    } finally {
      setPrestationsSaving(false);
    }
  }

  const reorderServices = useCallback(
    (fromId: string, toId: string) => {
      const fromIndex = services.findIndex((svc) => svc.id === fromId);
      const toIndex = services.findIndex((svc) => svc.id === toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return services;
      const next = [...services];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((svc, index) => ({ ...svc, position: index }));
    },
    [services]
  );

  const persistServiceOrder = useCallback(
    async (nextServices: ServiceItem[]) => {
      if (!isAdmin) return;
      setReordering(true);
      setBillingError(null);
      try {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/projects/${projectId}/services/reorder`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: nextServices.map((svc, index) => ({ id: svc.id, position: index })),
            }),
          }
        );
        if (!res.ok) {
          setBillingError(res.error ?? 'Réorganisation impossible.');
          await loadServices();
          return;
        }
        setBillingInfo('Ordre des services mis à jour.');
      } catch (err) {
        setBillingError(getErrorMessage(err));
        await loadServices();
      } finally {
        setReordering(false);
      }
    },
    [businessId, isAdmin, loadServices, projectId]
  );

  const handleServiceDragStart = (event: DragEvent<HTMLButtonElement>, serviceId: string) => {
    if (!isAdmin || reordering) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', serviceId);
    setDraggingServiceId(serviceId);
    setDragOverServiceId(null);
  };

  const handleServiceDragOver = (event: DragEvent<HTMLDivElement>, serviceId: string) => {
    if (!isAdmin || reordering) return;
    if (!draggingServiceId || draggingServiceId === serviceId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverServiceId(serviceId);
  };

  const handleServiceDrop = async (event: DragEvent<HTMLDivElement>, serviceId: string) => {
    if (!isAdmin || reordering) return;
    event.preventDefault();
    const sourceId = draggingServiceId || event.dataTransfer.getData('text/plain');
    setDragOverServiceId(null);
    setDraggingServiceId(null);
    if (!sourceId || sourceId === serviceId) return;
    const next = reorderServices(sourceId, serviceId);
    if (next === services) return;
    setServices(next);
    await persistServiceOrder(next);
  };

  const handleServiceDragEnd = () => {
    setDraggingServiceId(null);
    setDragOverServiceId(null);
  };

  async function handleMarkCompleted() {
    if (!project) return;
    if (!isAdmin) {
      setActionError('Réservé aux admins/owners.');
      return;
    }
    const warning = shouldWarnProjectCompletion(project.quoteStatus ?? null, project.depositStatus ?? null);
    const confirmMessage = warning
      ? 'Devis non signé ou acompte non validé. Marquer terminé quand même ?'
      : 'Marquer ce projet comme terminé ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;

    const payload: Record<string, unknown> = { status: 'COMPLETED' };

    setMarkingCompleted(true);
    setActionError(null);
    try {
      const res = await patchProject(payload);
      if (!res.ok) {
        setActionError(res.error ?? 'Impossible de marquer le projet terminé.');
        return;
      }
      await refetchAll();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setMarkingCompleted(false);
    }
  }

  async function handleUpdateService(serviceId: string) {
    if (!isAdmin) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Réservé aux admins/owners.' }));
      return;
    }
    const draft = serviceDrafts[serviceId];
    const existing = services.find((svc) => svc.id === serviceId);
    if (!draft || !existing) return;

    const quantityNum = Number(draft.quantity);
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Quantité invalide.' }));
      return;
    }

    const priceCents = draft.price.trim() ? parseEuroInput(draft.price) : null;
    if (draft.price.trim() && priceCents == null) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Prix invalide.' }));
      return;
    }

    const payload: Record<string, unknown> = {};
    const quantity = Math.max(1, Math.trunc(quantityNum));
    if (quantity !== existing.quantity) payload.quantity = quantity;

    const existingPrice = parseCents(existing.priceCents);
    if (priceCents !== null && priceCents !== existingPrice) {
      payload.priceCents = priceCents;
    }

    const description = draft.description ?? '';
    if ((existing.description ?? existing.notes ?? '') !== description) {
      payload.description = description;
    }

    const title = draft.title?.trim() ?? '';
    if ((existing.titleOverride ?? '') !== title) {
      payload.titleOverride = title || null;
    }

    const discountType = draft.discountType ?? 'NONE';
    const discountValueRaw = draft.discountValue ? Number(draft.discountValue) : null;
    const discountValue = Number.isFinite(discountValueRaw ?? NaN) ? Math.trunc(discountValueRaw ?? 0) : null;
    if ((existing.discountType ?? 'NONE') !== discountType || (existing.discountValue ?? null) !== (discountValue ?? null)) {
      payload.discountType = discountType;
      payload.discountValue = discountValue ?? null;
    }

    const billingUnit = draft.billingUnit ?? 'ONE_OFF';
    if ((existing.billingUnit ?? 'ONE_OFF') !== billingUnit) {
      payload.billingUnit = billingUnit;
    }

    let unitLabel = draft.unitLabel?.trim() ?? '';
    if (billingUnit === 'MONTHLY' && !unitLabel) {
      unitLabel = '/mois';
    }
    if ((existing.unitLabel ?? '') !== unitLabel) {
      payload.unitLabel = unitLabel || null;
    }

    if (!Object.keys(payload).length) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Aucune modification.' }));
      return;
    }

    setLineSavingId(serviceId);
    setLineErrors((prev) => ({ ...prev, [serviceId]: '' }));
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${projectId}/services/${serviceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        setLineErrors((prev) => ({ ...prev, [serviceId]: res.error ?? 'Mise à jour impossible.' }));
        return;
      }
      setBillingInfo('Service mis à jour.');
      await refetchAll();
    } catch (err) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: getErrorMessage(err) }));
    } finally {
      setLineSavingId(null);
    }
  }

  async function handleDeleteService(serviceId: string) {
    if (!isAdmin) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Réservé aux admins/owners.' }));
      return;
    }
    const existing = services.find((svc) => svc.id === serviceId);
    if (!existing) return;
    const label = existing.service?.name ?? 'ce service';
    const confirmMessage = `Supprimer "${label}" du projet ?`;
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;

    setLineSavingId(serviceId);
    setLineErrors((prev) => ({ ...prev, [serviceId]: '' }));
    setBillingInfo(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${projectId}/services/${serviceId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        setLineErrors((prev) => ({ ...prev, [serviceId]: res.error ?? 'Suppression impossible.' }));
        return;
      }
      setBillingInfo('Service supprimé.');
      setServiceDrafts((prev) => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });
      setOpenNotes((prev) => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });
      await refetchAll();
    } catch (err) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: getErrorMessage(err) }));
    } finally {
      setLineSavingId(null);
    }
  }

  async function handleCreateQuote() {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    if (!services.length) {
      setBillingError('Ajoute au moins un service avant de créer un devis.');
      return;
    }
    if (pricingTotals.missingCount > 0) {
      setBillingError('Renseigne les tarifs manquants avant de créer un devis.');
      return;
    }
    setCreatingQuote(true);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ quote: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
        { method: 'POST' }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Création du devis impossible.');
        return;
      }
      setBillingInfo('Devis créé.');
      await Promise.all([loadQuotes(), loadInvoices()]);
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setCreatingQuote(false);
    }
  }

  async function handleWizardGenerateQuote() {
    if (!isAdmin) {
      setQuoteWizardError('Réservé aux admins/owners.');
      return;
    }
    if (!wizardCanContinue) {
      setQuoteWizardError('Ajoute des prestations et un prix valide avant de continuer.');
      return;
    }
    setQuoteWizardSaving(true);
    setQuoteWizardError(null);
    setQuoteWizardInfo('Ajout des prestations…');
    try {
      const dueOffset = quoteWizardDueOffsetDays.trim()
        ? Math.max(0, Math.min(365, Number(quoteWizardDueOffsetDays)))
        : null;
      const hasDueOffset = Number.isFinite(dueOffset ?? NaN);
      const createTasks = quoteWizardGenerateTasks;

      for (const line of quoteWizardLines) {
        let serviceId = line.serviceId ?? null;
        if (!serviceId || line.source === 'custom') {
          const code = buildCustomServiceCode();
          const payload: Record<string, unknown> = {
            code,
            name: line.title.trim() || 'Prestation personnalisée',
            type: 'CUSTOM',
            description: line.description.trim() || null,
            defaultPriceCents: line.unitPriceCents ?? 0,
          };
          const res = await fetchJson<CatalogService & { id: string }>(
            `/api/pro/businesses/${businessId}/services`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );
          if (!res.ok || !res.data?.id) {
            throw new Error(res.error ?? 'Création du service personnalisé impossible.');
          }
          serviceId = res.data.id;
        }

        const payload: Record<string, unknown> = {
          serviceId,
          quantity: Math.max(1, Math.trunc(line.quantity)),
          titleOverride: line.title.trim() || undefined,
          description: line.description.trim() || undefined,
        };
        if (line.unitPriceCents != null && (!line.priceLocked || line.source === 'custom')) {
          payload.priceCents = Math.max(0, Math.trunc(line.unitPriceCents));
        }
        if (createTasks) {
          payload.generateTasks = true;
          if (quoteWizardAssigneeId) payload.taskAssigneeUserId = quoteWizardAssigneeId;
          if (hasDueOffset) payload.taskDueOffsetDays = Math.trunc(dueOffset as number);
        } else {
          payload.generateTasks = false;
        }

        const addRes = await fetchJson<{ id: string }>(
          `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!addRes.ok) {
          throw new Error(addRes.error ?? 'Ajout des services au projet impossible.');
        }
      }

      setQuoteWizardInfo('Génération du devis…');
      const quoteRes = await fetchJson<{
        quote: { id: string };
        pdfUrl: string;
        downloadUrl: string;
      }>(`/api/pro/businesses/${businessId}/projects/${projectId}/quotes`, { method: 'POST' });
      if (!quoteRes.ok || !quoteRes.data) {
        throw new Error(quoteRes.error ?? 'Création du devis impossible.');
      }
      setQuoteWizardResult({
        quoteId: quoteRes.data.quote.id,
        pdfUrl: quoteRes.data.pdfUrl,
        downloadUrl: quoteRes.data.downloadUrl,
      });
      setQuoteWizardInfo('Devis généré');
      setBillingInfo('Devis généré');
      await refetchAll();
    } catch (err) {
      setQuoteWizardError(getErrorMessage(err));
    } finally {
      setQuoteWizardSaving(false);
    }
  }

  function openCancelQuoteModal(quote: QuoteItem) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setCancelQuoteError(null);
    setCancelQuoteEditor({
      quoteId: quote.id,
      number: quote.number ?? null,
      status: quote.status,
      reason: '',
    });
  }

  async function handleCancelQuote() {
    if (!cancelQuoteEditor) return;
    if (!isAdmin) {
      setCancelQuoteError('Réservé aux admins/owners.');
      return;
    }
    const reason = cancelQuoteEditor.reason.trim();
    if (!reason) {
      setCancelQuoteError('La raison est requise.');
      return;
    }
    if (cancelQuoteSaving) return;
    setCancelQuoteSaving(true);
    setCancelQuoteError(null);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ quote: QuoteItem }>(
        `/api/pro/businesses/${businessId}/quotes/${cancelQuoteEditor.quoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CANCELLED', cancelReason: reason }),
        }
      );
      if (!res.ok) {
        setCancelQuoteError(res.error ?? 'Annulation impossible.');
        return;
      }
      setCancelQuoteEditor(null);
      await refetchAll();
    } catch (err) {
      setCancelQuoteError(getErrorMessage(err));
    } finally {
      setCancelQuoteSaving(false);
    }
  }

  async function handleSetBillingReference(quoteId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setReferenceUpdatingId(quoteId);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await patchProject({ billingQuoteId: quoteId });
      if (!res.ok) {
        setBillingError(res.error ?? 'Impossible de définir le devis de référence.');
        return;
      }
      setBillingInfo('Devis de référence mis à jour.');
      await loadProject();
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setReferenceUpdatingId(null);
    }
  }

  async function handleQuoteStatus(quoteId: string, nextStatus: 'SENT' | 'SIGNED' | 'EXPIRED') {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setQuoteActionId(quoteId);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ quote: QuoteItem }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Mise à jour du devis impossible.');
        return;
      }
      await Promise.all([loadQuotes(), loadProject()]);
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setQuoteActionId(null);
    }
  }

  async function handleCreateInvoice(quoteId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setInvoiceActionId(quoteId);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ invoice: { id: string } }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteId}/invoices`,
        { method: 'POST' }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Création de la facture impossible.');
        return;
      }
      setBillingInfo('Facture créée.');
      await loadInvoices();
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setInvoiceActionId(null);
    }
  }

  function openStagedInvoiceModal(kind: 'DEPOSIT' | 'MID' | 'FINAL') {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    const defaultValue =
      kind === 'DEPOSIT' && Number.isFinite(summaryTotals.depositPercent)
        ? String(summaryTotals.depositPercent)
        : '';
    setStagedInvoiceModal({ kind, mode: 'PERCENT', value: defaultValue });
    setStagedInvoiceError(null);
  }

  function closeStagedInvoiceModal() {
    setStagedInvoiceModal(null);
    setStagedInvoiceError(null);
  }

  async function handleCreateStagedInvoice() {
    if (!stagedInvoiceModal) return;
    if (!isAdmin) {
      setStagedInvoiceError('Réservé aux admins/owners.');
      return;
    }
    if (remainingToInvoiceCents <= 0) {
      setStagedInvoiceError('Aucun montant restant à facturer.');
      return;
    }

    const mode = stagedInvoiceModal.kind === 'FINAL' ? 'FINAL' : stagedInvoiceModal.mode;
    let value: number | undefined;
    if (mode === 'PERCENT') {
      const percent = Number(stagedInvoiceModal.value);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        setStagedInvoiceError('Pourcentage invalide.');
        return;
      }
      value = percent;
    } else if (mode === 'AMOUNT') {
      const cents = parseEuroInput(stagedInvoiceModal.value);
      if (cents == null || cents <= 0) {
        setStagedInvoiceError('Montant invalide.');
        return;
      }
      value = cents;
    }

    const previewAmount =
      mode === 'FINAL'
        ? remainingToInvoiceCents
        : mode === 'PERCENT' && value != null
          ? Math.round(summaryTotals.totalCents * (value / 100))
          : value ?? 0;

    if (previewAmount > remainingToInvoiceCents) {
      setStagedInvoiceError('Le montant dépasse le reste à facturer.');
      return;
    }

    setStagedInvoiceLoading(true);
    setStagedInvoiceError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ invoice: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/invoices/staged`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mode === 'FINAL' ? { mode } : { mode, value }),
        }
      );
      if (!res.ok) {
        setStagedInvoiceError(res.error ?? 'Création de la facture impossible.');
        return;
      }
      setBillingInfo('Facture créée.');
      closeStagedInvoiceModal();
      await loadInvoices();
    } catch (err) {
      setStagedInvoiceError(getErrorMessage(err));
    } finally {
      setStagedInvoiceLoading(false);
    }
  }

  async function handleInvoiceStatus(invoiceId: string, nextStatus: 'SENT' | 'CANCELLED') {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setInvoiceActionId(invoiceId);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ invoice: InvoiceItem }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Mise à jour de la facture impossible.');
        return;
      }
      await loadInvoices();
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setInvoiceActionId(null);
    }
  }

  async function handleSavePayment() {
    if (!paymentModal) return;
    if (!isAdmin) {
      setPaymentError('Réservé aux admins/owners.');
      return;
    }
    const amountCents = parseEuroInput(paymentForm.amount);
    if (!amountCents || amountCents <= 0) {
      setPaymentError('Montant invalide.');
      return;
    }
    setPaymentSaving(true);
    setPaymentError(null);
    setPaymentNotice(null);
    setBillingInfo(null);
    const invoice = paymentModal.invoice;
    const remainingBefore = getInvoiceRemainingCents(invoice);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/invoices/${invoice.id}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountCents,
            paidAt: paymentForm.paidAt || new Date().toISOString(),
            method: paymentForm.method,
            reference: paymentForm.reference || null,
            note: paymentForm.note || null,
          }),
        }
      );
      if (!res.ok) {
        setPaymentError(res.error ?? 'Impossible d’ajouter le paiement.');
        return;
      }
      const message = amountCents >= remainingBefore ? 'Facture soldée' : 'Paiement ajouté';
      setBillingInfo(message);
      setPaymentNotice(message);
      setPaymentForm((prev) => ({ ...prev, amount: '', reference: '', note: '' }));
      await Promise.all([loadInvoices(), loadPayments(invoice.id)]);
    } catch (err) {
      setPaymentError(getErrorMessage(err));
    } finally {
      setPaymentSaving(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!paymentModal) return;
    if (!isAdmin) {
      setPaymentError('Réservé aux admins/owners.');
      return;
    }
    if (!window.confirm('Supprimer ce paiement ?')) return;
    setPaymentDeletingId(paymentId);
    setPaymentError(null);
    setPaymentNotice(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/invoices/${paymentModal.invoice.id}/payments/${paymentId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        setPaymentError(res.error ?? 'Suppression du paiement impossible.');
        return;
      }
      setBillingInfo('Paiement supprimé');
      setPaymentNotice('Paiement supprimé');
      await Promise.all([loadInvoices(), loadPayments(paymentModal.invoice.id)]);
    } catch (err) {
      setPaymentError(getErrorMessage(err));
    } finally {
      setPaymentDeletingId(null);
    }
  }

  function openQuoteDateModal(quote: QuoteItem) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setDateModalError(null);
    setQuoteDateEditor({
      quoteId: quote.id,
      number: quote.number ?? null,
      status: quote.status,
      signedAt: quote.signedAt ? quote.signedAt.slice(0, 10) : '',
    });
  }

  function openInvoiceDateModal(invoice: InvoiceItem) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setDateModalError(null);
    setInvoiceDateEditor({
      invoiceId: invoice.id,
      number: invoice.number ?? null,
      status: invoice.status,
      paidAt: invoice.paidAt ? invoice.paidAt.slice(0, 10) : '',
    });
  }

  async function handleSaveQuoteDate() {
    if (!quoteDateEditor) return;
    setDateModalSaving(true);
    setDateModalError(null);
    try {
      const res = await fetchJson<{ quote: QuoteItem }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteDateEditor.quoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signedAt: quoteDateEditor.signedAt ? new Date(quoteDateEditor.signedAt).toISOString() : null,
          }),
        }
      );
      if (!res.ok) {
        setDateModalError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await loadQuotes();
      setQuoteDateEditor(null);
    } catch (err) {
      setDateModalError(getErrorMessage(err));
    } finally {
      setDateModalSaving(false);
    }
  }

  async function handleSaveInvoiceDate() {
    if (!invoiceDateEditor) return;
    setDateModalSaving(true);
    setDateModalError(null);
    try {
      const res = await fetchJson<{ invoice: InvoiceItem }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceDateEditor.invoiceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paidAt: invoiceDateEditor.paidAt ? new Date(invoiceDateEditor.paidAt).toISOString() : null,
          }),
        }
      );
      if (!res.ok) {
        setDateModalError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await loadInvoices();
      setInvoiceDateEditor(null);
    } catch (err) {
      setDateModalError(getErrorMessage(err));
    } finally {
      setDateModalSaving(false);
    }
  }

  async function handleSaveDepositDate() {
    if (!project) return;
    setDateModalSaving(true);
    setDateModalError(null);
    try {
      const res = await patchProject({
        depositPaidAt: depositPaidDraft ? new Date(depositPaidDraft).toISOString() : null,
      });
      if (!res.ok) {
        setDateModalError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await refetchAll();
      setDepositDateEditorOpen(false);
    } catch (err) {
      setDateModalError(getErrorMessage(err));
    } finally {
      setDateModalSaving(false);
    }
  }

  function openQuoteEditor(quote: QuoteItem) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    const lines = (quote.items ?? []).map(toEditableLine);
    setQuoteEditError(null);
    setQuoteEditor({
      quoteId: quote.id,
      status: quote.status,
      number: quote.number ?? null,
      issuedAt: toDateInput(quote.issuedAt ?? quote.createdAt),
      expiresAt: toDateInput(quote.expiresAt),
      note: quote.note ?? '',
      lines,
    });
  }

  function closeQuoteEditor() {
    setQuoteEditor(null);
    setQuoteEditError(null);
  }

  function addQuoteLine() {
    if (!quoteEditor) return;
    const nextLine: EditableLine = {
      id: `new-${Date.now()}`,
      label: '',
      description: '',
      quantity: '1',
      unitPrice: '',
      serviceId: null,
      productId: null,
    };
    setQuoteEditor({ ...quoteEditor, lines: [...quoteEditor.lines, nextLine] });
  }

  function removeQuoteLine(lineId: string) {
    if (!quoteEditor) return;
    setQuoteEditor({ ...quoteEditor, lines: quoteEditor.lines.filter((line) => line.id !== lineId) });
  }

  async function handleSaveQuoteEdit() {
    if (!quoteEditor) return;
    if (!isAdmin) {
      setQuoteEditError('Réservé aux admins/owners.');
      return;
    }
    if (quoteEditing) return;

    const editableStatus = quoteEditor.status === 'DRAFT' || quoteEditor.status === 'SENT';
    const canEditLines = quoteEditor.status === 'DRAFT';
    if (!editableStatus) {
      setQuoteEditError('Devis signé/annulé: modification interdite.');
      return;
    }

    const payload: Record<string, unknown> = {};
    const issuedAt = quoteEditor.issuedAt ? new Date(quoteEditor.issuedAt).toISOString() : null;
    const expiresAt = quoteEditor.expiresAt ? new Date(quoteEditor.expiresAt).toISOString() : null;
    payload.issuedAt = issuedAt;
    payload.expiresAt = expiresAt;
    payload.note = quoteEditor.note.trim() || null;

    if (canEditLines) {
      if (!quoteEditor.lines.length) {
        setQuoteEditError('Ajoute au moins une ligne.');
        return;
      }
      const items = [];
      for (const line of quoteEditor.lines) {
        const label = line.label.trim();
        if (!label) {
          setQuoteEditError('Chaque ligne doit avoir un libellé.');
          return;
        }
        const description = line.description.trim();
        const qty = Number(line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          setQuoteEditError('Quantité invalide.');
          return;
        }
        const unitPriceCents = parseEuroInput(line.unitPrice);
        if (unitPriceCents == null) {
          setQuoteEditError('Prix unitaire invalide.');
          return;
        }
        items.push({
          id: line.id,
          label,
          description: description || null,
          quantity: Math.max(1, Math.trunc(qty)),
          unitPriceCents,
          serviceId: line.serviceId ?? null,
        });
      }
      payload.items = items;
    }

    setQuoteEditing(true);
    setQuoteEditError(null);
    try {
      const res = await fetchJson<{ quote: QuoteItem }>(`/api/pro/businesses/${businessId}/quotes/${quoteEditor.quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setQuoteEditError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await loadQuotes();
      setBillingInfo('Devis mis à jour.');
      closeQuoteEditor();
    } catch (err) {
      setQuoteEditError(getErrorMessage(err));
    } finally {
      setQuoteEditing(false);
    }
  }

  async function handleDeleteQuote(quoteId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Supprimer ce devis ? Cette action est irréversible.')) {
      return;
    }
    setBillingError(null);
    setBillingInfo(null);
    setQuoteActionId(quoteId);
    try {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, { method: 'DELETE' });
      if (!res.ok) {
        setBillingError(res.error ?? 'Suppression impossible.');
        return;
      }
      await loadQuotes();
      setBillingInfo('Devis supprimé.');
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setQuoteActionId(null);
    }
  }

  async function openInvoiceEditor(invoiceId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setInvoiceEditError(null);
    setInvoiceEditor(null);
    try {
      const res = await fetchJson<{ invoice: InvoiceDetail }>(`/api/pro/businesses/${businessId}/invoices/${invoiceId}`, {
        cache: 'no-store',
      });
      if (!res.ok || !res.data) {
        setInvoiceEditError(res.error ?? 'Facture introuvable.');
        return;
      }
      const invoice = res.data.invoice;
      setInvoiceEditor({
        invoiceId: invoice.id,
        status: invoice.status,
        number: invoice.number ?? null,
        issuedAt: toDateInput(invoice.issuedAt ?? invoice.createdAt),
        dueAt: toDateInput(invoice.dueAt),
        note: invoice.note ?? '',
        lines: invoice.items.map(toEditableLine),
      });
    } catch (err) {
      setInvoiceEditError(getErrorMessage(err));
    }
  }

  function closeInvoiceEditor() {
    setInvoiceEditor(null);
    setInvoiceEditError(null);
  }

  function addInvoiceLine() {
    if (!invoiceEditor) return;
    const nextLine: EditableLine = {
      id: `new-${Date.now()}`,
      label: '',
      description: '',
      quantity: '1',
      unitPrice: '',
      productId: null,
      serviceId: null,
    };
    setInvoiceEditor({ ...invoiceEditor, lines: [...invoiceEditor.lines, nextLine] });
  }

  function removeInvoiceLine(lineId: string) {
    if (!invoiceEditor) return;
    setInvoiceEditor({ ...invoiceEditor, lines: invoiceEditor.lines.filter((line) => line.id !== lineId) });
  }

  async function handleSaveInvoiceEdit() {
    if (!invoiceEditor) return;
    if (!isAdmin) {
      setInvoiceEditError('Réservé aux admins/owners.');
      return;
    }
    if (invoiceEditing) return;

    const canEditLines = invoiceEditor.status === 'DRAFT';
    const editableStatus = invoiceEditor.status === 'DRAFT' || invoiceEditor.status === 'SENT';
    if (!editableStatus) {
      setInvoiceEditError('Facture payée/annulée: modification interdite.');
      return;
    }

    const payload: Record<string, unknown> = {};
    payload.issuedAt = invoiceEditor.issuedAt ? new Date(invoiceEditor.issuedAt).toISOString() : null;
    payload.dueAt = invoiceEditor.dueAt ? new Date(invoiceEditor.dueAt).toISOString() : null;
    payload.note = invoiceEditor.note.trim() || null;

    if (canEditLines) {
      if (!invoiceEditor.lines.length) {
        setInvoiceEditError('Ajoute au moins une ligne.');
        return;
      }
      const lineItems = [];
      for (const line of invoiceEditor.lines) {
        const label = line.label.trim();
        if (!label) {
          setInvoiceEditError('Chaque ligne doit avoir un libellé.');
          return;
        }
        const description = line.description.trim();
        const qty = Number(line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          setInvoiceEditError('Quantité invalide.');
          return;
        }
        const unitPriceCents = parseEuroInput(line.unitPrice);
        if (unitPriceCents == null) {
          setInvoiceEditError('Prix unitaire invalide.');
          return;
        }
        lineItems.push({
          id: line.id,
          label,
          description: description || null,
          quantity: Math.max(1, Math.trunc(qty)),
          unitPriceCents,
          productId: line.productId ?? null,
          serviceId: line.serviceId ?? null,
        });
      }
      payload.lineItems = lineItems;
    }

    setInvoiceEditing(true);
    setInvoiceEditError(null);
    try {
      const res = await fetchJson<{ invoice: InvoiceItem }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceEditor.invoiceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        setInvoiceEditError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await loadInvoices();
      setBillingInfo('Facture mise à jour.');
      closeInvoiceEditor();
    } catch (err) {
      setInvoiceEditError(getErrorMessage(err));
    } finally {
      setInvoiceEditing(false);
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Supprimer cette facture ? Cette action est irréversible.')) {
      return;
    }
    setBillingError(null);
    setBillingInfo(null);
    setInvoiceActionId(invoiceId);
    try {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/invoices/${invoiceId}`, { method: 'DELETE' });
      if (!res.ok) {
        setBillingError(res.error ?? 'Suppression impossible.');
        return;
      }
      await loadInvoices();
      setBillingInfo('Facture supprimée.');
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setInvoiceActionId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await refetchAll();
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, projectId, refetchAll]);

  const statusLabel = useMemo(() => {
    return getProjectStatusLabelFR(project?.status ?? null);
  }, [project?.status]);

  const scopeLabel = useMemo(() => {
    return getProjectScopeLabelFR(project?.status ?? null, project?.archivedAt ?? null);
  }, [project?.archivedAt, project?.status]);

  const scopeVariant = useMemo(() => {
    return getProjectScopeVariant(project?.status ?? null, project?.archivedAt ?? null);
  }, [project?.archivedAt, project?.status]);

  const showScopeBadge = useMemo(() => {
    return scopeLabel.toLowerCase() !== statusLabel.toLowerCase();
  }, [scopeLabel, statusLabel]);

  const isOverdue = useMemo(() => {
    return isProjectOverdue(project?.endDate ?? null, project?.status ?? null, project?.archivedAt ?? null);
  }, [project?.archivedAt, project?.endDate, project?.status]);

  const checklistItems: ChecklistItem[] = useMemo(() => {
    const hasClient = Boolean(project?.clientId);
    const hasEndDate = Boolean(project?.endDate);
    const hasServices = services.length > 0;
    const hasTasks = tasks.length > 0;
    const hasDocs = documents.length > 0;
    const hasTeam = members.length > 0 || tasks.some((t) => t.assigneeEmail || t.assigneeName);
    return [
      { key: 'client', label: 'Client lié', done: hasClient, ctaLabel: 'Associer un client', href: `/app/pro/${businessId}/clients` },
      { key: 'deadline', label: 'Échéance définie', done: hasEndDate, ctaLabel: 'Définir la date', href: `/app/pro/${businessId}/projects/${projectId}/edit` },
      { key: 'services', label: 'Services ajoutés', done: hasServices, ctaLabel: 'Ajouter des services', href: `/app/pro/${businessId}/projects/${projectId}?tab=billing` },
      { key: 'tasks', label: 'Tâches générées/assignées', done: hasTasks, ctaLabel: 'Configurer les tâches', href: `/app/pro/${businessId}/projects/${projectId}?tab=work` },
      { key: 'team', label: 'Équipe assignée', done: hasTeam, ctaLabel: 'Ajouter un membre', href: `/app/pro/${businessId}/projects/${projectId}?tab=team` },
      { key: 'docs', label: 'Dossier documents initial', done: hasDocs, ctaLabel: 'Ajouter un document', href: `/app/pro/${businessId}/projects/${projectId}?tab=files` },
    ];
  }, [businessId, project?.clientId, project?.endDate, projectId, services.length, tasks, members.length, documents.length]);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['overview', 'work', 'team', 'billing', 'files'].includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab);
    }
  }, [searchParams]);

  const showSetup = (searchParams?.get('setup') ?? '') === '1';
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'DONE')
      .sort(
        (a, b) =>
          (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
          (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)
      );
  }, [tasks]);

  const servicesWithTasks = useMemo(() => {
    return services.map((service) => ({
      service,
      tasks: tasks.filter((t) => t.projectServiceId === service.id),
    }));
  }, [services, tasks]);

  const servicesOverview = showAllServicesOverview
    ? servicesWithTasks
    : servicesWithTasks.slice(0, OVERVIEW_PREVIEW_COUNT);
  const showServicesToggle = servicesWithTasks.length > OVERVIEW_PREVIEW_COUNT;

  const upcomingTasksOverview = showAllActionsOverview
    ? upcomingTasks
    : upcomingTasks.slice(0, OVERVIEW_PREVIEW_COUNT);
  const showActionsToggle = upcomingTasks.length > OVERVIEW_PREVIEW_COUNT;

  const activityOverview = showAllActivity
    ? activityItems
    : activityItems.slice(0, OVERVIEW_ACTIVITY_COUNT);
  const showActivityToggle = activityItems.length > OVERVIEW_ACTIVITY_COUNT;

  const projectMembersPreview = projectMembers.slice(0, OVERVIEW_MEMBERS_COUNT);
  const projectMembersOverflow = Math.max(0, projectMembers.length - projectMembersPreview.length);
  const projectMemberIds = useMemo(
    () => new Set(projectMembers.map((member) => member.membershipId)),
    [projectMembers]
  );
  const availableMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          !projectMemberIds.has(member.membershipId) &&
          member.role !== 'OWNER' &&
          member.role !== 'ADMIN'
      ),
    [members, projectMemberIds]
  );

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((task) => task.status === statusFilter);
  }, [statusFilter, tasks]);

  const tasksByAssignee = useMemo(() => {
    const groups = new Map<string, { label: string; name?: string | null; email?: string | null; tasks: TaskItem[] }>();
    for (const task of filteredTasks) {
      const key = task.assigneeUserId ?? 'unassigned';
      const existing = groups.get(key);
      if (!existing) {
        const label = task.assigneeName || task.assigneeEmail || 'Non assignées';
        groups.set(key, {
          label,
          name: task.assigneeName,
          email: task.assigneeEmail,
          tasks: [task],
        });
      } else {
        existing.tasks.push(task);
      }
    }
    const list = Array.from(groups.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));
    list.sort((a, b) => {
      if (a.key === 'unassigned') return -1;
      if (b.key === 'unassigned') return 1;
      return a.label.localeCompare(b.label);
    });
    return list;
  }, [filteredTasks]);

  const teamMembers = useMemo(() => {
    if (members.length) return members;
    return projectMembers.map<MemberItem>((member) => ({
      membershipId: member.membershipId,
      userId: member.user.id,
      email: member.user.email ?? '',
      name: member.user.name,
      role: member.role,
      organizationUnit: member.organizationUnit ?? null,
    }));
  }, [members, projectMembers]);

  const membersByUnit = useMemo(() => {
    const groups = new Map<string, { label: string; order: number; members: MemberItem[] }>();
    for (const member of teamMembers) {
      const unitId = member.organizationUnit?.id ?? 'none';
      const label = member.organizationUnit?.name ?? 'Sans pôle';
      const order = member.organizationUnit
        ? organizationUnits.find((unit) => unit.id === member.organizationUnit?.id)?.order ?? 0
        : Number.MAX_SAFE_INTEGER;
      const entry = groups.get(unitId) ?? { label, order, members: [] };
      entry.members.push(member);
      groups.set(unitId, entry);
    }
    const list = Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
    list.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    return list;
  }, [organizationUnits, teamMembers]);

  const tasksByServiceId = useMemo(() => {
    return new Map(servicesWithTasks.map((entry) => [entry.service.id, entry.tasks]));
  }, [servicesWithTasks]);

  useEffect(() => {
    setServiceDrafts((prev) => {
      const next = { ...prev };
      const ids = new Set(services.map((svc) => svc.id));
      for (const svc of services) {
        if (!next[svc.id]) {
          next[svc.id] = {
            quantity: String(svc.quantity ?? 1),
            price: formatEuroInput(svc.priceCents),
            title: svc.titleOverride ?? '',
            description: svc.description ?? svc.notes ?? '',
            discountType: svc.discountType ?? 'NONE',
            discountValue: svc.discountValue != null ? String(svc.discountValue) : '',
            billingUnit: svc.billingUnit ?? 'ONE_OFF',
            unitLabel: svc.unitLabel ?? '',
          };
        }
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [services]);

  const catalogById = useMemo(() => {
    return new Map(catalogServices.map((svc) => [svc.id, svc]));
  }, [catalogServices]);

  const pricingLines = useMemo(() => {
    return services.map((svc) => {
      const draft = serviceDrafts[svc.id];
      const quantityRaw = draft?.quantity ?? String(svc.quantity ?? 1);
      const quantityNum = Number(quantityRaw);
      const quantity =
        Number.isFinite(quantityNum) && quantityNum > 0 ? Math.max(1, Math.trunc(quantityNum)) : svc.quantity ?? 1;
      const draftPriceCents = draft?.price ? parseEuroInput(draft.price) : null;
      const projectPriceCents = draftPriceCents ?? parseCents(svc.priceCents);
      const catalog = catalogById.get(svc.serviceId);
      const defaultPriceCents = parseCents(catalog?.defaultPriceCents ?? null);
      const tjmCents = parseCents(catalog?.tjmCents ?? null);
      const resolvedUnitCents = projectPriceCents ?? defaultPriceCents ?? tjmCents;
      const missingPrice = resolvedUnitCents == null;
      const discountType = draft?.discountType ?? svc.discountType ?? 'NONE';
      const discountValueRaw = draft?.discountValue ?? (svc.discountValue != null ? String(svc.discountValue) : '');
      const discountValueNum = discountValueRaw ? Number(discountValueRaw) : null;
      const discountValue =
        Number.isFinite(discountValueNum ?? NaN) ? Math.trunc(discountValueNum ?? 0) : null;
      const applyDiscount = () => {
        if (resolvedUnitCents == null) return { final: null, original: null };
        if (discountType === 'PERCENT' && discountValue != null) {
          const bounded = Math.min(100, Math.max(0, discountValue));
          const final = Math.round(resolvedUnitCents * ((100 - bounded) / 100));
          return { final, original: resolvedUnitCents };
        }
        if (discountType === 'AMOUNT' && discountValue != null) {
          const bounded = Math.max(0, discountValue);
          const final = Math.max(0, resolvedUnitCents - bounded);
          return { final, original: resolvedUnitCents };
        }
        return { final: resolvedUnitCents, original: null };
      };
      const discounted = applyDiscount();
      const unitPriceCents = discounted.final;
      const totalCents = missingPrice || unitPriceCents == null ? 0 : unitPriceCents * quantity;
      const billingUnit = draft?.billingUnit ?? svc.billingUnit ?? 'ONE_OFF';
      let unitLabel = draft?.unitLabel ?? svc.unitLabel ?? '';
      if (billingUnit === 'MONTHLY' && !unitLabel) unitLabel = '/mois';
      return {
        id: svc.id,
        serviceId: svc.serviceId,
        quantity,
        unitPriceCents: unitPriceCents,
        originalUnitPriceCents: discounted.original,
        discountType,
        discountValue: discountValue,
        billingUnit,
        unitLabel,
        totalCents,
        missingPrice,
        priceSource: projectPriceCents
          ? 'project'
          : defaultPriceCents
            ? 'default'
            : tjmCents
              ? 'tjm'
              : 'missing',
      };
    });
  }, [catalogById, serviceDrafts, services]);

  const depositPercent = billingSettings?.defaultDepositPercent;
  const effectiveDepositPercent = Number.isFinite(depositPercent) ? Number(depositPercent) : 0;
  const vatEnabled = billingSettings?.vatEnabled ?? false;
  const vatRatePercent = billingSettings?.vatRatePercent ?? 0;

  const pricingTotals = useMemo(() => {
    const totalCents = pricingLines.reduce((sum, line) => sum + (line.totalCents || 0), 0);
    const vatCents = vatEnabled ? Math.round(totalCents * (vatRatePercent / 100)) : 0;
    const totalTtcCents = totalCents + vatCents;
    const depositCents = Math.round(totalCents * (effectiveDepositPercent / 100));
    const balanceCents = totalCents - depositCents;
    const missingCount = pricingLines.filter((line) => line.missingPrice).length;
    return { totalCents, vatCents, totalTtcCents, depositCents, balanceCents, missingCount };
  }, [effectiveDepositPercent, pricingLines, vatEnabled, vatRatePercent]);

  const isBillingEmpty = services.length === 0;

  const wizardLineValidation = useMemo(() => {
    return quoteWizardLines.map((line) => {
      const errors: string[] = [];
      if (!line.title.trim()) errors.push('Titre requis.');
      if (line.quantity <= 0) errors.push('Qté invalide.');
      if (line.unitPriceCents === null || Number.isNaN(line.unitPriceCents)) {
        errors.push('Prix requis.');
      }
      return { id: line.id, errors };
    });
  }, [quoteWizardLines]);

  const wizardHasErrors = wizardLineValidation.some((entry) => entry.errors.length > 0);
  const wizardCanContinue = quoteWizardLines.length > 0 && !wizardHasErrors;

  const missingPriceNames = useMemo(() => {
    return pricingLines
      .filter((line) => line.missingPrice)
      .map((line) => services.find((svc) => svc.id === line.id)?.service.name ?? 'Service');
  }, [pricingLines, services]);

  const billingSummary = project?.billingSummary ?? null;
  const billingReferenceId = billingSummary?.referenceQuoteId ?? project?.billingQuoteId ?? null;

  const billingReferenceQuote = useMemo(() => {
    if (billingReferenceId) {
      return quotes.find((quote) => quote.id === billingReferenceId) ?? null;
    }
    const candidates = quotes.filter((quote) => quote.status === 'SIGNED');
    const canUseLatest =
      project?.quoteStatus === 'SIGNED' || project?.quoteStatus === 'ACCEPTED';
    const pool = candidates.length ? candidates : canUseLatest ? quotes : [];
    if (!pool.length) return null;
    return pool.sort((a, b) => {
      const aDate = a.issuedAt ? new Date(a.issuedAt).getTime() : new Date(a.createdAt).getTime();
      const bDate = b.issuedAt ? new Date(b.issuedAt).getTime() : new Date(b.createdAt).getTime();
      return bDate - aDate;
    })[0];
  }, [billingReferenceId, project?.quoteStatus, quotes]);

  const summaryTotals = useMemo(() => {
    if (billingSummary) {
      const totalCents = Number(billingSummary.totalCents);
      const depositCents = Number(billingSummary.depositCents);
      const balanceCents = Number(billingSummary.balanceCents);
      const depositPercentValue = billingSummary.depositPercent;
      const vatCents = vatEnabled ? Math.round(totalCents * (vatRatePercent / 100)) : 0;
      const totalTtcCents = totalCents + vatCents;
      return {
        totalCents,
        vatCents,
        totalTtcCents,
        depositPercent: depositPercentValue,
        depositCents,
        balanceCents,
        sourceLabel: billingSummary.source === 'QUOTE' ? 'Devis signé' : 'Services projet',
      };
    }
    const signedTotal = billingReferenceQuote ? Number(billingReferenceQuote.totalCents) : null;
    const totalCents = Number.isFinite(signedTotal ?? NaN) ? (signedTotal as number) : pricingTotals.totalCents;
    const depositPercentValue = billingReferenceQuote?.depositPercent ?? effectiveDepositPercent;
    const depositCents = billingReferenceQuote ? Number(billingReferenceQuote.depositCents) : pricingTotals.depositCents;
    const balanceCents = billingReferenceQuote ? Number(billingReferenceQuote.balanceCents) : pricingTotals.balanceCents;
    const vatCents = vatEnabled ? Math.round(totalCents * (vatRatePercent / 100)) : 0;
    const totalTtcCents = totalCents + vatCents;
    return {
      totalCents,
      vatCents,
      totalTtcCents,
      depositPercent: depositPercentValue,
      depositCents,
      balanceCents,
      sourceLabel: billingReferenceQuote ? 'Devis signé' : 'Services projet',
    };
  }, [
    billingSummary,
    billingReferenceQuote,
    effectiveDepositPercent,
    pricingTotals.balanceCents,
    pricingTotals.depositCents,
    pricingTotals.totalCents,
    vatEnabled,
    vatRatePercent,
  ]);

  const depositPercentLabel = Number.isFinite(summaryTotals.depositPercent) ? `${summaryTotals.depositPercent}%` : '—';
  const depositPaidLabel = formatDate(project?.depositPaidAt ?? null);
  const canEditDepositPaidDate = project?.depositStatus === 'PAID';
  const alreadyInvoicedCents = useMemo(() => {
    if (billingSummary) return Number(billingSummary.alreadyInvoicedCents);
    return invoices
      .filter((inv) => inv.status !== 'CANCELLED')
      .reduce((sum, inv) => sum + Number(inv.totalCents), 0);
  }, [billingSummary, invoices]);
  const alreadyPaidCents = useMemo(() => {
    if (billingSummary) return Number(billingSummary.alreadyPaidCents);
    return invoices.reduce((sum, inv) => sum + getInvoicePaidCents(inv), 0);
  }, [billingSummary, invoices]);
  const remainingToCollectCents = billingSummary
    ? Number(billingSummary.remainingToCollectCents)
    : Math.max(0, alreadyInvoicedCents - alreadyPaidCents);
  const remainingToInvoiceCents = billingSummary
    ? Number(billingSummary.remainingCents)
    : Math.max(0, summaryTotals.totalCents - alreadyInvoicedCents);

  const latestQuote = useMemo(() => {
    return quotes.reduce<QuoteItem | null>((acc, quote) => {
      if (!acc) return quote;
      const accDate = acc.issuedAt ? new Date(acc.issuedAt).getTime() : new Date(acc.createdAt).getTime();
      const quoteDate = quote.issuedAt ? new Date(quote.issuedAt).getTime() : new Date(quote.createdAt).getTime();
      return quoteDate > accDate ? quote : acc;
    }, null);
  }, [quotes]);

  const latestInvoice = useMemo(() => {
    return invoices.reduce<InvoiceItem | null>((acc, invoice) => {
      if (!acc) return invoice;
      const accDate = acc.issuedAt ? new Date(acc.issuedAt).getTime() : new Date(acc.createdAt).getTime();
      const invoiceDate = invoice.issuedAt ? new Date(invoice.issuedAt).getTime() : new Date(invoice.createdAt).getTime();
      return invoiceDate > accDate ? invoice : acc;
    }, null);
  }, [invoices]);

  const latestPdf = useMemo(() => {
    if (!latestQuote && !latestInvoice) return null;
    const quoteDate = latestQuote
      ? latestQuote.issuedAt
        ? new Date(latestQuote.issuedAt).getTime()
        : new Date(latestQuote.createdAt).getTime()
      : 0;
    const invoiceDate = latestInvoice
      ? latestInvoice.issuedAt
        ? new Date(latestInvoice.issuedAt).getTime()
        : new Date(latestInvoice.createdAt).getTime()
      : 0;
    if (latestInvoice && invoiceDate >= quoteDate) {
      return {
        url: `/api/pro/businesses/${businessId}/invoices/${latestInvoice.id}/pdf`,
        label: latestInvoice.number ?? `Facture #${latestInvoice.id}`,
      };
    }
    if (latestQuote) {
      return {
        url: `/api/pro/businesses/${businessId}/quotes/${latestQuote.id}/pdf`,
        label: latestQuote.number ?? `Devis #${latestQuote.id}`,
      };
    }
    return null;
  }, [businessId, latestInvoice, latestQuote]);

  const activePaymentInvoice = paymentModal
    ? invoices.find((inv) => inv.id === paymentModal.invoice.id) ?? paymentModal.invoice
    : null;
  const paymentTotalCents = activePaymentInvoice ? Number(activePaymentInvoice.totalCents) : 0;
  const paymentPaidCents = activePaymentInvoice ? getInvoicePaidCents(activePaymentInvoice) : 0;
  const paymentRemainingCents = activePaymentInvoice ? getInvoiceRemainingCents(activePaymentInvoice) : 0;
  const applyPaymentShortcut = (ratio: number) => {
    if (!Number.isFinite(paymentRemainingCents) || paymentRemainingCents <= 0) return;
    const cents = Math.max(0, Math.round(paymentRemainingCents * ratio));
    setPaymentForm((prev) => ({ ...prev, amount: formatEuroInput(String(cents)) }));
  };

  const legalBlocks = useMemo(() => {
    const blocks = [
      { label: 'CGV', value: billingSettings?.cgvText },
      { label: 'Paiement', value: billingSettings?.paymentTermsText },
      { label: 'Pénalités', value: billingSettings?.lateFeesText },
      { label: 'Indemnité', value: billingSettings?.fixedIndemnityText },
      { label: 'Mentions', value: billingSettings?.legalMentionsText },
    ];
    const filled = blocks.filter((block) => (block.value ?? '').trim()).length;
    return { blocks, filled, total: blocks.length };
  }, [billingSettings]);
  const legalConfigured = Boolean((billingSettings?.cgvText ?? '').trim());

  const stagedMode = stagedInvoiceModal?.kind === 'FINAL' ? 'FINAL' : stagedInvoiceModal?.mode ?? 'PERCENT';
  const stagedPercentValue =
    stagedMode === 'PERCENT' ? Number(stagedInvoiceModal?.value ?? '') : null;
  const stagedAmountValue =
    stagedMode === 'AMOUNT' ? parseEuroInput(stagedInvoiceModal?.value ?? '') : null;
  const stagedPreviewCents =
    stagedMode === 'FINAL'
      ? remainingToInvoiceCents
      : stagedMode === 'PERCENT'
        ? Number.isFinite(stagedPercentValue ?? NaN)
          ? Math.round(summaryTotals.totalCents * ((stagedPercentValue ?? 0) / 100))
          : 0
        : stagedAmountValue ?? 0;
  const stagedPreviewTooHigh = stagedPreviewCents > remainingToInvoiceCents;

  const quoteEditStatus = quoteEditor?.status ?? null;
  const canEditQuoteLines = quoteEditStatus === 'DRAFT';
  const canEditQuoteMeta = quoteEditStatus === 'DRAFT' || quoteEditStatus === 'SENT';
  const invoiceEditStatus = invoiceEditor?.status ?? null;
  const canEditInvoiceLines = invoiceEditStatus === 'DRAFT';
  const canEditInvoiceMeta = invoiceEditStatus === 'DRAFT' || invoiceEditStatus === 'SENT';

  const invoiceByQuoteId = useMemo(() => {
    const map = new Map<string, string>();
    invoices.forEach((inv) => {
      if (inv.quoteId) map.set(inv.quoteId, inv.id);
    });
    return map;
  }, [invoices]);

  const pricingByServiceId = useMemo(() => {
    return new Map(pricingLines.map((line) => [line.id, line]));
  }, [pricingLines]);

  const selectedServiceIds = useMemo(() => {
    return Object.keys(serviceSelections).filter((id) => (serviceSelections[id] ?? 0) > 0);
  }, [serviceSelections]);

  const projectValueCents = useMemo(() => {
    const raw = project?.valueCents ?? project?.billingSummary?.totalCents;
    if (raw != null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (services.length) return pricingTotals.totalCents;
    return null;
  }, [project?.billingSummary?.totalCents, project?.valueCents, pricingTotals.totalCents, services.length]);

  const progressPct = useMemo(() => {
    if (project?.tasksSummary) return project.tasksSummary.progressPct ?? 0;
    if (!tasks.length) return 0;
    const total = tasks.length;
    const sum = tasks.reduce(
      (acc, t) => acc + (t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? t.progress ?? 0 : 0),
      0
    );
    return Math.round(sum / total);
  }, [project?.tasksSummary, tasks]);

  const kpis = useMemo(() => {
    return [
      { label: 'Avancement', value: `${Math.min(100, Math.max(0, progressPct))}%` },
      {
        label: 'Valeur',
        value: projectValueCents !== null ? formatCurrencyEUR(projectValueCents, { minimumFractionDigits: 0 }) : '—',
      },
      { label: 'Échéance', value: formatDate(project?.endDate ?? null) },
    ];
  }, [projectValueCents, progressPct, project?.endDate]);

  useEffect(() => {
    if (project) {
      setSelectedClientId(project.clientId);
      setStartDateInput(project.startDate ? project.startDate.slice(0, 10) : '');
      setEndDateInput(project.endDate ? project.endDate.slice(0, 10) : '');
    }
  }, [project]);

  useEffect(() => {
    if (activeSetupModal === 'client') {
      setModalError(null);
      void loadClients();
    } else if (activeSetupModal === 'services') {
      setModalError(null);
      void loadCatalogServices();
      void loadMembers();
    } else if (activeSetupModal === 'team') {
      setModalError(null);
      void loadMembers();
    } else if (activeSetupModal === 'tasks') {
      setModalError(null);
      void loadMembers();
      void loadTasks();
    } else if (activeSetupModal === 'documents') {
      setModalError(null);
      if (project?.clientId) {
        void loadDocuments(project.clientId);
      }
    }
  }, [activeSetupModal, loadClients, loadCatalogServices, loadMembers, loadTasks, loadDocuments, project?.clientId]);

  useEffect(() => {
    if (!accessModalOpen) return;
    setAccessInfo(null);
    void loadMembers();
    void loadProjectMembers();
  }, [accessModalOpen, loadMembers, loadProjectMembers]);

  useEffect(() => {
    if (!unitsModalOpen) return;
    setUnitErrors(null);
    void loadOrganizationUnits();
    void loadMembers();
  }, [unitsModalOpen, loadOrganizationUnits, loadMembers]);

  useEffect(() => {
    if (!unitsModalOpen) return;
    setUnitDrafts(
      organizationUnits.reduce<Record<string, { name: string; order: string }>>((acc, unit) => {
        acc[unit.id] = { name: unit.name, order: String(unit.order ?? 0) };
        return acc;
      }, {})
    );
  }, [organizationUnits, unitsModalOpen]);

  useEffect(() => {
    if (!generateTasksOnAdd) return;
    const selectedIds = Object.keys(serviceSelections);
    selectedIds.forEach((serviceId) => {
      if (!serviceTemplates[serviceId] && !templatesLoading[serviceId]) {
        void loadServiceTemplates(serviceId);
      }
    });
  }, [generateTasksOnAdd, serviceSelections, serviceTemplates, templatesLoading, loadServiceTemplates]);

  useEffect(() => {
    if (!quoteWizardOpen || !quoteWizardGenerateTasks) return;
    const selectedIds = quoteWizardLines
      .map((line) => line.serviceId)
      .filter((id): id is string => Boolean(id));
    selectedIds.forEach((serviceId) => {
      if (!serviceTemplates[serviceId] && !templatesLoading[serviceId]) {
        void loadServiceTemplates(serviceId);
      }
    });
  }, [quoteWizardOpen, quoteWizardGenerateTasks, quoteWizardLines, serviceTemplates, templatesLoading, loadServiceTemplates]);

  async function handleAttachClient() {
    if (!selectedClientId) {
      setModalError('Sélectionne un client.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const res = await patchProject({ clientId: selectedClientId });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Impossible de lier le client.');
      return;
    }
    await refetchAll();
    closeModal();
  }

  async function handleUpdateDates() {
    if (startDateInput && endDateInput && new Date(endDateInput) < new Date(startDateInput)) {
      setModalError('La fin doit être après le début.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const res = await patchProject({
      startDate: startDateInput || null,
      endDate: endDateInput || null,
    });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Impossible de mettre à jour les dates.');
      return;
    }
    await refetchAll();
    closeModal();
  }

  async function handleAddServices() {
    if (!isAdmin) {
      setModalError('Réservé aux admins/owners.');
      return;
    }
    const entries = Object.entries(serviceSelections).filter(([, qty]) => qty > 0);
    if (!entries.length) {
      setModalError('Sélectionne au moins un service.');
      return;
    }
    const dueOffset =
      taskDueOffsetDays.trim() === ''
        ? null
        : Number.isFinite(Number(taskDueOffsetDays))
          ? Math.trunc(Number(taskDueOffsetDays))
          : null;
    if (dueOffset !== null && (dueOffset < 0 || dueOffset > 365)) {
      setModalError('Décalage jours invalide (0-365).');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      for (const [serviceId, qty] of entries) {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serviceId,
              quantity: qty,
              generateTasks: generateTasksOnAdd,
              ...(generateTasksOnAdd && taskAssigneeId ? { taskAssigneeUserId: taskAssigneeId } : {}),
              ...(generateTasksOnAdd && dueOffset !== null ? { taskDueOffsetDays: dueOffset } : {}),
            }),
          }
        );
        if (!res.ok) {
          throw new Error(res.error ?? 'Erreur service');
        }
      }
      await refetchAll();
      closeModal();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyServiceTemplates(projectServiceId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    const dueOffset =
      taskDueOffsetDays.trim() === ''
        ? null
        : Number.isFinite(Number(taskDueOffsetDays))
          ? Math.trunc(Number(taskDueOffsetDays))
          : null;
    if (dueOffset !== null && (dueOffset < 0 || dueOffset > 365)) {
      setBillingError('Décalage jours invalide (0-365).');
      return;
    }
    setTemplatesApplying((prev) => ({ ...prev, [projectServiceId]: true }));
    setBillingError(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${projectId}/services/${projectServiceId}/tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(taskAssigneeId ? { taskAssigneeUserId: taskAssigneeId } : {}),
            ...(dueOffset !== null ? { taskDueOffsetDays: dueOffset } : {}),
          }),
        }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Impossible de générer les tâches.');
        return;
      }
      await loadTasks();
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setTemplatesApplying((prev) => ({ ...prev, [projectServiceId]: false }));
    }
  }

  async function handleAssignTasks() {
    const entries = Object.entries(taskAssignments).filter(([, memberId]) => memberId);
    if (!entries.length) {
      setModalError('Aucune assignation sélectionnée.');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      for (const [taskId, memberId] of entries) {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/tasks/${taskId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assigneeUserId: memberId }),
          }
        );
        if (!res.ok) {
          throw new Error(res.error ?? 'Erreur assignation');
        }
      }
      await refetchAll();
      closeModal();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleInviteMember() {
    if (!inviteEmail) {
      setModalError('Email requis.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const res = await fetchJson(`/api/pro/businesses/${businessId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Invitation impossible.');
      return;
    }
    const inviteId = `invite-${inviteEmail}`;
    setMembers((prev) => [
      ...prev,
      { membershipId: inviteId, userId: inviteId, email: inviteEmail, role: inviteRole, name: null, organizationUnit: null },
    ]);
    await refetchAll();
    closeModal();
  }

  async function handleAddProjectMember(membershipId: string) {
    if (!isAdmin) {
      setAccessInfo('Réservé aux admins/owners.');
      return;
    }
    setAccessInfo(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/projects/${projectId}/members`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
      }
    );
    if (!res.ok) {
      setAccessInfo(res.error ?? 'Impossible d’ajouter l’accès.');
      return;
    }
    await loadProjectMembers();
    setAccessInfo('Accès mis à jour.');
  }

  async function handleRemoveProjectMember(membershipId: string) {
    if (!isAdmin) {
      setAccessInfo('Réservé aux admins/owners.');
      return;
    }
    setAccessInfo(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/projects/${projectId}/members/${membershipId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      setAccessInfo(res.error ?? 'Impossible de retirer l’accès.');
      return;
    }
    await loadProjectMembers();
    setAccessInfo('Accès mis à jour.');
  }

  async function handleCreateUnit() {
    if (!isAdmin) {
      setUnitErrors('Réservé aux admins/owners.');
      return;
    }
    const name = unitDraftName.trim();
    if (!name) {
      setUnitErrors('Nom requis.');
      return;
    }
    const order = unitDraftOrder.trim() === '' ? 0 : Number(unitDraftOrder);
    if (!Number.isFinite(order)) {
      setUnitErrors('Ordre invalide.');
      return;
    }
    setUnitErrors(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/organization/units`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, order: Math.trunc(order) }),
      }
    );
    if (!res.ok) {
      setUnitErrors(res.error ?? 'Création impossible.');
      return;
    }
    setUnitDraftName('');
    setUnitDraftOrder('0');
    await loadOrganizationUnits();
    setTeamInfo('Pôle créé.');
  }

  async function handleUpdateUnit(unitId: string) {
    if (!isAdmin) {
      setUnitErrors('Réservé aux admins/owners.');
      return;
    }
    const draft = unitDrafts[unitId];
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setUnitErrors('Nom requis.');
      return;
    }
    const order = draft.order.trim() === '' ? 0 : Number(draft.order);
    if (!Number.isFinite(order)) {
      setUnitErrors('Ordre invalide.');
      return;
    }
    setUnitErrors(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/organization/units/${unitId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, order: Math.trunc(order) }),
      }
    );
    if (!res.ok) {
      setUnitErrors(res.error ?? 'Mise à jour impossible.');
      return;
    }
    await loadOrganizationUnits();
    setTeamInfo('Pôle mis à jour.');
  }

  async function handleDeleteUnit(unitId: string) {
    if (!isAdmin) {
      setUnitErrors('Réservé aux admins/owners.');
      return;
    }
    setUnitErrors(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/organization/units/${unitId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      setUnitErrors(res.error ?? 'Suppression impossible.');
      return;
    }
    await loadOrganizationUnits();
    setTeamInfo('Pôle supprimé.');
  }

  async function handleAssignMemberToUnit(membershipId: string, unitId: string | null) {
    if (!isAdmin) {
      setUnitErrors('Réservé aux admins/owners.');
      return;
    }
    setUnitErrors(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/memberships/${membershipId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationUnitId: unitId }),
      }
    );
    if (!res.ok) {
      setUnitErrors(res.error ?? 'Assignation impossible.');
      return;
    }
    await loadMembers();
    await loadProjectMembers();
    setTeamInfo('Membre mis à jour.');
  }

  async function handleUploadDocument() {
    if (!project?.clientId) {
      setModalError('Associe un client avant de déposer un document.');
      return;
    }
    if (!documentFile) {
      setModalError('Choisis un fichier.');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const form = new FormData();
      form.append('file', documentFile);
      form.append('title', `${documentKind} - ${documentFile.name}`);
      const res = await fetch(`/api/pro/businesses/${businessId}/clients/${project.clientId}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = (data as { error?: string } | null)?.error ?? 'Upload impossible.';
        throw new Error(msg);
      }
      await refetchAll();
      closeModal();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <EmptyState title="Chargement..." description="Nous récupérons le projet." />;
  }
  if (error || !project) {
    return (
      <EmptyState
        title="Projet introuvable"
        description={error ?? 'Ce projet est indisponible.'}
        action={
          <Button asChild>
            <Link href={`/app/pro/${businessId}/projects`}>Retour aux projets</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className={UI.page}>
      <SectionCard>
        <div className="flex flex-col gap-5">
          <StickyHeaderActions>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/app/pro/${businessId}/projects`}>
                <ArrowLeft size={16} />
                Retour
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/pro/${businessId}/projects/${projectId}/edit`}>Modifier</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/app/pro/${businessId}/projects/${projectId}?tab=billing`}>Facturation</Link>
              </Button>
              {latestPdf ? (
                <Button asChild size="sm" variant="outline">
                  <a href={latestPdf.url} target="_blank" rel="noreferrer">
                    Dernier PDF
                  </a>
                </Button>
              ) : null}
            </div>
          </StickyHeaderActions>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {project.name ?? `Projet #${projectId}`}
                </h1>
                <Badge variant="neutral">{statusLabel}</Badge>
                {showScopeBadge ? <Badge variant={scopeVariant}>{scopeLabel}</Badge> : null}
                {project.archivedAt ? <Badge variant="performance">Archivé</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-4">
                <MetaItem
                  label="Client"
                  value={
                    project.clientName && project.clientId ? (
                      <Link
                        href={`/app/pro/${businessId}/clients/${project.clientId}`}
                        className="font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {project.clientName}
                      </Link>
                    ) : (
                      project.clientName ?? 'Non renseigné'
                    )
                  }
                />
                <MetaItem
                  label="Dates"
                  value={`${formatDate(project.startDate)} → ${formatDate(project.endDate)}`}
                />
                <MetaItem label="Dernière mise à jour" value={formatDate(project.updatedAt)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {kpis.map((item) => (
                <StatCard key={item.label} label={item.label} value={String(item.value)} />
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {isOverdue ? (
        <SectionCard className="border-rose-200/70 bg-rose-50/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Date de fin dépassée</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Terminer le projet ou repousser la fin.
              </p>
            </div>
            <Badge variant="performance">En retard</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleMarkCompleted}
              disabled={!isAdmin || markingCompleted}
            >
              {markingCompleted ? 'Traitement…' : 'Marquer terminé'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (!isAdmin) {
                  setActionError('Réservé aux admins/owners.');
                  return;
                }
                setActionError(null);
                setActiveSetupModal('deadline');
              }}
              disabled={!isAdmin || markingCompleted}
            >
              Repousser
            </Button>
          </div>
          {!isAdmin ? (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>
          ) : null}
          {actionError ? <p className="mt-2 text-xs text-rose-500">{actionError}</p> : null}
        </SectionCard>
      ) : null}

      <TabsPills
        items={tabs}
        value={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        ariaLabel="Onglets projet"
        className="rounded-2xl bg-[var(--surface)]/70 p-2"
      />

      {activeTab === 'overview' ? (
        <div className="space-y-4">
          {showSetup ? (
            <ProjectSetupChecklist items={checklistItems} onAction={(key) => setActiveSetupModal(key as typeof activeSetupModal)} />
          ) : null}
          {!showSetup && checklistItems.some((it) => !it.done) ? (
            <ProjectSetupChecklist items={checklistItems} onAction={(key) => setActiveSetupModal(key as typeof activeSetupModal)} />
          ) : null}

          <SectionCard className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Services inclus</p>
              <div className="flex flex-wrap items-center gap-2">
                {showServicesToggle ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAllServicesOverview((prev) => !prev)}
                  >
                    {showAllServicesOverview ? 'Voir moins' : 'Voir +'}
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/projects/${projectId}?tab=work`}>Ouvrir Travail</Link>
                </Button>
              </div>
            </div>
            {servicesWithTasks.length ? (
              <div className="space-y-3">
                {servicesOverview.map(({ service, tasks: svcTasks }) => (
                  <ServiceProgressRow
                    key={service.id}
                    service={{ id: service.id, name: service.service.name }}
                    tasks={svcTasks}
                    businessId={businessId}
                    projectId={projectId}
                  />
                ))}
              </div>
            ) : (
              <GuidedCtaCard
                title="Aucun service ajouté au projet."
                description="Ajoute des services pour structurer le travail et la facturation."
                primary={{ label: 'Ajouter des services', href: `/app/pro/${businessId}/projects/${projectId}?tab=billing` }}
              />
            )}
          </SectionCard>

          <SectionCard className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Prochaines actions</p>
              {showActionsToggle ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAllActionsOverview((prev) => !prev)}
                >
                  {showAllActionsOverview ? 'Voir moins' : 'Voir +'}
                </Button>
              ) : null}
            </div>
            {upcomingTasks.length ? (
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {upcomingTasksOverview.map((task) => (
                  <Link
                    key={task.id}
                    href={`/app/pro/${businessId}/tasks/${task.id}`}
                    className="block rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[var(--text-primary)]">{task.title}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {task.assigneeName || task.assigneeEmail || 'Non assigné'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            getStatusBadgeClasses(task.status)
                          )}
                        >
                          {formatTaskStatus(task.status)}
                        </span>
                        <span>{formatDate(task.dueDate)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
                <GuidedCtaCard
                  title="Aucune tâche planifiée."
                  description="Crée des tâches pour organiser le travail."
                  primary={{ label: 'Créer une tâche', href: `/app/pro/${businessId}/projects/${projectId}?tab=work` }}
                />
            )}
          </SectionCard>

          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Équipe (accès au projet)</p>
                {isAdmin ? (
                  <Button size="sm" variant="outline" onClick={() => setAccessModalOpen(true)}>
                    Gérer l’accès
                  </Button>
                ) : null}
              </div>
              {projectMembersPreview.length ? (
                <div className="flex flex-wrap items-center gap-3">
                  {projectMembersPreview.map((member) => (
                    <div key={member.membershipId} className="flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                      <InitialsAvatar name={member.user.name} email={member.user.email} size={24} />
                      <span className="max-w-[140px] truncate text-[var(--text-primary)]">
                        {member.user.name ?? member.user.email ?? '—'}
                      </span>
                    </div>
                  ))}
                  {projectMembersOverflow > 0 ? (
                    <span className="rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                      +{projectMembersOverflow}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">
                  Aucun accès configuré pour ce projet.
                </p>
              )}
              {accessInfo ? <p className="text-xs text-emerald-600">{accessInfo}</p> : null}
            </SectionCard>

            <SectionCard className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Activité récente</p>
                {showActivityToggle ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAllActivity((prev) => !prev)}
                  >
                    {showAllActivity ? 'Voir moins' : 'Voir +'}
                  </Button>
                ) : null}
              </div>
              {activityOverview.length ? (
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  {activityOverview.map((item) => (
                    <div
                      key={`${item.taskId}-${item.occurredAt ?? ''}`}
                      className="flex items-start gap-3 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
                    >
                      <InitialsAvatar name={item.actor?.name} email={item.actor?.email} size={26} />
                      <div className="min-w-0">
                        <p className="truncate text-[var(--text-primary)]">
                          {item.actor?.name ?? item.actor?.email ?? 'Quelqu’un'} a marqué “{item.title}” comme {formatTaskStatus(item.status)}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {item.serviceName ? `${item.serviceName} · ` : ''}{formatDate(item.occurredAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">Aucune activité récente.</p>
              )}
            </SectionCard>
          </div>
        </div>
      ) : null}

      {activeTab === 'work' ? (
        <div className="space-y-4">
          <TabsPills
            items={[
              { key: 'TODO', label: 'À faire' },
              { key: 'IN_PROGRESS', label: 'En cours' },
              { key: 'DONE', label: 'Terminées' },
              { key: 'all', label: 'Toutes' },
            ]}
            value={statusFilter}
            onChange={(key) => setStatusFilter(key as typeof statusFilter)}
            ariaLabel="Filtrer tâches"
          />
          {tasksByAssignee.length ? (
            <div className="space-y-3">
              {tasksByAssignee.map((group) => {
                const total = group.tasks.length;
                const done = group.tasks.filter((t) => t.status === 'DONE').length;
                const inProgress = group.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
                const remaining = total - done;
                const expanded = taskGroupExpanded[group.key] ?? false;
                const previewTasks = expanded ? group.tasks : group.tasks.slice(0, 5);
                const showToggle = group.tasks.length > 5;
                return (
                  <Card key={group.key} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/80 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={group.name} email={group.email} size={30} />
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{group.label}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {done}/{total} terminées · {inProgress} en cours · {remaining} restantes
                          </p>
                        </div>
                      </div>
                      {showToggle ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setTaskGroupExpanded((prev) => ({ ...prev, [group.key]: !expanded }))
                          }
                        >
                          {expanded ? 'Voir moins' : 'Voir +'}
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {previewTasks.map((task) => (
                        <Link
                          key={task.id}
                          href={`/app/pro/${businessId}/tasks/${task.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 text-sm transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <InitialsAvatar name={task.assigneeName} email={task.assigneeEmail} size={22} />
                            <div className="min-w-0">
                              <p className="truncate text-[var(--text-primary)]">{task.title}</p>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                  getStatusBadgeClasses(task.status)
                                )}
                              >
                                {formatTaskStatus(task.status)}
                              </span>
                            </div>
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {task.dueDate ? formatDate(task.dueDate) : '—'}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <GuidedCtaCard
              title="Aucune tâche configurée."
              description="Ajoute des services pour générer des tâches, ou crée-les manuellement."
              primary={{ label: 'Ajouter des services', href: `/app/pro/${businessId}/projects/${projectId}?tab=billing` }}
              secondary={{ label: 'Créer une tâche', href: `/app/pro/${businessId}/tasks?projectId=${projectId}` }}
            />
          )}
        </div>
      ) : null}

      {activeTab === 'team' ? (
        <div className="space-y-4">
          <SectionCard>
            <SectionHeader
              title="Équipe"
              subtitle="Membres par pôle/secteur."
              actions={
                isAdmin ? (
                  <Button size="sm" variant="outline" onClick={() => setUnitsModalOpen(true)}>
                    Gérer les pôles
                  </Button>
                ) : null
              }
            />
            {teamInfo ? <p className="mt-2 text-sm text-emerald-600">{teamInfo}</p> : null}
          </SectionCard>

          {membersByUnit.length ? (
            <div className="space-y-3">
              {membersByUnit.map((group) => (
                <Card key={group.key} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{group.label}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{group.members.length} membres</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.members.map((member) => (
                      <div key={member.membershipId} className="flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                        <InitialsAvatar name={member.name} email={member.email} size={22} />
                        <span className="max-w-[160px] truncate text-[var(--text-primary)]">
                          {member.name ?? member.email}
                        </span>
                        <span className="text-[11px] text-[var(--text-secondary)]">{member.role}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <GuidedCtaCard
              title="Aucun membre disponible."
              description="Invitez un membre pour commencer."
              primary={{ label: 'Ajouter un membre', href: `/app/pro/${businessId}/settings/team` }}
            />
          )}
        </div>
      ) : null}

      {activeTab === 'billing' ? (
        <div className="space-y-5">
          {billingError ? (
            <SectionCard className="border-rose-200/60 bg-rose-50/70 text-sm text-rose-500">
              {billingError}
            </SectionCard>
          ) : null}
          {billingInfo ? <p className="text-sm text-emerald-500">{billingInfo}</p> : null}
          {!isAdmin ? (
            <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>
              Lecture seule : réservée aux admins/owners.
            </div>
          ) : null}

          <SectionCard>
            <SectionHeader
              title="Résumé & situation"
              subtitle={`Acompte de référence : ${depositPercentLabel} · Source : ${summaryTotals.sourceLabel}`}
              actions={
                isBillingEmpty ? null : (
                  <>
                    <Button
                      size="sm"
                      onClick={handleCreateQuote}
                      disabled={!services.length || pricingTotals.missingCount > 0 || creatingQuote || !isAdmin}
                    >
                      {creatingQuote ? 'Création…' : 'Créer un devis'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openStagedInvoiceModal('DEPOSIT')}
                      disabled={!isAdmin || summaryTotals.totalCents <= 0}
                    >
                      Facture d’acompte
                    </Button>
                  </>
                )
              }
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill label="Devis" value={getProjectQuoteStatusLabelFR(project?.quoteStatus ?? null)} />
              <StatusPill label="Acompte" value={getProjectDepositStatusLabelFR(project?.depositStatus ?? null)} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>Date acompte : {depositPaidLabel}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDateModalError(null);
                  setDepositDateEditorOpen(true);
                }}
                disabled={!isAdmin || !canEditDepositPaidDate}
              >
                Modifier date
              </Button>
              {!canEditDepositPaidDate ? (
                <span>Disponible une fois l’acompte payé.</span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Total TTC"
                value={formatCurrencyEUR(summaryTotals.totalTtcCents, { minimumFractionDigits: 0 })}
                highlight
                align="right"
              />
              <StatCard
                label="Déjà facturé"
                value={formatCurrencyEUR(alreadyInvoicedCents, { minimumFractionDigits: 0 })}
                align="right"
              />
              <StatCard
                label="Déjà payé"
                value={formatCurrencyEUR(alreadyPaidCents, { minimumFractionDigits: 0 })}
                align="right"
              />
              <StatCard
                label="Reste à encaisser"
                value={formatCurrencyEUR(remainingToCollectCents, { minimumFractionDigits: 0 })}
                highlight
                align="right"
              />
              <StatCard
                label="Reste à facturer"
                value={formatCurrencyEUR(remainingToInvoiceCents, { minimumFractionDigits: 0 })}
                highlight
                align="right"
              />
              <StatCard
                label={`Acompte ${depositPercentLabel}`}
                value={formatCurrencyEUR(summaryTotals.depositCents, { minimumFractionDigits: 0 })}
                align="right"
              />
              <StatCard
                label="Solde"
                value={formatCurrencyEUR(summaryTotals.balanceCents, { minimumFractionDigits: 0 })}
                align="right"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
              <span>Total HT : {formatCurrencyEUR(summaryTotals.totalCents, { minimumFractionDigits: 0 })}</span>
              <span aria-hidden>•</span>
              <span>
                TVA : {vatEnabled ? formatCurrencyEUR(summaryTotals.vatCents, { minimumFractionDigits: 0 }) : '—'}
              </span>
              {billingSettings?.paymentTermsDays != null ? (
                <>
                  <span aria-hidden>•</span>
                  <span>Paiement sous {billingSettings.paymentTermsDays} jours</span>
                </>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              title="Détail des prestations"
              subtitle="Texte narratif repris dans les devis (hors lignes tarifées)."
            />
            <div className="mt-4 space-y-3">
              <textarea
                className="min-h-[180px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text-primary)]"
                placeholder="Décris le périmètre, les livrables, les phases…"
                value={prestationsDraft}
                onChange={(e) => setPrestationsDraft(e.target.value)}
                disabled={!isAdmin || prestationsSaving}
              />
              {prestationsError ? <p className="text-xs text-rose-500">{prestationsError}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSavePrestations}
                  disabled={!isAdmin || prestationsSaving || !prestationsDirty}
                >
                  {prestationsSaving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                {!isAdmin ? (
                  <span className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</span>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              title="Prestations facturables"
              subtitle="Ajuste les quantités, tarifs et remises avant de générer un devis."
              actions={
                isBillingEmpty ? null : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveSetupModal('services')}
                      disabled={!isAdmin}
                    >
                      Ajouter au projet
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/app/pro/${businessId}/services`}>Catalogue services</Link>
                    </Button>
                  </>
                )
              }
            />

            {pricingTotals.missingCount > 0 ? (
              <div className="mt-4 rounded-2xl border border-rose-200/60 bg-rose-50/60 p-3 text-xs text-rose-500">
                Prix manquant pour {pricingTotals.missingCount} service(s)
                {missingPriceNames.length ? ` : ${missingPriceNames.join(', ')}.` : '.'}
              </div>
            ) : null}

            {services.length ? (
              <div className="mt-4 space-y-4">
                {services.map((svc) => {
                  const draft = serviceDrafts[svc.id] ?? {
                    quantity: String(svc.quantity ?? 1),
                    price: formatEuroInput(svc.priceCents),
                    title: svc.titleOverride ?? '',
                    description: svc.description ?? svc.notes ?? '',
                    discountType: svc.discountType ?? 'NONE',
                    discountValue: svc.discountValue != null ? String(svc.discountValue) : '',
                    billingUnit: svc.billingUnit ?? 'ONE_OFF',
                    unitLabel: svc.unitLabel ?? '',
                  };
                  const line = pricingByServiceId.get(svc.id);
                  const lineError = lineErrors[svc.id];
                  const isLineSaving = lineSavingId === svc.id;
                  const isDragOver = dragOverServiceId === svc.id && draggingServiceId !== svc.id;
                  const catalog = catalogById.get(svc.serviceId);
                  const serviceTasks = tasksByServiceId.get(svc.id) ?? [];
                  const tasksOpen = openServiceTasks[svc.id];
                  const applyingTemplates = templatesApplying[svc.id];
                  const durationLabel =
                    catalog?.durationHours != null ? `${catalog.durationHours} h` : null;
                  const unitSuffix =
                    line?.unitLabel ?? (line?.billingUnit === 'MONTHLY' ? '/mois' : null);
                  const priceSourceLabel =
                    line?.priceSource === 'project'
                      ? 'Tarif projet'
                      : line?.priceSource === 'default'
                        ? 'Catalogue'
                        : line?.priceSource === 'tjm'
                          ? 'TJM'
                          : 'Prix manquant';
                  return (
                    <div
                      key={svc.id}
                      onDragOver={(event) => handleServiceDragOver(event, svc.id)}
                      onDrop={(event) => void handleServiceDrop(event, svc.id)}
                      className={`rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 p-4 ${isDragOver ? 'ring-2 ring-[var(--focus-ring)]' : ''}`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <button
                            type="button"
                            className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            draggable={isAdmin && !reordering}
                            onDragStart={(event) => handleServiceDragStart(event, svc.id)}
                            onDragEnd={handleServiceDragEnd}
                            aria-label="Réordonner le service"
                          >
                            <GripVertical size={16} />
                          </button>
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              {svc.titleOverride?.trim() || svc.service.name}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                              <span>{svc.service.code}</span>
                              {durationLabel ? <span>· Durée : {durationLabel}</span> : null}
                            </div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                              {priceSourceLabel}
                            </p>
                            {line?.missingPrice ? (
                              <p className="text-xs text-rose-500">Prix manquant</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2 text-right">
                          <p className={UI.label}>Total</p>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {formatCurrencyEUR(line?.totalCents ?? 0, { minimumFractionDigits: 0 })}
                            {unitSuffix ? ` ${unitSuffix}` : ''}
                          </p>
                          {line?.originalUnitPriceCents ? (
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              Avant remise :{' '}
                              {formatCurrencyEUR(line.originalUnitPriceCents, { minimumFractionDigits: 0 })}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <Input
                          label="Qté"
                          type="number"
                          min={1}
                          value={draft.quantity}
                          onChange={(e) =>
                            setServiceDrafts((prev) => ({
                              ...prev,
                              [svc.id]: { ...(prev[svc.id] ?? draft), quantity: e.target.value },
                            }))
                          }
                          onInput={() => setLineErrors((prev) => ({ ...prev, [svc.id]: '' }))}
                          disabled={!isAdmin || isLineSaving}
                        />
                        <Input
                          label="Prix unitaire (€)"
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.price}
                          onChange={(e) =>
                            setServiceDrafts((prev) => ({
                              ...prev,
                              [svc.id]: { ...(prev[svc.id] ?? draft), price: e.target.value },
                            }))
                          }
                          onInput={() => setLineErrors((prev) => ({ ...prev, [svc.id]: '' }))}
                          disabled={!isAdmin || isLineSaving}
                        />
                        <Input
                          label="Libellé (optionnel)"
                          value={draft.title}
                          onChange={(e) =>
                            setServiceDrafts((prev) => ({
                              ...prev,
                              [svc.id]: { ...(prev[svc.id] ?? draft), title: e.target.value },
                            }))
                          }
                          disabled={!isAdmin || isLineSaving}
                        />
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <Select
                          label="Remise"
                          value={draft.discountType}
                          onChange={(e) =>
                            setServiceDrafts((prev) => ({
                              ...prev,
                              [svc.id]: { ...(prev[svc.id] ?? draft), discountType: e.target.value },
                            }))
                          }
                          disabled={!isAdmin || isLineSaving}
                        >
                          <option value="NONE">Aucune</option>
                          <option value="PERCENT">%</option>
                          <option value="AMOUNT">€</option>
                        </Select>
                        <Input
                          label={draft.discountType === 'PERCENT' ? 'Valeur (%)' : 'Valeur (€)'}
                          type="number"
                          min={0}
                          step={draft.discountType === 'PERCENT' ? '1' : '0.01'}
                          value={draft.discountValue}
                          onChange={(e) =>
                            setServiceDrafts((prev) => ({
                              ...prev,
                              [svc.id]: { ...(prev[svc.id] ?? draft), discountValue: e.target.value },
                            }))
                          }
                          disabled={!isAdmin || isLineSaving || draft.discountType === 'NONE'}
                        />
                        <Select
                          label="Rythme"
                          value={draft.billingUnit}
                          onChange={(e) =>
                            setServiceDrafts((prev) => ({
                              ...prev,
                              [svc.id]: { ...(prev[svc.id] ?? draft), billingUnit: e.target.value },
                            }))
                          }
                          disabled={!isAdmin || isLineSaving}
                        >
                          <option value="ONE_OFF">Ponctuel</option>
                          <option value="MONTHLY">Mensuel</option>
                        </Select>
                        <Input
                          label="Unité"
                          value={draft.unitLabel}
                          onChange={(e) =>
                            setServiceDrafts((prev) => ({
                              ...prev,
                              [svc.id]: { ...(prev[svc.id] ?? draft), unitLabel: e.target.value },
                            }))
                          }
                          placeholder="/mois"
                          disabled={!isAdmin || isLineSaving || draft.billingUnit !== 'MONTHLY'}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setOpenNotes((prev) => ({ ...prev, [svc.id]: !prev[svc.id] }))
                            }
                          >
                            Description
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setOpenServiceTasks((prev) => ({ ...prev, [svc.id]: !prev[svc.id] }))
                            }
                          >
                            {tasksOpen ? 'Masquer tâches' : `Tâches (${serviceTasks.length})`}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteService(svc.id)}
                            disabled={!isAdmin || isLineSaving}
                          >
                            Supprimer
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateService(svc.id)}
                            disabled={!isAdmin || isLineSaving}
                          >
                            {isLineSaving ? 'Enregistrement…' : 'Enregistrer'}
                          </Button>
                        </div>
                      </div>

                      {openNotes[svc.id] ? (
                        <div className="mt-3 space-y-2">
                          <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
                          <textarea
                            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            rows={3}
                            value={draft.description}
                            onChange={(e) =>
                              setServiceDrafts((prev) => ({
                                ...prev,
                                [svc.id]: { ...(prev[svc.id] ?? draft), description: e.target.value },
                              }))
                            }
                            onInput={() => setLineErrors((prev) => ({ ...prev, [svc.id]: '' }))}
                            disabled={!isAdmin || isLineSaving}
                          />
                        </div>
                      ) : null}

                      {tasksOpen ? (
                        <div className="mt-4 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[var(--text-primary)]">Tâches liées</p>
                            {serviceTasks.length === 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApplyServiceTemplates(svc.id)}
                                disabled={!isAdmin || applyingTemplates}
                              >
                                {applyingTemplates ? 'Génération…' : 'Appliquer templates'}
                              </Button>
                            ) : null}
                          </div>
                          {serviceTasks.length ? (
                            <div className="mt-3 space-y-2">
                              {serviceTasks.map((task) => {
                                const isTaskSaving = taskUpdating[task.id];
                                return (
                                  <div
                                    key={task.id}
                                    className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                                          {task.title}
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary)]">
                                          {task.assigneeName || task.assigneeEmail || 'Non assigné'}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Select
                                          value={task.status}
                                          onChange={(e) => void updateTask(task.id, { status: e.target.value })}
                                          disabled={!isAdmin || isTaskSaving}
                                        >
                                          <option value="TODO">À faire</option>
                                          <option value="IN_PROGRESS">En cours</option>
                                          <option value="DONE">Terminée</option>
                                        </Select>
                                        <Select
                                          value={task.assigneeUserId ?? ''}
                                          onChange={(e) =>
                                            void updateTask(task.id, {
                                              assigneeUserId: e.target.value || null,
                                            })
                                          }
                                          disabled={!isAdmin || isTaskSaving}
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
                                          value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                                          onChange={(e) =>
                                            void updateTask(task.id, { dueDate: e.target.value || null })
                                          }
                                          disabled={!isAdmin || isTaskSaving}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-[var(--text-secondary)]">
                              Aucune tâche liée à ce service.
                            </p>
                          )}
                        </div>
                      ) : null}

                      {lineError ? <p className="mt-2 text-xs text-rose-500">{lineError}</p> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-6 text-center">
                <p className="text-base font-semibold text-[var(--text-primary)]">Créer un devis</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Ajoutez vos prestations, générez les tâches, puis créez le devis.
                </p>
                <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <Button onClick={openQuoteWizard} disabled={!isAdmin}>
                    Créer un devis
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href={`/app/pro/${businessId}/services`}>Créer un service dans le catalogue</Link>
                  </Button>
                </div>
                {!isAdmin ? (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>
                ) : null}
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <SectionHeader
              title="Devis"
              subtitle="Crée et gère les devis du projet."
              actions={
                isBillingEmpty ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCreateQuote}
                    disabled={!services.length || pricingTotals.missingCount > 0 || creatingQuote || !isAdmin}
                  >
                    {creatingQuote ? 'Création…' : 'Nouveau devis'}
                  </Button>
                )
              }
            />
            {pricingTotals.missingCount > 0 ? (
              <p className="mt-2 text-xs text-rose-500">
                Renseigne les tarifs manquants pour créer un devis.
              </p>
            ) : null}
            {quotes.length ? (
              <div className="mt-4 space-y-2">
                <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] md:gap-3">
                  <span className={UI.label}>Devis</span>
                  <span className={UI.label}>Statut</span>
                  <span className={cn(UI.label, 'text-right')}>Total</span>
                  <span className={cn(UI.label, 'text-right')}>Actions</span>
                </div>
                {quotes.map((quote) => {
                  const statusLabel = getQuoteStatusLabelFR(quote.status);
                  const dateLabel = formatDate(quote.issuedAt ?? quote.createdAt);
                  const pdfUrl = `/api/pro/businesses/${businessId}/quotes/${quote.id}/pdf`;
                  const canSend = quote.status === 'DRAFT';
                  const canSign = quote.status === 'SENT';
                  const canCancel = quote.status === 'DRAFT' || quote.status === 'SENT' || quote.status === 'SIGNED';
                  const canEdit = quote.status === 'DRAFT' || quote.status === 'SENT';
                  const canEditSignedDate = quote.status === 'SIGNED';
                  const canDelete =
                    (quote.status === 'DRAFT' || quote.status === 'CANCELLED' || quote.status === 'EXPIRED') &&
                    !quote.signedAt;
                  const canInvoice =
                    (quote.status === 'SENT' || quote.status === 'SIGNED') && !invoiceByQuoteId.has(quote.id);
                  const isReference = billingReferenceId === quote.id;
                  const canSetReference = quote.status === 'SIGNED' && !isReference;
                  return (
                    <div
                      key={quote.id}
                      className="flex flex-col gap-3 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 px-3 py-3 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] md:items-center md:gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {quote.number ?? `Devis #${quote.id}`}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{dateLabel}</p>
                        {isReference ? (
                          <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                            Référence
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] md:text-sm">
                        {statusLabel}
                      </div>
                      <div className="text-right text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrencyEUR(Number(quote.totalCents), { minimumFractionDigits: 0 })}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Button asChild size="sm" variant="outline">
                          <a href={pdfUrl} target="_blank" rel="noreferrer">
                            PDF
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openQuoteEditor(quote)}
                          disabled={!isAdmin || !canEdit || quoteActionId === quote.id}
                          title={!canEdit ? 'Devis signé: modification interdite.' : undefined}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openQuoteDateModal(quote)}
                          disabled={!isAdmin || !canEditSignedDate}
                        >
                          Date signature
                        </Button>
                        {quote.status === 'SIGNED' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSetBillingReference(quote.id)}
                            disabled={!isAdmin || !canSetReference || referenceUpdatingId === quote.id}
                          >
                            {isReference ? 'Référence' : 'Définir référence'}
                          </Button>
                        ) : null}
                        {canSend ? (
                          <Button
                            size="sm"
                            onClick={() => handleQuoteStatus(quote.id, 'SENT')}
                            disabled={!isAdmin || quoteActionId === quote.id}
                          >
                            Envoyer
                          </Button>
                        ) : null}
                        {canSign ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuoteStatus(quote.id, 'SIGNED')}
                            disabled={!isAdmin || quoteActionId === quote.id}
                          >
                            Signer
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openCancelQuoteModal(quote)}
                            disabled={!isAdmin || quoteActionId === quote.id}
                          >
                            Annuler
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCreateInvoice(quote.id)}
                          disabled={!canInvoice || !isAdmin || invoiceActionId === quote.id}
                        >
                          {invoiceByQuoteId.has(quote.id) ? 'Facture créée' : 'Créer facture'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteQuote(quote.id)}
                          disabled={!isAdmin || !canDelete || quoteActionId === quote.id}
                          title={!canDelete ? 'Suppression interdite pour un devis signé.' : undefined}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={cn(UI.sectionSoft, 'mt-4 text-xs text-[var(--text-secondary)]')}>
                Aucun devis existant.
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <SectionHeader
              title="Factures"
              subtitle="Générées à partir des devis envoyés/signés ou en facturation par étapes."
              actions={
                isBillingEmpty ? null : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openStagedInvoiceModal('DEPOSIT')}
                      disabled={!isAdmin || summaryTotals.totalCents <= 0}
                    >
                      Facture d’acompte
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openStagedInvoiceModal('MID')}
                      disabled={!isAdmin || summaryTotals.totalCents <= 0}
                    >
                      Facture intermédiaire
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openStagedInvoiceModal('FINAL')}
                      disabled={!isAdmin || remainingToInvoiceCents <= 0}
                    >
                      Facture finale
                    </Button>
                  </div>
                )
              }
            />
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Reste à facturer : {formatCurrencyEUR(remainingToInvoiceCents, { minimumFractionDigits: 0 })}
            </p>
            {invoices.length ? (
              <div className="mt-4 space-y-2">
                <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] md:gap-3">
                  <span className={UI.label}>Facture</span>
                  <span className={UI.label}>Statut</span>
                  <span className={cn(UI.label, 'text-right')}>Total</span>
                  <span className={cn(UI.label, 'text-right')}>Actions</span>
                </div>
                {invoices.map((invoice) => {
                  const statusLabel = getInvoiceStatusLabelFR(invoice.status);
                  const paymentStatusLabel = getPaymentStatusLabelFR(getInvoicePaymentStatus(invoice));
                  const dateLabel = formatDate(invoice.issuedAt ?? invoice.createdAt);
                  const pdfUrl = `/api/pro/businesses/${businessId}/invoices/${invoice.id}/pdf`;
                  const detailUrl = `/app/pro/${businessId}/finances/invoices/${invoice.id}`;
                  const paidCents = getInvoicePaidCents(invoice);
                  const remainingCents = getInvoiceRemainingCents(invoice);
                  const canSend = invoice.status === 'DRAFT';
                  const canCancel = invoice.status === 'DRAFT' || invoice.status === 'SENT';
                  const canEdit = invoice.status === 'DRAFT' || invoice.status === 'SENT';
                  const canEditPaidDate = invoice.status === 'PAID';
                  const canDelete = invoice.status === 'DRAFT' || invoice.status === 'CANCELLED';
                  const canManagePayments = invoice.status === 'SENT' || invoice.status === 'PAID';
                  const canMarkPaid = canManagePayments && remainingCents > 0;
                  return (
                    <div
                      key={invoice.id}
                      className="flex flex-col gap-3 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 px-3 py-3 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] md:items-center md:gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {invoice.number ?? `Facture #${invoice.id}`}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{dateLabel}</p>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] md:text-sm">
                        <span>{statusLabel}</span>
                        <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">
                          {paymentStatusLabel}
                        </span>
                      </div>
                      <div className="text-right text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrencyEUR(Number(invoice.totalCents), { minimumFractionDigits: 0 })}
                        <div className="mt-1 text-[11px] font-normal text-[var(--text-secondary)]">
                          Payé {formatCurrencyEUR(paidCents, { minimumFractionDigits: 0 })} · Reste{' '}
                          {formatCurrencyEUR(remainingCents, { minimumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Button asChild size="sm" variant="outline">
                          <a href={pdfUrl} target="_blank" rel="noreferrer">
                            PDF
                          </a>
                        </Button>
                        {canManagePayments ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPaymentModal(invoice)}
                            disabled={!isAdmin}
                          >
                            Paiements
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openInvoiceEditor(invoice.id)}
                          disabled={!isAdmin || !canEdit || invoiceActionId === invoice.id}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openInvoiceDateModal(invoice)}
                          disabled={!isAdmin || !canEditPaidDate}
                        >
                          Date paiement
                        </Button>
                        {canSend ? (
                          <Button
                            size="sm"
                            onClick={() => handleInvoiceStatus(invoice.id, 'SENT')}
                            disabled={!isAdmin || invoiceActionId === invoice.id}
                          >
                            Envoyer
                          </Button>
                        ) : null}
                        {canMarkPaid ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPaymentModal(invoice, remainingCents)}
                            disabled={!isAdmin || invoiceActionId === invoice.id}
                          >
                            Solder la facture
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleInvoiceStatus(invoice.id, 'CANCELLED')}
                            disabled={!isAdmin || invoiceActionId === invoice.id}
                          >
                            Annuler
                          </Button>
                        ) : null}
                        <Button asChild size="sm" variant="ghost">
                          <Link href={detailUrl}>Voir</Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          disabled={!isAdmin || !canDelete || invoiceActionId === invoice.id}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={cn(UI.sectionSoft, 'mt-4 text-xs text-[var(--text-secondary)]')}>
                Aucune facture pour le moment.
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <SectionHeader
              title="CGV & modalités"
              subtitle="Ces éléments sont intégrés automatiquement aux PDF."
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/settings/billing`}>Configurer</Link>
                </Button>
              }
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={legalConfigured ? 'personal' : 'performance'}>
                {legalConfigured ? 'Configuré' : 'À configurer'}
              </Badge>
              <span className="text-xs text-[var(--text-secondary)]">
                {legalBlocks.filled}/{legalBlocks.total} blocs renseignés
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {legalBlocks.blocks.map((block) => (
                <div key={block.label} className={cn(UI.sectionSoft, 'flex items-center justify-between')}>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{block.label}</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {(block.value ?? '').trim() ? 'Renseigné' : 'Manquant'}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'files' ? (
        <div className="space-y-5">
          <SectionCard>
            <SectionHeader
              title="Documents générés"
              subtitle="Devis et factures exportables du projet."
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/projects/${projectId}?tab=billing`}>Ouvrir la facturation</Link>
                </Button>
              }
            />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className={UI.label}>Devis</p>
                {quotes.length ? (
                  quotes.map((quote) => {
                    const statusLabel = getQuoteStatusLabelFR(quote.status);
                    const dateLabel = formatDate(quote.issuedAt ?? quote.createdAt);
                    const pdfUrl = `/api/pro/businesses/${businessId}/quotes/${quote.id}/pdf`;
                    return (
                      <div key={quote.id} className={cn(UI.sectionSoft, 'flex items-center justify-between gap-2')}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {quote.number ?? `Devis #${quote.id}`}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">{statusLabel} · {dateLabel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {formatCurrencyEUR(Number(quote.totalCents), { minimumFractionDigits: 0 })}
                          </span>
                          <Button asChild size="sm" variant="outline">
                            <a href={pdfUrl} target="_blank" rel="noreferrer">
                              PDF
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>
                    Aucun devis généré.
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className={UI.label}>Factures</p>
                {invoices.length ? (
                  invoices.map((invoice) => {
                    const statusLabel = getInvoiceStatusLabelFR(invoice.status);
                    const dateLabel = formatDate(invoice.issuedAt ?? invoice.createdAt);
                    const pdfUrl = `/api/pro/businesses/${businessId}/invoices/${invoice.id}/pdf`;
                    return (
                      <div key={invoice.id} className={cn(UI.sectionSoft, 'flex items-center justify-between gap-2')}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {invoice.number ?? `Facture #${invoice.id}`}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">{statusLabel} · {dateLabel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {formatCurrencyEUR(Number(invoice.totalCents), { minimumFractionDigits: 0 })}
                          </span>
                          <Button asChild size="sm" variant="outline">
                            <a href={pdfUrl} target="_blank" rel="noreferrer">
                              PDF
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>
                    Aucune facture générée.
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
          <SectionCard>
            <SectionHeader title="Administratif" actions={<Button size="sm" variant="outline">Upload</Button>} />
            <p className={UI.sectionSubtitle}>Aucun document administratif.</p>
          </SectionCard>
          <SectionCard>
            <SectionHeader title="Projet" actions={<Button size="sm" variant="outline">Upload</Button>} />
            <p className={UI.sectionSubtitle}>Aucun document projet pour l’instant.</p>
          </SectionCard>
        </div>
      ) : null}

      <Modal
        open={Boolean(stagedInvoiceModal)}
        onCloseAction={closeStagedInvoiceModal}
        title="Créer une facture d’étape"
        description="Définis le montant à facturer pour cette étape."
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Total projet : {formatCurrencyEUR(summaryTotals.totalCents, { minimumFractionDigits: 0 })} · Reste :{' '}
            {formatCurrencyEUR(remainingToInvoiceCents, { minimumFractionDigits: 0 })}
          </p>
          {stagedInvoiceModal?.kind === 'FINAL' ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Cette facture finalise le projet. Le montant correspond au reste à facturer.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Mode de facturation"
                value={stagedInvoiceModal?.mode ?? 'PERCENT'}
                onChange={(e) =>
                  setStagedInvoiceModal((prev) =>
                    prev ? { ...prev, mode: e.target.value as 'PERCENT' | 'AMOUNT' } : prev
                  )
                }
                disabled={!isAdmin || stagedInvoiceLoading}
              >
                <option value="PERCENT">Pourcentage</option>
                <option value="AMOUNT">Montant fixe</option>
              </Select>
              <Input
                label={stagedInvoiceModal?.mode === 'AMOUNT' ? 'Montant (€)' : 'Pourcentage (%)'}
                type="number"
                min={0}
                step={stagedInvoiceModal?.mode === 'AMOUNT' ? '0.01' : '1'}
                value={stagedInvoiceModal?.value ?? ''}
                onChange={(e) =>
                  setStagedInvoiceModal((prev) => (prev ? { ...prev, value: e.target.value } : prev))
                }
                disabled={!isAdmin || stagedInvoiceLoading}
              />
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              Montant estimé
            </p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {formatCurrencyEUR(stagedPreviewCents, { minimumFractionDigits: 0 })}
            </p>
            {stagedPreviewTooHigh ? (
              <p className="text-xs text-rose-500">Le montant dépasse le reste à facturer.</p>
            ) : null}
          </div>

          {stagedInvoiceError ? <p className="text-xs text-rose-500">{stagedInvoiceError}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={closeStagedInvoiceModal} disabled={stagedInvoiceLoading}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleCreateStagedInvoice}
              disabled={!isAdmin || stagedInvoiceLoading || stagedPreviewTooHigh}
            >
              {stagedInvoiceLoading ? 'Création…' : 'Créer la facture'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(quoteEditor)}
        onCloseAction={closeQuoteEditor}
        title="Modifier le devis"
        description="Mets à jour les dates, notes et lignes du devis."
      >
        <div className="space-y-3">
          {!canEditQuoteMeta ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Devis verrouillé (signé/annulé). Les modifications sont désactivées.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Émission"
              type="date"
              value={quoteEditor?.issuedAt ?? ''}
              onChange={(e) =>
                setQuoteEditor((prev) => (prev ? { ...prev, issuedAt: e.target.value } : prev))
              }
              disabled={!isAdmin || !canEditQuoteMeta || quoteEditing}
            />
            <Input
              label="Expiration"
              type="date"
              value={quoteEditor?.expiresAt ?? ''}
              onChange={(e) =>
                setQuoteEditor((prev) => (prev ? { ...prev, expiresAt: e.target.value } : prev))
              }
              disabled={!isAdmin || !canEditQuoteMeta || quoteEditing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Note</label>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              rows={3}
              value={quoteEditor?.note ?? ''}
              onChange={(e) =>
                setQuoteEditor((prev) => (prev ? { ...prev, note: e.target.value } : prev))
              }
              disabled={!isAdmin || !canEditQuoteMeta || quoteEditing}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Lignes</p>
              <Button size="sm" variant="outline" onClick={addQuoteLine} disabled={!isAdmin || !canEditQuoteLines}>
                Ajouter une ligne
              </Button>
            </div>
            {quoteEditor?.lines.map((line) => (
              <div key={line.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_120px_140px_auto] md:items-end">
                  <Input
                    label="Libellé"
                    value={line.label}
                    onChange={(e) =>
                      setQuoteEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              lines: prev.lines.map((l) => (l.id === line.id ? { ...l, label: e.target.value } : l)),
                            }
                          : prev
                      )
                    }
                    disabled={!isAdmin || !canEditQuoteLines || quoteEditing}
                  />
                  <Input
                    label="Qté"
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setQuoteEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              lines: prev.lines.map((l) =>
                                l.id === line.id ? { ...l, quantity: e.target.value } : l
                              ),
                            }
                          : prev
                      )
                    }
                    disabled={!isAdmin || !canEditQuoteLines || quoteEditing}
                  />
                  <Input
                    label="Prix (€)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setQuoteEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              lines: prev.lines.map((l) =>
                                l.id === line.id ? { ...l, unitPrice: e.target.value } : l
                              ),
                            }
                          : prev
                      )
                    }
                    disabled={!isAdmin || !canEditQuoteLines || quoteEditing}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeQuoteLine(line.id)}
                    disabled={!isAdmin || !canEditQuoteLines || quoteEditing}
                  >
                    Supprimer
                  </Button>
                </div>
                <div className="mt-2 space-y-1">
                  <label className="text-xs text-[var(--text-secondary)]">Description</label>
                  <textarea
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    rows={2}
                    value={line.description}
                    onChange={(e) =>
                      setQuoteEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              lines: prev.lines.map((l) =>
                                l.id === line.id ? { ...l, description: e.target.value } : l
                              ),
                            }
                          : prev
                      )
                    }
                    disabled={!isAdmin || !canEditQuoteLines || quoteEditing}
                  />
                </div>
              </div>
            ))}
          </div>

          {quoteEditError ? <p className="text-sm text-rose-500">{quoteEditError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeQuoteEditor}>
              Annuler
            </Button>
            <Button onClick={handleSaveQuoteEdit} disabled={!isAdmin || !canEditQuoteMeta || quoteEditing}>
              {quoteEditing ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(invoiceEditor)}
        onCloseAction={closeInvoiceEditor}
        title="Modifier la facture"
        description="Mets à jour les dates, notes et lignes de la facture."
      >
        <div className="space-y-3">
          {!canEditInvoiceMeta ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Facture verrouillée (payée/annulée). Les modifications sont désactivées.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Émission"
              type="date"
              value={invoiceEditor?.issuedAt ?? ''}
              onChange={(e) =>
                setInvoiceEditor((prev) => (prev ? { ...prev, issuedAt: e.target.value } : prev))
              }
              disabled={!isAdmin || !canEditInvoiceMeta || invoiceEditing}
            />
            <Input
              label="Échéance"
              type="date"
              value={invoiceEditor?.dueAt ?? ''}
              onChange={(e) =>
                setInvoiceEditor((prev) => (prev ? { ...prev, dueAt: e.target.value } : prev))
              }
              disabled={!isAdmin || !canEditInvoiceMeta || invoiceEditing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Note</label>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              rows={3}
              value={invoiceEditor?.note ?? ''}
              onChange={(e) =>
                setInvoiceEditor((prev) => (prev ? { ...prev, note: e.target.value } : prev))
              }
              disabled={!isAdmin || !canEditInvoiceMeta || invoiceEditing}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Lignes</p>
              <Button size="sm" variant="outline" onClick={addInvoiceLine} disabled={!isAdmin || !canEditInvoiceLines}>
                Ajouter une ligne
              </Button>
            </div>
            {invoiceEditor?.lines.map((line) => (
              <div key={line.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_120px_140px_auto] md:items-end">
                  <Input
                    label="Libellé"
                    value={line.label}
                    onChange={(e) =>
                      setInvoiceEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              lines: prev.lines.map((l) => (l.id === line.id ? { ...l, label: e.target.value } : l)),
                            }
                          : prev
                      )
                    }
                    disabled={!isAdmin || !canEditInvoiceLines || invoiceEditing}
                  />
                  <Input
                    label="Qté"
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setInvoiceEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              lines: prev.lines.map((l) =>
                                l.id === line.id ? { ...l, quantity: e.target.value } : l
                              ),
                            }
                          : prev
                      )
                    }
                    disabled={!isAdmin || !canEditInvoiceLines || invoiceEditing}
                  />
                  <Input
                    label="Prix (€)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setInvoiceEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              lines: prev.lines.map((l) =>
                                l.id === line.id ? { ...l, unitPrice: e.target.value } : l
                              ),
                            }
                          : prev
                      )
                    }
                    disabled={!isAdmin || !canEditInvoiceLines || invoiceEditing}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeInvoiceLine(line.id)}
                    disabled={!isAdmin || !canEditInvoiceLines || invoiceEditing}
                  >
                    Supprimer
                  </Button>
                </div>
                <div className="mt-2 space-y-1">
                  <label className="text-xs text-[var(--text-secondary)]">Description</label>
                  <textarea
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    rows={2}
                    value={line.description}
                    onChange={(e) =>
                      setInvoiceEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              lines: prev.lines.map((l) =>
                                l.id === line.id ? { ...l, description: e.target.value } : l
                              ),
                            }
                          : prev
                      )
                    }
                    disabled={!isAdmin || !canEditInvoiceLines || invoiceEditing}
                  />
                </div>
              </div>
            ))}
          </div>

          {invoiceEditError ? <p className="text-sm text-rose-500">{invoiceEditError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeInvoiceEditor}>
              Annuler
            </Button>
            <Button onClick={handleSaveInvoiceEdit} disabled={!isAdmin || !canEditInvoiceMeta || invoiceEditing}>
              {invoiceEditing ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(quoteDateEditor)}
        onCloseAction={() => setQuoteDateEditor(null)}
        title="Date de signature"
        description="Modifie la date de validation du devis."
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            {quoteDateEditor?.number ?? `Devis #${quoteDateEditor?.quoteId ?? ''}`} · Statut {quoteDateEditor?.status ?? '—'}
          </p>
          <Input
            label="Date de signature"
            type="date"
            value={quoteDateEditor?.signedAt ?? ''}
            onChange={(e) =>
              setQuoteDateEditor((prev) => (prev ? { ...prev, signedAt: e.target.value } : prev))
            }
            disabled={!isAdmin || dateModalSaving}
          />
          {dateModalError ? <p className="text-sm text-rose-500">{dateModalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQuoteDateEditor(null)}>
              Annuler
            </Button>
            <Button onClick={handleSaveQuoteDate} disabled={!isAdmin || dateModalSaving}>
              {dateModalSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(cancelQuoteEditor)}
        onCloseAction={() => setCancelQuoteEditor(null)}
        title="Annuler le devis"
        description="L’annulation requiert une raison et bloque le devis."
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            {cancelQuoteEditor?.number ?? `Devis #${cancelQuoteEditor?.quoteId ?? ''}`} · Statut{' '}
            {cancelQuoteEditor?.status ?? '—'}
          </p>
          <label className="text-xs font-medium text-[var(--text-secondary)]">Raison</label>
          <textarea
            className="min-h-[120px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            value={cancelQuoteEditor?.reason ?? ''}
            onChange={(e) =>
              setCancelQuoteEditor((prev) => (prev ? { ...prev, reason: e.target.value } : prev))
            }
            disabled={!isAdmin || cancelQuoteSaving}
          />
          {cancelQuoteError ? <p className="text-sm text-rose-500">{cancelQuoteError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelQuoteEditor(null)}>
              Annuler
            </Button>
            <Button onClick={handleCancelQuote} disabled={!isAdmin || cancelQuoteSaving}>
              {cancelQuoteSaving ? 'Annulation…' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(invoiceDateEditor)}
        onCloseAction={() => setInvoiceDateEditor(null)}
        title="Date de paiement"
        description="Modifie la date de règlement de la facture."
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            {invoiceDateEditor?.number ?? `Facture #${invoiceDateEditor?.invoiceId ?? ''}`} · Statut {invoiceDateEditor?.status ?? '—'}
          </p>
          <Input
            label="Date de paiement"
            type="date"
            value={invoiceDateEditor?.paidAt ?? ''}
            onChange={(e) =>
              setInvoiceDateEditor((prev) => (prev ? { ...prev, paidAt: e.target.value } : prev))
            }
            disabled={!isAdmin || dateModalSaving}
          />
          {dateModalError ? <p className="text-sm text-rose-500">{dateModalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInvoiceDateEditor(null)}>
              Annuler
            </Button>
            <Button onClick={handleSaveInvoiceDate} disabled={!isAdmin || dateModalSaving}>
              {dateModalSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={quoteWizardOpen}
        onCloseAction={closeQuoteWizard}
        title="Créer un devis"
        description="Ajoutez vos prestations, générez les tâches, puis créez le devis."
      >
        <div className="space-y-4">
          {quoteWizardResult ? (
            <div className="space-y-4">
              <Alert variant="success" title="Devis généré" />
              <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-4 text-sm text-[var(--text-secondary)]">
                {quoteWizardGenerateTasks
                  ? 'Les prestations et les tâches recommandées ont été ajoutées au projet.'
                  : 'Les prestations ont été ajoutées au projet. Les tâches peuvent être créées plus tard.'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm">
                  <a href={quoteWizardResult.pdfUrl} target="_blank" rel="noreferrer">
                    Télécharger le PDF
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    closeQuoteWizard();
                    setActiveTab('billing');
                  }}
                >
                  Voir le devis
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    closeQuoteWizard();
                    openStagedInvoiceModal('DEPOSIT');
                  }}
                >
                  Facture d’acompte
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                {WIZARD_STEPS.map((label, idx) => (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border text-[11px]',
                        idx === quoteWizardStep
                          ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)]'
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span className={idx === quoteWizardStep ? 'text-[var(--text-primary)]' : ''}>{label}</span>
                    {idx < WIZARD_STEPS.length - 1 ? <span className="text-[var(--text-faint)]">→</span> : null}
                  </div>
                ))}
              </div>

              {quoteWizardStep === 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Rechercher un service"
                      value={quoteWizardSearch}
                      onChange={(e) => {
                        const value = e.target.value;
                        setQuoteWizardSearch(value);
                        void loadCatalogServices(value);
                      }}
                    />
                    <div className="max-h-52 space-y-2 overflow-auto rounded-2xl border border-[var(--border)]/60 p-2">
                      {catalogSearchResults.map((svc) => {
                        const priceHint = svc.defaultPriceCents ?? svc.tjmCents;
                        return (
                          <div
                            key={svc.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--text-primary)]">{svc.name}</p>
                              <p className="text-xs text-[var(--text-secondary)]">{svc.code}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[var(--text-secondary)]">
                                {priceHint
                                  ? formatCurrencyEUR(Number(priceHint), { minimumFractionDigits: 0 })
                                  : 'Prix manquant'}
                              </span>
                              <Button size="sm" variant="outline" onClick={() => addCatalogLine(svc)}>
                                Ajouter
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {catalogSearchResults.length === 0 ? (
                        <p className="px-2 text-sm text-[var(--text-secondary)]">Aucun service trouvé.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Prestations sélectionnées</p>
                    <Button size="sm" variant="ghost" onClick={addCustomLine}>
                      Ligne personnalisée
                    </Button>
                  </div>

                  {quoteWizardLines.length ? (
                    <div className="space-y-3">
                      {quoteWizardLines.map((line) => {
                        const errors = wizardLineValidation.find((entry) => entry.id === line.id)?.errors ?? [];
                        const priceInput = line.unitPriceCents != null ? formatEuroInput(String(line.unitPriceCents)) : '';
                        return (
                          <div
                            key={line.id}
                            className={cn(
                              'rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-4',
                              errors.length ? 'border-rose-200/70' : ''
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                                  {line.source === 'custom'
                                    ? 'Ligne personnalisée'
                                    : line.code
                                      ? `Service · ${line.code}`
                                      : 'Service'}
                                </p>
                                <Input
                                  label="Titre"
                                  value={line.title}
                                  onChange={(e) => updateWizardLine(line.id, { title: e.target.value })}
                                />
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => removeWizardLine(line.id)}>
                                Supprimer
                              </Button>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <Input
                                label="Qté"
                                type="number"
                                min={1}
                                value={line.quantity}
                                onChange={(e) =>
                                  updateWizardLine(line.id, {
                                    quantity: Math.max(1, Math.trunc(Number(e.target.value) || 1)),
                                  })
                                }
                              />
                              {line.priceLocked ? (
                                <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                                    Prix catalogue
                                  </p>
                                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                                    {line.unitPriceCents != null
                                      ? formatCurrencyEUR(line.unitPriceCents, { minimumFractionDigits: 0 })
                                      : '—'}
                                  </p>
                                </div>
                              ) : (
                                <Input
                                  label="Prix unitaire (€)"
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={priceInput}
                                  onChange={(e) =>
                                    updateWizardLine(line.id, { unitPriceCents: parseEuroInput(e.target.value) })
                                  }
                                />
                              )}
                            </div>

                            <div className="mt-3">
                              <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
                              <textarea
                                className="mt-1 min-h-[90px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                                value={line.description}
                                onChange={(e) => updateWizardLine(line.id, { description: e.target.value })}
                                placeholder="Optionnel"
                              />
                            </div>

                            {errors.length ? (
                              <p className="mt-2 text-xs text-rose-500">{errors.join(' ')}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={cn(UI.sectionSoft, 'text-sm text-[var(--text-secondary)]')}>
                      Aucune prestation sélectionnée.
                    </div>
                  )}

                  <p className="text-xs text-[var(--text-secondary)]">
                    Les lignes personnalisées seront ajoutées au catalogue pour réutilisation.
                  </p>
                </div>
              ) : null}

              {quoteWizardStep === 1 ? (
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={quoteWizardGenerateTasks}
                      onChange={(e) => setQuoteWizardGenerateTasks(e.target.checked)}
                      disabled={!isAdmin}
                    />
                    Créer les tâches recommandées
                  </label>

                  {quoteWizardGenerateTasks ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select
                          label="Assigner à"
                          value={quoteWizardAssigneeId}
                          onChange={(e) => setQuoteWizardAssigneeId(e.target.value)}
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
                          label="Échéance dans (jours)"
                          type="number"
                          min={0}
                          max={365}
                          value={quoteWizardDueOffsetDays}
                          onChange={(e) => setQuoteWizardDueOffsetDays(e.target.value)}
                          disabled={!isAdmin}
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Aperçu des tâches</p>
                        {quoteWizardLines.length === 0 ? (
                          <p className="text-xs text-[var(--text-secondary)]">Ajoute des prestations d’abord.</p>
                        ) : (
                          <div className="space-y-2">
                            {quoteWizardLines.map((line) => {
                              const templates = line.serviceId ? serviceTemplates[line.serviceId] ?? [] : [];
                              const loading = line.serviceId ? templatesLoading[line.serviceId] : false;
                              return (
                                <div
                                  key={line.id}
                                  className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] p-3"
                                >
                                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                                    {line.title.trim() || 'Prestation'}
                                  </p>
                                  {line.source === 'custom' ? (
                                    <p className="text-[11px] text-[var(--text-secondary)]">
                                      Aucune tâche recommandée pour une ligne personnalisée.
                                    </p>
                                  ) : loading ? (
                                    <p className="text-[11px] text-[var(--text-secondary)]">Chargement des templates…</p>
                                  ) : templates.length ? (
                                    <ul className="mt-1 space-y-1 text-[11px] text-[var(--text-secondary)]">
                                      {templates.map((tpl) => (
                                        <li key={tpl.id}>• {tpl.title}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-[11px] text-[var(--text-secondary)]">Aucun template disponible.</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      Vous pourrez créer les tâches plus tard depuis chaque prestation.
                    </p>
                  )}
                </div>
              ) : null}

              {quoteWizardStep === 2 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={cn(UI.sectionSoft, 'text-right')}>
                      <p className={UI.label}>Prestations</p>
                      <p className={UI.value}>{quoteWizardLines.length}</p>
                    </div>
                    <div className={cn(UI.sectionSoft, 'text-right')}>
                      <p className={UI.label}>Tâches</p>
                      <p className={UI.value}>{quoteWizardGenerateTasks ? 'Activées' : 'Non'}</p>
                    </div>
                    <div className={cn(UI.sectionSoft, 'text-right')}>
                      <p className={UI.label}>Total</p>
                      <p className={UI.value}>Calculé dans le devis</p>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Le devis calculera automatiquement le total à partir des prestations ajoutées.
                  </p>
                </div>
              ) : null}

              {quoteWizardError ? <p className="text-sm text-rose-500">{quoteWizardError}</p> : null}
              {quoteWizardInfo ? <p className="text-sm text-emerald-600">{quoteWizardInfo}</p> : null}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" onClick={closeQuoteWizard}>
                  Annuler
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  {quoteWizardStep > 0 ? (
                    <Button
                      variant="outline"
                      onClick={() => setQuoteWizardStep((prev) => Math.max(0, prev - 1))}
                    >
                      Retour
                    </Button>
                  ) : null}
                  {quoteWizardStep < 2 ? (
                    <Button
                      onClick={() => setQuoteWizardStep((prev) => Math.min(2, prev + 1))}
                      disabled={quoteWizardStep === 0 && !wizardCanContinue}
                    >
                      Continuer
                    </Button>
                  ) : (
                    <Button onClick={handleWizardGenerateQuote} disabled={quoteWizardSaving || !wizardCanContinue}>
                      {quoteWizardSaving ? 'Génération…' : 'Générer le devis'}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(paymentModal)}
        onCloseAction={closePaymentModal}
        title="Paiements"
        description="Ajoute un règlement et consulte l’historique."
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            {activePaymentInvoice
              ? `${activePaymentInvoice.number ?? `Facture #${activePaymentInvoice.id}`} · Total ${formatCurrencyEUR(
                  paymentTotalCents,
                  { minimumFractionDigits: 0 }
                )}`
              : 'Facture sélectionnée'}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className={cn(UI.sectionSoft, 'text-right')}>
              <p className={UI.label}>Total</p>
              <p className={UI.value}>{formatCurrencyEUR(paymentTotalCents, { minimumFractionDigits: 0 })}</p>
            </div>
            <div className={cn(UI.sectionSoft, 'text-right')}>
              <p className={UI.label}>Payé</p>
              <p className={UI.value}>{formatCurrencyEUR(paymentPaidCents, { minimumFractionDigits: 0 })}</p>
            </div>
            <div className={cn(UI.sectionSoft, 'text-right')}>
              <p className={UI.label}>Reste</p>
              <p className={UI.value}>{formatCurrencyEUR(paymentRemainingCents, { minimumFractionDigits: 0 })}</p>
            </div>
          </div>
          {paymentNotice ? <Alert variant="success" title={paymentNotice} /> : null}

          <div className="space-y-2">
            <p className={UI.label}>Historique</p>
            {paymentLoading ? (
              <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>Chargement…</div>
            ) : paymentItems.length ? (
              <div className="space-y-2">
                {paymentItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrencyEUR(Number(item.amountCents), { minimumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {formatDate(item.paidAt)} · {PAYMENT_METHOD_LABELS[item.method] ?? item.method}
                        {item.reference ? ` · ${item.reference}` : ''}
                      </p>
                      {item.note || item.createdBy?.name || item.createdBy?.email ? (
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {item.note ? item.note : ''}
                          {item.note && (item.createdBy?.name || item.createdBy?.email) ? ' · ' : ''}
                          {item.createdBy?.name || item.createdBy?.email
                            ? `par ${item.createdBy?.name ?? item.createdBy?.email}`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeletePayment(item.id)}
                      disabled={!isAdmin || paymentDeletingId === item.id || activePaymentInvoice?.status === 'CANCELLED'}
                    >
                      Supprimer
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>
                Aucun paiement enregistré.
              </div>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <Input
              label="Montant (€)"
              type="number"
              min={0}
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
              disabled={!isAdmin || paymentSaving}
            />
            <Input
              label="Date de paiement"
              type="date"
              value={paymentForm.paidAt}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, paidAt: e.target.value }))}
              disabled={!isAdmin || paymentSaving}
            />
            <Select
              label="Mode"
              value={paymentForm.method}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
              disabled={!isAdmin || paymentSaving}
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              label="Référence"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
              disabled={!isAdmin || paymentSaving}
            />
            <Input
              label="Note"
              value={paymentForm.note}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
              disabled={!isAdmin || paymentSaving}
            />
          </div>
          {paymentRemainingCents > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className={UI.label}>Raccourcis</span>
              {[0.25, 0.5, 1].map((ratio) => (
                <Button
                  key={ratio}
                  size="sm"
                  variant="ghost"
                  onClick={() => applyPaymentShortcut(ratio)}
                  disabled={!isAdmin || paymentSaving}
                >
                  {Math.round(ratio * 100)}%
                </Button>
              ))}
            </div>
          ) : null}

          {paymentError ? <p className="text-sm text-rose-500">{paymentError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closePaymentModal}>
              Annuler
            </Button>
            <Button onClick={handleSavePayment} disabled={!isAdmin || paymentSaving || paymentRemainingCents <= 0}>
              {paymentSaving ? 'Enregistrement…' : 'Enregistrer le paiement'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={depositDateEditorOpen}
        onCloseAction={() => setDepositDateEditorOpen(false)}
        title="Date acompte"
        description="Renseigne la date comptable de paiement de l’acompte."
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Statut acompte : {getProjectDepositStatusLabelFR(project?.depositStatus ?? null)}
          </p>
          <Input
            label="Date de paiement"
            type="date"
            value={depositPaidDraft}
            onChange={(e) => setDepositPaidDraft(e.target.value)}
            disabled={!isAdmin || dateModalSaving}
          />
          {dateModalError ? <p className="text-sm text-rose-500">{dateModalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDepositDateEditorOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveDepositDate} disabled={!isAdmin || dateModalSaving}>
              {dateModalSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'client'}
        onCloseAction={closeModal}
        title="Associer un client"
        description="Sélectionne un client existant."
      >
        <div className="space-y-3">
          <Input
            placeholder="Rechercher un client"
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              void loadClients(e.target.value);
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
          </div>
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleAttachClient} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Associer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'deadline'}
        onCloseAction={closeModal}
        title="Définir l’échéance"
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
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleUpdateDates} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'services'}
        onCloseAction={closeModal}
        title="Ajouter des services au projet"
        description="Sélectionne les services du catalogue."
      >
        <div className="space-y-3">
          <Input
            placeholder="Rechercher un service"
            value={serviceSearch}
            onChange={(e) => {
              setServiceSearch(e.target.value);
              void loadCatalogServices(e.target.value);
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
                    <p className="text-xs text-[var(--text-secondary)]">Sélectionne un service pour voir les templates.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedServiceIds.map((serviceId) => {
                        const svc = catalogSearchResults.find((item) => item.id === serviceId) ?? catalogById.get(serviceId);
                        const templates = serviceTemplates[serviceId] ?? [];
                        const loading = templatesLoading[serviceId];
                        return (
                          <div key={serviceId} className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)] p-2">
                            <p className="text-xs font-semibold text-[var(--text-primary)]">
                              {svc?.name ?? `Service #${serviceId}`}
                            </p>
                            {loading ? (
                              <p className="text-[11px] text-[var(--text-secondary)]">Chargement des templates…</p>
                            ) : templates.length ? (
                              <ul className="mt-1 space-y-1 text-[11px] text-[var(--text-secondary)]">
                                {templates.map((tpl) => (
                                  <li key={tpl.id}>• {tpl.title}{tpl.phase ? ` · ${tpl.phase}` : ''}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11px] text-[var(--text-secondary)]">Aucun template pour ce service.</p>
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
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleAddServices} disabled={saving}>
              {saving ? 'Ajout…' : 'Ajouter au projet'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'tasks'}
        onCloseAction={closeModal}
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
            {tasks.filter((t) => t.status !== 'DONE').slice(0, 10).map((task) => (
              <div key={task.id} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-2)]/70 p-3">
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
                    onChange={(e) => void updateTaskDueDate(task.id, e.target.value)}
                  />
                </div>
              </div>
            ))}
            {tasks.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Aucune tâche.</p> : null}
          </div>
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleAssignTasks} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'team'}
        onCloseAction={closeModal}
        title="Ajouter des membres"
        description="Invite un membre de l’entreprise."
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
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleInviteMember} disabled={saving}>
              {saving ? 'Invitation…' : 'Inviter'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'documents'}
        onCloseAction={closeModal}
        title="Ajouter un document"
        description={project?.clientId ? 'Charge un document lié au client.' : 'Associe d’abord un client.'}
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
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleUploadDocument} disabled={saving || !project?.clientId}>
              {saving ? 'Upload…' : 'Uploader'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={accessModalOpen}
        onCloseAction={() => {
          setAccessModalOpen(false);
          setAccessInfo(null);
        }}
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
                          onClick={() => handleRemoveProjectMember(member.membershipId)}
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
                      onClick={() => handleAddProjectMember(member.membershipId)}
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
          {accessInfo ? <p className="text-sm text-emerald-600">{accessInfo}</p> : null}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAccessModalOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={unitsModalOpen}
        onCloseAction={() => {
          setUnitsModalOpen(false);
          setUnitErrors(null);
        }}
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
            <Button size="sm" onClick={handleCreateUnit} disabled={!isAdmin}>
              Ajouter
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Pôles existants</p>
            {organizationUnits.length ? (
              <div className="space-y-2">
                {organizationUnits.map((unit) => (
                  <div key={unit.id} className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 p-3">
                    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-center">
                      <Input
                        value={unitDrafts[unit.id]?.name ?? unit.name}
                        onChange={(e) =>
                          setUnitDrafts((prev) => ({
                            ...prev,
                            [unit.id]: { name: e.target.value, order: prev[unit.id]?.order ?? String(unit.order) },
                          }))
                        }
                      />
                      <Input
                        type="number"
                        value={unitDrafts[unit.id]?.order ?? String(unit.order)}
                        onChange={(e) =>
                          setUnitDrafts((prev) => ({
                            ...prev,
                            [unit.id]: { name: prev[unit.id]?.name ?? unit.name, order: e.target.value },
                          }))
                        }
                      />
                      <Button size="sm" variant="outline" onClick={() => handleUpdateUnit(unit.id)} disabled={!isAdmin}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteUnit(unit.id)} disabled={!isAdmin}>
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Aucun pôle configuré.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Assignation des membres</p>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.membershipId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <InitialsAvatar name={member.name} email={member.email} size={24} />
                    <div className="min-w-0">
                      <p className="truncate text-[var(--text-primary)]">{member.name ?? member.email}</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">{member.role}</p>
                    </div>
                  </div>
                  <Select
                    value={member.organizationUnit?.id ?? ''}
                    onChange={(e) => handleAssignMemberToUnit(member.membershipId, e.target.value || null)}
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
          </div>

          {unitErrors ? <p className="text-sm text-rose-500">{unitErrors}</p> : null}
          {teamInfo ? <p className="text-sm text-emerald-600">{teamInfo}</p> : null}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setUnitsModalOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
