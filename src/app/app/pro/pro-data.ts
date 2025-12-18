// src/app/app/pro/pro-data.ts

export type AuditInfo = {
  updatedAt: string;
  updatedBy: string;
};

export type BillingSettings = {
  legalName: string;
  address: string;
  currency: string;
  invoicePrefix: string;
  invoiceNextNumber: number;
  iban?: string;
  timezone: string;
  notes?: string;
} & AuditInfo;

export type TaxSettings = {
  vatRate: number;
  vatPeriod: 'MONTHLY' | 'QUARTERLY';
  vatNumber: string;
  country: string;
  lastFiledAt?: string | null;
} & AuditInfo;

export type IntegrationSetting = {
  key: string;
  name: string;
  status: 'connected' | 'disconnected';
  note?: string;
  connectedAt?: string | null;
} & AuditInfo;

export type PermissionRow = {
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  finance: 'full' | 'edit' | 'view' | 'none';
  admin: 'full' | 'edit' | 'view' | 'none';
  references: 'full' | 'edit' | 'view' | 'none';
} & AuditInfo;

export type PaymentStatus = 'PAID' | 'PENDING' | 'LATE';
export type PaymentMethod = 'VIREMENT' | 'CARTE' | 'CHEQUE' | 'ESPECES';

export type PaymentRow = {
  id: string;
  businessId: string;
  invoiceId?: string;
  clientName: string;
  project?: string;
  amount: number;
  currency: string;
  receivedAt: string;
  expectedAt: string;
  method: PaymentMethod;
  status: PaymentStatus;
  note?: string;
};

export type TreasuryEntry = {
  id: string;
  date: string;
  label: string;
  type: 'INFLOW' | 'OUTFLOW';
  amount: number;
  currency: string;
  category: string;
  source?: string;
  note?: string;
};

export type VatPeriod = {
  id: string;
  period: string;
  collected: number;
  deductible: number;
  due: number;
  status: 'draft' | 'filed' | 'paid';
  dueAt: string;
};

export type ForecastRow = {
  id: string;
  month: string;
  revenue: number;
  expenses: number;
  net: number;
  runway: number;
};

export type AdminDocument = {
  id: string;
  title: string;
  category: string;
  status: 'valid' | 'expiring' | 'expired';
  expiresAt?: string | null;
  fileUrl?: string;
  owner: string;
  updatedAt: string;
};

export type Deadline = {
  id: string;
  title: string;
  dueAt: string;
  recurrence: string | null;
  linkedTo: string;
  status: 'open' | 'done' | 'late';
  owner: string;
};

export type CategoryRef = {
  id: string;
  name: string;
  scope: 'income' | 'expense' | 'task';
  parentId?: string | null;
  color?: string | null;
};

export type TagRef = {
  id: string;
  name: string;
  color?: string | null;
};

export type AutomationRule = {
  id: string;
  trigger: string;
  action: string;
  status: 'active' | 'paused';
  config: string;
};

export type NumberingSetting = {
  id: string;
  docType: string;
  prefix: string;
  nextNumber: number;
  pad: number;
  suffix?: string;
} & AuditInfo;

const now = new Date();

export const defaultBillingSettings: BillingSettings = {
  legalName: 'Studio Fief',
  address: '12 rue de la Lune, 75002 Paris',
  currency: 'EUR',
  invoicePrefix: 'INV-',
  invoiceNextNumber: 1280,
  iban: 'FR76 9999 9999 9999 9999 9999 999',
  timezone: 'Europe/Paris',
  notes: 'Règlement à 30 jours par virement.',
  updatedAt: now.toISOString(),
  updatedBy: 'system',
};

export const defaultTaxSettings: TaxSettings = {
  vatRate: 20,
  vatPeriod: 'QUARTERLY',
  vatNumber: 'FR12345678901',
  country: 'France',
  lastFiledAt: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString(),
  updatedAt: now.toISOString(),
  updatedBy: 'system',
};

