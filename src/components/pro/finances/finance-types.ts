export type FinanceType = 'INCOME' | 'EXPENSE';
export type PaymentMethod = 'WIRE' | 'CARD' | 'CHECK' | 'CASH' | 'OTHER';
export type RecurringUnit = 'MONTHLY' | 'YEARLY';

export type Finance = {
  id: string;
  businessId: string;
  projectId: string | null;
  projectName: string | null;
  categoryReferenceId: string | null;
  categoryReferenceName: string | null;
  tagReferences: { id: string; name: string }[];
  type: FinanceType;
  amountCents: string;
  amount: number;
  category: string;
  vendor: string | null;
  method: PaymentMethod | null;
  isRecurring: boolean;
  recurringUnit: RecurringUnit | null;
  recurringRuleId: string | null;
  isRuleOverride: boolean;
  lockedFromRule: boolean;
  date: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export const TYPE_OPTIONS: { value: FinanceType; label: string }[] = [
  { value: 'INCOME', label: 'Revenu' },
  { value: 'EXPENSE', label: 'Dépense' },
];

export const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'WIRE', label: 'Virement' },
  { value: 'CARD', label: 'Carte' },
  { value: 'CHECK', label: 'Chèque' },
  { value: 'CASH', label: 'Espèces' },
  { value: 'OTHER', label: 'Autre' },
];

export const RECURRING_OPTIONS: { value: RecurringUnit; label: string }[] = [
  { value: 'MONTHLY', label: 'Mensuel' },
  { value: 'YEARLY', label: 'Annuel' },
];

export function formatFinanceDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}
