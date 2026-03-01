import {
  buildBusinessDocumentPdf,
  type BuildBusinessDocumentPayload,
  type ClientDetails,
  type Moneyish,
  type PartyDetails,
  type PdfLineItem,
} from '@/server/pdf/businessDocumentPdf';

export type InvoicePdfItem = PdfLineItem;

export type InvoicePdfPayload = {
  invoiceId: string;
  number?: string | null;
  businessName: string;
  business?: PartyDetails | null;
  client?: ClientDetails | null;
  projectName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  prestationsText?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  totalCents: Moneyish;
  depositCents: Moneyish;
  balanceCents: Moneyish;
  depositPercent?: number | null;
  currency: string;
  vatEnabled?: boolean | null;
  vatRatePercent?: number | null;
  paymentTermsDays?: number | null;
  note?: string | null;
  projectTotalCents?: Moneyish | null;
  alreadyInvoicedCents?: Moneyish | null;
  alreadyPaidCents?: Moneyish | null;
  remainingCents?: Moneyish | null;
  requestId?: string | null;
  items: InvoicePdfItem[];
};

function toDocumentPayload(payload: InvoicePdfPayload): BuildBusinessDocumentPayload {
  return {
    kind: 'INVOICE',
    documentId: payload.invoiceId,
    number: payload.number,
    businessName: payload.businessName,
    business: payload.business ?? null,
    client: payload.client ?? null,
    projectName: payload.projectName ?? null,
    clientName: payload.clientName ?? null,
    clientEmail: payload.clientEmail ?? null,
    issuedAt: payload.issuedAt ?? null,
    secondaryDate: payload.dueAt ?? null,
    secondaryDateLabel: "Date d'échéance",
    extraDateLines: payload.paidAt ? [{ label: 'Date de paiement', value: payload.paidAt }] : undefined,
    totalCents: payload.totalCents,
    depositCents: payload.depositCents,
    balanceCents: payload.balanceCents,
    currency: payload.currency,
    vatEnabled: payload.vatEnabled ?? null,
    vatRatePercent: payload.vatRatePercent ?? null,
    paymentTermsDays: payload.paymentTermsDays ?? null,
    note: payload.note ?? null,
    items: payload.items,
    includeSignature: false,
    balanceLabel: 'Reste à régler',
  };
}

export async function buildInvoicePdf(payload: InvoicePdfPayload): Promise<Uint8Array> {
  return buildBusinessDocumentPdf(toDocumentPayload(payload));
}