export const defaultIntegrations: IntegrationSetting[] = [
  {
    key: 'crm',
    name: 'CRM',
    status: 'disconnected',
    note: 'Synchro contacts et deals',
    connectedAt: null,
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'compta',
    name: 'Comptabilité',
    status: 'connected',
    note: 'Export écritures',
    connectedAt: new Date(now.getFullYear(), now.getMonth() - 2, 12).toISOString(),
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
  {
    key: 'support',
    name: 'Support',
    status: 'disconnected',
    note: 'Tickets & SLA',
    connectedAt: null,
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
];

export const defaultPermissions: PermissionRow[] = [
  {
    role: 'OWNER',
    finance: 'full',
    admin: 'full',
    references: 'full',
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
  {
    role: 'ADMIN',
    finance: 'edit',
    admin: 'edit',
    references: 'edit',
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
  {
    role: 'MEMBER',
    finance: 'view',
    admin: 'view',
    references: 'edit',
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
  {
    role: 'VIEWER',
    finance: 'view',
    admin: 'view',
    references: 'view',
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
];

const basePayments: PaymentRow[] = [
  {
    id: 'pay-001',
    businessId: '1',
    invoiceId: 'INV-1200',
    clientName: 'NovaCorp',
    project: 'Refonte site',
    amount: 4200,
    currency: 'EUR',
    receivedAt: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(),
    expectedAt: new Date(now.getFullYear(), now.getMonth(), -2).toISOString(),
    method: 'VIREMENT',
    status: 'PAID',
    note: 'Payé en avance',
  },
  {
    id: 'pay-002',
    businessId: '1',
    invoiceId: 'INV-1201',
    clientName: 'Atlas',
    project: 'Mission data',
    amount: 3100,
    currency: 'EUR',
    receivedAt: new Date(now.getFullYear(), now.getMonth(), 9).toISOString(),
    expectedAt: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(),
    method: 'VIREMENT',
    status: 'PAID',
  },
  {
    id: 'pay-003',
    businessId: '1',
    invoiceId: 'INV-1202',
    clientName: 'Helios',
    project: 'Coaching produit',
    amount: 1800,
    currency: 'EUR',
    receivedAt: new Date(now.getFullYear(), now.getMonth(), -1).toISOString(),
    expectedAt: new Date(now.getFullYear(), now.getMonth(), -5).toISOString(),
    method: 'CARTE',
    status: 'LATE',
    note: 'Relance envoyée',
  },
  {
    id: 'pay-004',
    businessId: '1',
    invoiceId: 'INV-1203',
    clientName: 'Helios',
    project: 'Coaching produit',
    amount: 950,
    currency: 'EUR',
    receivedAt: '',
    expectedAt: new Date(now.getFullYear(), now.getMonth(), 21).toISOString(),
    method: 'VIREMENT',
    status: 'PENDING',
    note: 'Échéance fin de mois',
  },
  {
    id: 'pay-005',
    businessId: '1',
    invoiceId: 'INV-1204',
    clientName: 'Lys Studio',
    project: 'Identité',
    amount: 2300,
    currency: 'EUR',
    receivedAt: new Date(now.getFullYear(), now.getMonth() - 1, 27).toISOString(),
    expectedAt: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString(),
    method: 'CHEQUE',
    status: 'PAID',
  },
  {
    id: 'pay-006',
    businessId: '1',
    invoiceId: 'INV-1205',
    clientName: 'Oasis',
    project: 'Prestation mensuelle',
    amount: 1200,
    currency: 'EUR',
    receivedAt: '',
    expectedAt: new Date(now.getFullYear(), now.getMonth(), 12).toISOString(),
    method: 'VIREMENT',
    status: 'LATE',
    note: '2 relances envoyées',
  },
  {
    id: 'pay-007',
    businessId: '1',
    invoiceId: 'INV-1206',
    clientName: 'Magma',
    project: 'Maintenance',
    amount: 800,
    currency: 'EUR',
    receivedAt: new Date(now.getFullYear(), now.getMonth(), 4).toISOString(),
    expectedAt: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(),
    method: 'CARTE',
    status: 'PAID',
  },
  {
    id: 'pay-008',
    businessId: '1',
    invoiceId: 'INV-1207',
    clientName: 'NovaCorp',
    project: 'Retainer',
    amount: 2800,
    currency: 'EUR',
    receivedAt: '',
    expectedAt: new Date(now.getFullYear(), now.getMonth() + 1, 3).toISOString(),
    method: 'VIREMENT',
    status: 'PENDING',
  },
];

const baseTreasury: TreasuryEntry[] = [
  {
    id: 'tre-001',
    date: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(),
    label: 'Paiement NovaCorp',
    type: 'INFLOW',
    amount: 4200,
    currency: 'EUR',
    category: 'Encaissement client',
    source: 'Payments',
  },
  {
    id: 'tre-002',
    date: new Date(now.getFullYear(), now.getMonth(), 6).toISOString(),
    label: 'Salaires',
    type: 'OUTFLOW',
    amount: 3200,
    currency: 'EUR',
    category: 'Charges fixes',
  },
  {
    id: 'tre-003',
    date: new Date(now.getFullYear(), now.getMonth(), 9).toISOString(),
    label: 'Paiement Atlas',
    type: 'INFLOW',
    amount: 3100,
    currency: 'EUR',
    category: 'Encaissement client',
    source: 'Payments',
  },
  {
    id: 'tre-004',
    date: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
    label: 'Loyer bureau',
    type: 'OUTFLOW',
    amount: 1200,
    currency: 'EUR',
    category: 'Charges fixes',
  },
  {
    id: 'tre-005',
    date: new Date(now.getFullYear(), now.getMonth(), 14).toISOString(),
    label: 'Outils SaaS',
    type: 'OUTFLOW',
    amount: 460,
    currency: 'EUR',
    category: 'Logiciels',
  },
  {
    id: 'tre-006',
    date: new Date(now.getFullYear(), now.getMonth(), 18).toISOString(),
    label: 'Dépenses mission',
    type: 'OUTFLOW',
    amount: 380,
    currency: 'EUR',
    category: 'Projet',
    note: 'Déplacements client',
  },
  {
    id: 'tre-007',
    date: new Date(now.getFullYear(), now.getMonth(), 19).toISOString(),
    label: 'Paiement Magma',
    type: 'INFLOW',
    amount: 800,
    currency: 'EUR',
    category: 'Maintenance',
    source: 'Payments',
  },
  {
    id: 'tre-008',
    date: new Date(now.getFullYear(), now.getMonth(), 21).toISOString(),
    label: 'Acompte Oasis',
    type: 'INFLOW',
    amount: 1200,
    currency: 'EUR',
    category: 'Encaissement client',
    source: 'Payments',
    note: 'En attente',
  },
];

const baseVat: VatPeriod[] = [
  {
    id: 'vat-2024-q1',
    period: '2024-Q1',
    collected: 7600,
    deductible: 1800,
    due: 5800,
    status: 'paid',
    dueAt: new Date(now.getFullYear(), 3, 19).toISOString(),
  },
  {
    id: 'vat-2024-q2',
    period: '2024-Q2',
    collected: 9200,
    deductible: 2400,
    due: 6800,
    status: 'filed',
    dueAt: new Date(now.getFullYear(), 6, 19).toISOString(),
  },
  {
    id: 'vat-2024-q3',
    period: '2024-Q3',
    collected: 8400,
    deductible: 2100,
    due: 6300,
    status: 'draft',
    dueAt: new Date(now.getFullYear(), 9, 19).toISOString(),
  },
];

const baseForecast: ForecastRow[] = [
  { id: 'fc-01', month: '2024-07', revenue: 21000, expenses: 12600, net: 8400, runway: 8 },
  { id: 'fc-02', month: '2024-08', revenue: 19500, expenses: 12200, net: 7300, runway: 7 },
  { id: 'fc-03', month: '2024-09', revenue: 18400, expenses: 12000, net: 6400, runway: 6 },
  { id: 'fc-04', month: '2024-10', revenue: 17800, expenses: 11900, net: 5900, runway: 6 },
  { id: 'fc-05', month: '2024-11', revenue: 17200, expenses: 11750, net: 5450, runway: 5 },
  { id: 'fc-06', month: '2024-12', revenue: 16500, expenses: 11600, net: 4900, runway: 5 },
];

const baseDocuments: AdminDocument[] = [
  {
    id: 'doc-001',
    title: 'Kbis',
    category: 'Légal',
    status: 'valid',
    expiresAt: null,
    owner: 'Admin',
    fileUrl: '#',
    updatedAt: new Date(now.getFullYear(), now.getMonth() - 1, 5).toISOString(),
  },
  {
    id: 'doc-002',
    title: 'Assurance RC Pro',
    category: 'Assurance',
    status: 'expiring',
    expiresAt: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString(),
    owner: 'Finance',
    fileUrl: '#',
    updatedAt: new Date(now.getFullYear(), now.getMonth() - 2, 20).toISOString(),
  },
  {
    id: 'doc-003',
    title: 'Contrat cadre NovaCorp',
    category: 'Contrat',
    status: 'valid',
    expiresAt: new Date(now.getFullYear(), now.getMonth() + 5, 1).toISOString(),
    owner: 'Juridique',
    fileUrl: '#',
    updatedAt: new Date(now.getFullYear(), now.getMonth() - 1, 28).toISOString(),
  },
];

const baseDeadlines: Deadline[] = [
  {
    id: 'dl-001',
    title: 'Déclaration TVA T2',
    dueAt: new Date(now.getFullYear(), now.getMonth() + 1, 20).toISOString(),
    recurrence: 'Trimestrielle',
    linkedTo: 'TVA',
    status: 'open',
    owner: 'Finance',
  },
  {
    id: 'dl-002',
    title: 'Renouvellement RC Pro',
    dueAt: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString(),
    recurrence: 'Annuelle',
    linkedTo: 'Assurance',
    status: 'open',
    owner: 'Admin',
  },
  {
    id: 'dl-003',
    title: 'Bilan comptable',
    dueAt: new Date(now.getFullYear(), 11, 31).toISOString(),
    recurrence: 'Annuelle',
    linkedTo: 'Comptabilité',
    status: 'late',
    owner: 'Expert-comptable',
  },
];

const baseCategories: CategoryRef[] = [
  { id: 'cat-001', name: 'Ventes', scope: 'income', parentId: null, color: '#2563eb' },
  { id: 'cat-002', name: 'Services récurrents', scope: 'income', parentId: 'cat-001', color: '#1e3a8a' },
  { id: 'cat-003', name: 'Logiciels', scope: 'expense', parentId: null, color: '#0ea5e9' },
  { id: 'cat-004', name: 'Sous-traitance', scope: 'expense', parentId: null, color: '#f59e0b' },
  { id: 'cat-005', name: 'Production', scope: 'task', parentId: null, color: '#16a34a' },
];

const baseTags: TagRef[] = [
  { id: 'tag-001', name: 'VIP', color: '#e11d48' },
  { id: 'tag-002', name: 'Mensuel', color: '#2563eb' },
  { id: 'tag-003', name: 'Export', color: '#16a34a' },
  { id: 'tag-004', name: 'Priorité', color: '#f97316' },
];

const baseAutomations: AutomationRule[] = [
  {
    id: 'auto-001',
    trigger: 'Projet créé',
    action: 'Créer tâches du SOP',
    status: 'active',
    config: 'Checklist onboarding',
  },
  {
    id: 'auto-002',
    trigger: 'Facture émise',
    action: 'Envoyer mail + relance J+15',
    status: 'active',
    config: 'Relance automatique',
  },
  {
    id: 'auto-003',
    trigger: 'Paiement reçu',
    action: 'Notifier équipe finance',
    status: 'paused',
    config: 'Slack #finances',
  },
];

const baseNumbering: NumberingSetting[] = [
  {
    id: 'num-001',
    docType: 'Factures',
    prefix: 'INV-',
    nextNumber: 1280,
    pad: 4,
    suffix: '',
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'num-002',
    docType: 'Devis',
    prefix: 'QUO-',
    nextNumber: 315,
    pad: 3,
    suffix: '-A',
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'num-003',
    docType: 'Dépenses',
    prefix: 'EXP-',
    nextNumber: 580,
    pad: 4,
    suffix: '',
    updatedAt: now.toISOString(),
    updatedBy: 'system',
  },
];

export function getMockPayments() {
  return basePayments.map((p) => ({ ...p }));
}

export function getMockTreasury() {
  return baseTreasury.map((t) => ({ ...t }));
}

export function getMockVatPeriods() {
  return baseVat.map((v) => ({ ...v }));
}

export function getMockForecast() {
  return baseForecast.map((f) => ({ ...f }));
}

export function getMockDocuments() {
  return baseDocuments.map((d) => ({ ...d }));
}

export function getMockDeadlines() {
  return baseDeadlines.map((d) => ({ ...d }));
}

export function getMockCategories() {
  return baseCategories.map((c) => ({ ...c }));
}

export function getMockTags() {
  return baseTags.map((t) => ({ ...t }));
}

export function getMockAutomations() {
  return baseAutomations.map((a) => ({ ...a }));
}

export function getMockNumbering() {
  return baseNumbering.map((n) => ({ ...n }));
}

export function formatCurrency(amount: number, currency = 'EUR') {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  return {
    pageItems: items.slice(start, end),
    totalPages,
  };
}
