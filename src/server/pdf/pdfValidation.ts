export const PDF_FIELD_LIMITS = {
  companyName: 80,
  addressLine: 120,
  clientName: 120,
  itemTitle: 120,
  itemDescription: 800,
  paymentTerms: 2000,
  legalMentions: 6000,
  cgv: 20000,
  maxConditionPagesWarning: 10,
} as const;

export type PdfValidationWarning = {
  field: string;
  message: string;
};

export function trimToMax(value: string | null | undefined, maxChars: number) {
  if (value == null) return { value: null as string | null, truncated: false };
  const trimmed = value.trim();
  if (!trimmed) return { value: null as string | null, truncated: false };
  if (trimmed.length <= maxChars) return { value: trimmed, truncated: false };
  return { value: `${trimmed.slice(0, maxChars - 1).trim()}…`, truncated: true };
}

export function trimSingleLine(value: string | null | undefined, maxChars: number) {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return { value: null as string | null, truncated: false };
  if (normalized.length <= maxChars) return { value: normalized, truncated: false };
  return { value: `${normalized.slice(0, maxChars - 1).trim()}…`, truncated: true };
}
