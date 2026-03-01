import {
  buildBusinessDocumentPdf,
  type BuildBusinessDocumentPayload,
  type ClientDetails,
  type Moneyish,
  type PartyDetails,
  type PdfLineItem,
} from '@/server/pdf/businessDocumentPdf';

export type QuotePdfItem = PdfLineItem;

export type QuotePdfPayload = {
  quoteId: string;
  number?: string | null;
  businessName: string;
  business?: PartyDetails | null;
  client?: ClientDetails | null;
  projectName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  prestationsText?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  depositPercent?: number | null;
  totalCents: Moneyish;
  depositCents: Moneyish;
  balanceCents: Moneyish;
  currency: string;
  vatEnabled?: boolean | null;
  vatRatePercent?: number | null;
  paymentTermsDays?: number | null;
  note?: string | null;
  requestId?: string | null;
  items: QuotePdfItem[];
};

function toDocumentPayload(payload: QuotePdfPayload): BuildBusinessDocumentPayload {
  return {
    kind: 'QUOTE',
    documentId: payload.quoteId,
    number: payload.number,
    businessName: payload.businessName,
    business: payload.business ?? null,
    client: payload.client ?? null,
    projectName: payload.projectName ?? null,
    clientName: payload.clientName ?? null,
    clientEmail: payload.clientEmail ?? null,
    issuedAt: payload.issuedAt ?? null,
    secondaryDate: payload.expiresAt ?? null,
    secondaryDateLabel: "Valable jusqu'au",
    totalCents: payload.totalCents,
    depositCents: payload.depositCents,
    balanceCents: payload.balanceCents,
    currency: payload.currency,
    vatEnabled: payload.vatEnabled ?? null,
    vatRatePercent: payload.vatRatePercent ?? null,
    paymentTermsDays: payload.paymentTermsDays ?? null,
    note: payload.note ?? null,
    items: payload.items,
    includeSignature: true,
    balanceLabel: 'Solde',
  };
}

export async function buildQuotePdf(payload: QuotePdfPayload): Promise<Uint8Array> {
  return buildBusinessDocumentPdf(toDocumentPayload(payload));
}
