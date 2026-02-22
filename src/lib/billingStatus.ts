type StatusLabelMap = Record<string, string>;

const QUOTE_STATUS_LABELS: StatusLabelMap = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  SIGNED: 'Signé',
  CANCELLED: 'Annulé',
  EXPIRED: 'Expiré',
};

const INVOICE_STATUS_LABELS: StatusLabelMap = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

const PROJECT_QUOTE_STATUS_LABELS: StatusLabelMap = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACCEPTED: 'Accepté',
  SIGNED: 'Signé',
};

const PROJECT_DEPOSIT_STATUS_LABELS: StatusLabelMap = {
  NOT_REQUIRED: 'Non requis',
  PENDING: 'En attente',
  PAID: 'Payé',
};

function toKey(value?: string | null): string | null {
  if (!value) return null;
  return value.toUpperCase();
}

export function getQuoteStatusLabelFR(status?: string | null): string {
  const key = toKey(status);
  if (!key) return '—';
  return QUOTE_STATUS_LABELS[key] ?? status ?? '—';
}

export function getInvoiceStatusLabelFR(status?: string | null): string {
  const key = toKey(status);
  if (!key) return '—';
  return INVOICE_STATUS_LABELS[key] ?? status ?? '—';
}

export function getProjectQuoteStatusLabelFR(status?: string | null): string {
  const key = toKey(status);
  if (!key) return '—';
  return PROJECT_QUOTE_STATUS_LABELS[key] ?? status ?? '—';
}

export function getProjectDepositStatusLabelFR(status?: string | null): string {
  const key = toKey(status);
  if (!key) return '—';
  return PROJECT_DEPOSIT_STATUS_LABELS[key] ?? status ?? '—';
}
