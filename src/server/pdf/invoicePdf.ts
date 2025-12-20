import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type Moneyish = bigint | number | string;

function toNumber(value: Moneyish) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number(value);
}

function formatAmount(value: Moneyish, currency: string) {
  const num = toNumber(value) / 100;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
}

type InvoicePdfItem = {
  label: string;
  quantity: number;
  unitPriceCents: Moneyish;
  totalCents: Moneyish;
};

export type InvoicePdfPayload = {
  invoiceId: string;
  businessName: string;
  projectName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  totalCents: Moneyish;
  depositCents: Moneyish;
  balanceCents: Moneyish;
  currency: string;
  requestId?: string | null;
  items: InvoicePdfItem[];
};

export async function buildInvoicePdf(payload: InvoicePdfPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  let y = 790;

  const addText = (text: string, size: number, x: number, color = rgb(0, 0, 0), fontRef = font) => {
    page.drawText(text, { x, y, size, font: fontRef, color });
  };

  addText(payload.businessName, 18, margin, rgb(0.05, 0.05, 0.05), bold);
  y -= 18;
  addText('Facture', 14, margin, rgb(0.1, 0.1, 0.1), bold);
  y -= 16;
  addText(`Facture #${payload.invoiceId}`, 11, margin, rgb(0.2, 0.2, 0.2));
  y -= 14;
  if (payload.requestId) {
    addText(`Req: ${payload.requestId}`, 9, margin, rgb(0.35, 0.35, 0.35));
    y -= 12;
  }

  const clientLine = [payload.clientName, payload.clientEmail].filter(Boolean).join(' · ');
  if (clientLine) {
    addText(`Client: ${clientLine}`, 11, margin, rgb(0.15, 0.15, 0.15));
    y -= 14;
  }
  if (payload.projectName) {
    addText(`Projet: ${payload.projectName}`, 11, margin, rgb(0.15, 0.15, 0.15));
    y -= 14;
  }

  const dates = [
    payload.issuedAt ? `Émise: ${new Date(payload.issuedAt).toLocaleDateString('fr-FR')}` : null,
    payload.dueAt ? `Échéance: ${new Date(payload.dueAt).toLocaleDateString('fr-FR')}` : null,
    payload.paidAt ? `Payée: ${new Date(payload.paidAt).toLocaleDateString('fr-FR')}` : null,
  ]
    .filter(Boolean)
    .join(' • ');
  if (dates) {
    addText(dates, 10, margin, rgb(0.3, 0.3, 0.3));
    y -= 14;
  }

  y -= 6;
  addText('Lignes de facture', 12, margin, rgb(0.12, 0.12, 0.12), bold);
  y -= 14;

  addText('Libellé', 10, margin, rgb(0.15, 0.15, 0.15), bold);
  addText('Qté', 10, 320, rgb(0.15, 0.15, 0.15), bold);
  addText('PU', 10, 360, rgb(0.15, 0.15, 0.15), bold);
  addText('Total', 10, 450, rgb(0.15, 0.15, 0.15), bold);
  y -= 12;

  payload.items.forEach((item) => {
    addText(item.label, 10, margin, rgb(0.08, 0.08, 0.08));
    addText(String(item.quantity), 10, 320, rgb(0.08, 0.08, 0.08));
    addText(formatAmount(item.unitPriceCents, payload.currency), 10, 360, rgb(0.08, 0.08, 0.08));
    addText(formatAmount(item.totalCents, payload.currency), 10, 450, rgb(0.08, 0.08, 0.08));
    y -= 14;
  });

  y -= 10;
  const totalsX = 360;
  addText('Total', 11, totalsX, rgb(0.05, 0.05, 0.05), bold);
  addText(formatAmount(payload.totalCents, payload.currency), 11, 450, rgb(0.05, 0.05, 0.05), bold);
  y -= 14;
  addText('Acompte', 10, totalsX, rgb(0.1, 0.1, 0.1));
  addText(formatAmount(payload.depositCents, payload.currency), 10, 450, rgb(0.1, 0.1, 0.1));
  y -= 12;
  addText('Solde', 10, totalsX, rgb(0.1, 0.1, 0.1));
  addText(formatAmount(payload.balanceCents, payload.currency), 10, 450, rgb(0.1, 0.1, 0.1));
  y -= 16;

  addText('Merci pour votre paiement.', 10, margin, rgb(0.12, 0.12, 0.12));
  if (!payload.paidAt) {
    y -= 12;
    addText('Règlement attendu à échéance.', 10, margin, rgb(0.12, 0.12, 0.12));
  }

  return pdfDoc.save();
}
