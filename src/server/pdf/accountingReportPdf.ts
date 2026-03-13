import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FlowLayout, sanitizePdfText } from './layoutFlow';

type BalanceRow = {
  accountCode: string;
  accountName: string;
  totalDebitCents: number;
  totalCreditCents: number;
  soldeDebiteurCents: number;
  soldeCrediteurCents: number;
};

type BalancePayload = {
  businessName: string;
  from: string;
  to: string;
  rows: BalanceRow[];
  totalDebitCents: number;
  totalCreditCents: number;
};

type GrandLivreLine = {
  date: string;
  journalCode: string | null;
  pieceRef: string | null;
  memo: string | null;
  debitCents: number;
  creditCents: number;
};

type GrandLivreAccount = {
  accountCode: string;
  accountName: string;
  totalDebitCents: number;
  totalCreditCents: number;
  lines: GrandLivreLine[];
};

type GrandLivrePayload = {
  businessName: string;
  from: string;
  to: string;
  accounts: GrandLivreAccount[];
};

function fmt(cents: number): string {
  if (cents === 0) return '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const centsPart = abs % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}${euros.toLocaleString('fr-FR')},${String(centsPart).padStart(2, '0')} EUR`;
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(iso));
  } catch {
    return iso;
  }
}

const PAGE_W = 842; // A4 landscape
const PAGE_H = 595;
const M_TOP = 50;
const M_BOTTOM = 40;
const M_LEFT = 40;
const M_RIGHT = 40;
const ROW_H = 16;

export async function buildBalancePdf(payload: BalancePayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const grey = rgb(0.4, 0.4, 0.4);

  const layout = new FlowLayout({
    pdfDoc,
    pageWidth: PAGE_W,
    pageHeight: PAGE_H,
    marginTop: M_TOP,
    marginBottom: M_BOTTOM,
    marginLeft: M_LEFT,
    marginRight: M_RIGHT,
  });

  // Header
  const page = layout.getPage();
  page.drawText(sanitizePdfText(payload.businessName), { x: M_LEFT, y: layout.getCursorY(), size: 14, font: fontBold, color: black });
  layout.setCursorY(layout.getCursorY() - 20);
  page.drawText(`Balance Generale - du ${fmtDate(payload.from)} au ${fmtDate(payload.to)}`, { x: M_LEFT, y: layout.getCursorY(), size: 10, font: fontRegular, color: grey });
  layout.setCursorY(layout.getCursorY() - 24);

  // Column headers
  const cols = [M_LEFT, M_LEFT + 70, M_LEFT + 280, M_LEFT + 400, M_LEFT + 520, M_LEFT + 640];
  const headers = ['Code', 'Compte', 'Debit', 'Credit', 'Solde Deb.', 'Solde Cred.'];
  headers.forEach((h, i) => {
    layout.getPage().drawText(h, { x: cols[i], y: layout.getCursorY(), size: 8, font: fontBold, color: grey });
  });
  layout.setCursorY(layout.getCursorY() - ROW_H);

  // Rows
  for (const row of payload.rows) {
    if (layout.getAvailableHeight() < ROW_H * 2) {
      layout.setCursorY(layout.getAvailableHeight()); // force page break
      const newPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      layout.setCursorY(PAGE_H - M_TOP);
      // Re-draw headers on new page
      headers.forEach((h, i) => {
        newPage.drawText(h, { x: cols[i], y: layout.getCursorY(), size: 8, font: fontBold, color: grey });
      });
      layout.setCursorY(layout.getCursorY() - ROW_H);
    }
    const p = layout.getPage();
    const y = layout.getCursorY();
    p.drawText(sanitizePdfText(row.accountCode), { x: cols[0], y, size: 8, font: fontRegular, color: black });
    p.drawText(sanitizePdfText(row.accountName.slice(0, 35)), { x: cols[1], y, size: 8, font: fontRegular, color: black });
    p.drawText(fmt(row.totalDebitCents), { x: cols[2], y, size: 8, font: fontRegular, color: black });
    p.drawText(fmt(row.totalCreditCents), { x: cols[3], y, size: 8, font: fontRegular, color: black });
    p.drawText(fmt(row.soldeDebiteurCents), { x: cols[4], y, size: 8, font: fontRegular, color: black });
    p.drawText(fmt(row.soldeCrediteurCents), { x: cols[5], y, size: 8, font: fontRegular, color: black });
    layout.setCursorY(y - ROW_H);
  }

  // Totals
  const y = layout.getCursorY() - 4;
  const p = layout.getPage();
  p.drawLine({ start: { x: M_LEFT, y: y + 10 }, end: { x: PAGE_W - M_RIGHT, y: y + 10 }, thickness: 1, color: black });
  p.drawText('TOTAL', { x: cols[0], y, size: 9, font: fontBold, color: black });
  p.drawText(fmt(payload.totalDebitCents), { x: cols[2], y, size: 9, font: fontBold, color: black });
  p.drawText(fmt(payload.totalCreditCents), { x: cols[3], y, size: 9, font: fontBold, color: black });

  return pdfDoc.save();
}

