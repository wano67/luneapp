export type TaskPhase = 'CADRAGE' | 'UX' | 'DESIGN' | 'DEV' | 'SEO' | 'LAUNCH' | 'FOLLOW_UP' | null;

export type ServiceItem = {
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
  costCents: string | null;
  unit: string;
  defaultQuantity: number;
  durationHours: number | null;
  vatRate: number | null;
  createdAt: string;
  updatedAt: string;
  templateCount?: number;
};

export type ServiceTemplate = {
  id: string;
  serviceId: string;
  phase: TaskPhase;
  title: string;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
  createdAt: string;
};

export const SERVICE_UNIT_LABELS: Record<string, string> = {
  FORFAIT: 'Forfait',
  HOUR: 'Heure',
  DAY: 'Jour',
  PIECE: 'Pièce',
  OTHER: 'Autre',
};

export const SERVICE_UNITS = ['FORFAIT', 'HOUR', 'DAY', 'PIECE', 'OTHER'] as const;