export async function buildGrandLivrePdf(payload: GrandLivrePayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const grey = rgb(0.4, 0.4, 0.4);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M_TOP;

  // Header
  page.drawText(sanitizePdfText(payload.businessName), { x: M_LEFT, y, size: 14, font: fontBold, color: black });
  y -= 20;
  page.drawText(`Grand Livre - du ${fmtDate(payload.from)} au ${fmtDate(payload.to)}`, { x: M_LEFT, y, size: 10, font: fontRegular, color: grey });
  y -= 24;

  const cols = [M_LEFT, M_LEFT + 80, M_LEFT + 160, M_LEFT + 230, M_LEFT + 500, M_LEFT + 630];

  for (const acc of payload.accounts) {
    // Account header
    if (y < M_BOTTOM + ROW_H * 4) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M_TOP;
    }

    page.drawText(sanitizePdfText(`${acc.accountCode} - ${acc.accountName}`), { x: M_LEFT, y, size: 10, font: fontBold, color: black });
    y -= ROW_H;

    // Column headers
    const lineHeaders = ['Date', 'Journal', 'Ref.', 'Libelle', 'Debit', 'Credit'];
    lineHeaders.forEach((h, i) => {
      page.drawText(h, { x: cols[i], y, size: 7, font: fontBold, color: grey });
    });
    y -= ROW_H;

    for (const line of acc.lines) {
      if (y < M_BOTTOM + ROW_H) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - M_TOP;
      }
      page.drawText(fmtDate(line.date), { x: cols[0], y, size: 7, font: fontRegular, color: black });
      page.drawText(sanitizePdfText(line.journalCode ?? ''), { x: cols[1], y, size: 7, font: fontRegular, color: black });
      page.drawText(sanitizePdfText((line.pieceRef ?? '').slice(0, 12)), { x: cols[2], y, size: 7, font: fontRegular, color: black });
      page.drawText(sanitizePdfText((line.memo ?? '').slice(0, 45)), { x: cols[3], y, size: 7, font: fontRegular, color: black });
      if (line.debitCents > 0) page.drawText(fmt(line.debitCents), { x: cols[4], y, size: 7, font: fontRegular, color: black });
      if (line.creditCents > 0) page.drawText(fmt(line.creditCents), { x: cols[5], y, size: 7, font: fontRegular, color: black });
      y -= ROW_H;
    }

    // Subtotal
    if (y < M_BOTTOM + ROW_H) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M_TOP;
    }
    page.drawLine({ start: { x: M_LEFT, y: y + 10 }, end: { x: PAGE_W - M_RIGHT, y: y + 10 }, thickness: 0.5, color: grey });
    page.drawText('Sous-total', { x: cols[3], y, size: 7, font: fontBold, color: black });
    page.drawText(fmt(acc.totalDebitCents), { x: cols[4], y, size: 7, font: fontBold, color: black });
    page.drawText(fmt(acc.totalCreditCents), { x: cols[5], y, size: 7, font: fontBold, color: black });
    y -= ROW_H * 1.5;
  }

  return pdfDoc.save();
}
