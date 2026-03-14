import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { FlowLayout, measureParagraph, sanitizePdfText, type LayoutTextStyle } from '@/server/pdf/layoutFlow';
import { parseMarkdownSubset, splitParagraphs, type TextParagraph, type TextSection } from '@/server/pdf/textStructure';
import { PDF_FIELD_LIMITS, trimSingleLine, trimToMax, type PdfValidationWarning } from '@/server/pdf/pdfValidation';

/* ------------------------------------------------------------------ */
/*  Exported types (unchanged public API)                              */
/* ------------------------------------------------------------------ */

export type Moneyish = bigint | number | string;

export type PartyDetails = {
  legalName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  websiteUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
  billingLegalText?: string | null;
  cgvText?: string | null;
  paymentTermsText?: string | null;
  lateFeesText?: string | null;
  fixedIndemnityText?: string | null;
  legalMentionsText?: string | null;
  legalText?: string | null;
};

export type ClientDetails = {
  name?: string | null;
  companyName?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  reference?: string | null;
};

export type PdfLineItem = {
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: Moneyish;
  originalUnitPriceCents?: Moneyish | null;
  unitLabel?: string | null;
  billingUnit?: string | null;
  totalCents: Moneyish;
};

export type BuildBusinessDocumentPayload = {
  kind: 'QUOTE' | 'INVOICE';
  documentId: string;
  number?: string | null;
  businessName: string;
  business?: PartyDetails | null;
  client?: ClientDetails | null;
  projectName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  issuedAt?: string | null;
  secondaryDate?: string | null;
  secondaryDateLabel: string;
  extraDateLines?: Array<{ label: string; value?: string | null }>;
  totalCents: Moneyish;
  depositCents: Moneyish;
  balanceCents: Moneyish;
  currency: string;
  vatEnabled?: boolean | null;
  vatRatePercent?: number | null;
  paymentTermsDays?: number | null;
  note?: string | null;
  items: PdfLineItem[];
  includeSignature: boolean;
  balanceLabel: string;
};

/* ------------------------------------------------------------------ */
/*  Page constants                                                     */
/* ------------------------------------------------------------------ */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 50;
const FOOTER_Y = 20;
const FOOTER_DIVIDER_Y = 34;

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

type TotalsRow = {
  label: string;
  value: string;
  style: 'body' | 'section';
  emphasize?: boolean;
};

type NormalizedLineItem = PdfLineItem & {
  label: string;
  description: string | null;
  fullDescription: string | null;
};

type DocStyles = {
  title: LayoutTextStyle;
  number: LayoutTextStyle;
  section: LayoutTextStyle;
  body: LayoutTextStyle;
  bodyBold: LayoutTextStyle;
  muted: LayoutTextStyle;
  mutedBold: LayoutTextStyle;
  small: LayoutTextStyle;
};

/* ------------------------------------------------------------------ */
/*  Colors — dark navy palette                                         */
/* ------------------------------------------------------------------ */

const PRIMARY_R = 9 / 255;
const PRIMARY_G = 2 / 255;
const PRIMARY_B = 34 / 255;

const COLORS = {
  primary: rgb(PRIMARY_R, PRIMARY_G, PRIMARY_B),
  muted: rgb(PRIMARY_R, PRIMARY_G, PRIMARY_B), // rendered at 50% via opacity simulation
  line: rgb(
    1 - (1 - PRIMARY_R) * 0.1,
    1 - (1 - PRIMARY_G) * 0.1,
    1 - (1 - PRIMARY_B) * 0.1
  ), // same color at 10% opacity on white
};

/**
 * pdf-lib does not support alpha/opacity. We simulate 50% opacity on white
 * by blending: result = white*(1-a) + color*a  with a=0.5.
 */
const MUTED_COLOR = rgb(
  1 - (1 - PRIMARY_R) * 0.5,
  1 - (1 - PRIMARY_G) * 0.5,
  1 - (1 - PRIMARY_B) * 0.5
);

/* ------------------------------------------------------------------ */
/*  Shared helpers (unchanged public contract)                         */
/* ------------------------------------------------------------------ */

function toNumber(value: Moneyish) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number(value);
}

function toBigInt(value: Moneyish) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') return BigInt(value);
  return BigInt(Math.trunc(value));
}

function formatAmount(value: Moneyish, currency: string) {
  const num = toNumber(value) / 100;
  try {
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(num);
    return sanitizePdfText(formatted);
  } catch {
    return sanitizePdfText(`${num.toFixed(2)} ${currency}`);
  }
}

function formatDate(value?: string | null) {
  if (!value) return '\u2014';
  try {
    return sanitizePdfText(new Intl.DateTimeFormat('fr-FR').format(new Date(value)));
  } catch {
    return sanitizePdfText(value);
  }
}

function resolveUnitLabel(item: Pick<PdfLineItem, 'unitLabel' | 'billingUnit'>) {
  if (item.unitLabel && item.unitLabel.trim()) return item.unitLabel.trim();
  if (item.billingUnit === 'MONTHLY') return '/mois';
  return null;
}

function buildAddressLines(party: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  address?: string | null;
}) {
  const lines: string[] = [];
  if (party.addressLine1) lines.push(party.addressLine1);
  if (party.addressLine2) lines.push(party.addressLine2);
  const cityLine = [party.postalCode, party.city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (party.countryCode) lines.push(party.countryCode);
  if (!lines.length && party.address) lines.push(party.address);
  return lines;
}

function addWarning(
  warnings: PdfValidationWarning[],
  field: string,
  original: string | null | undefined,
  truncated: boolean,
  maxChars: number
) {
  if (!truncated || !original) return;
  warnings.push({
    field,
    message: `${field} tronqu\u00e9 \u00e0 ${maxChars} caract\u00e8res.`,
  });
}

function limitSingleLine(
  value: string | null | undefined,
  field: string,
  maxChars: number,
  warnings: PdfValidationWarning[]
) {
  const result = trimSingleLine(value, maxChars);
  addWarning(warnings, field, value, result.truncated, maxChars);
  return result.value;
}

function limitMultiline(
  value: string | null | undefined,
  field: string,
  maxChars: number,
  warnings: PdfValidationWarning[]
) {
  const result = trimToMax(value, maxChars);
  addWarning(warnings, field, value, result.truncated, maxChars);
  return result.value;
}

function toStructuredSection(title: string, text: string): TextSection {
  const markdownBlocks = parseMarkdownSubset(text);
  const blocks = markdownBlocks.length ? markdownBlocks : splitParagraphs(text).map((value) => ({ kind: 'p' as const, text: value }));
  return { title, paragraphs: blocks };
}

function buildLegalSections(
  payload: BuildBusinessDocumentPayload,
  business: PartyDetails | null,
  truncatedItems: Array<{ index: number; label: string; fullDescription: string }>,
  warnings: PdfValidationWarning[]
) {
  const sections: TextSection[] = [];

  if (business?.cgvText) {
    const cgv = limitMultiline(business.cgvText, 'cgv', PDF_FIELD_LIMITS.cgv, warnings);
    if (cgv) sections.push(toStructuredSection('Conditions g\u00e9n\u00e9rales de vente', cgv));
  }

  if (business?.paymentTermsText || payload.paymentTermsDays != null) {
    const raw = business?.paymentTermsText ?? `Paiement sous ${payload.paymentTermsDays} jours.`;
    const paymentTerms = limitMultiline(raw, 'paymentTerms', PDF_FIELD_LIMITS.paymentTerms, warnings);
    if (paymentTerms) sections.push(toStructuredSection('Conditions de paiement', paymentTerms));
  }

  if (business?.lateFeesText) {
    const late = limitMultiline(business.lateFeesText, 'lateFeesText', PDF_FIELD_LIMITS.legalMentions, warnings);
    if (late) sections.push(toStructuredSection('P\u00e9nalit\u00e9s de retard', late));
  }

  if (business?.fixedIndemnityText) {
    const indemnity = limitMultiline(
      business.fixedIndemnityText,
      'fixedIndemnityText',
      PDF_FIELD_LIMITS.legalMentions,
      warnings
    );
    if (indemnity) sections.push(toStructuredSection('Indemnit\u00e9 forfaitaire', indemnity));
  }

  if (business?.legalMentionsText) {
    const mentions = limitMultiline(
      business.legalMentionsText,
      'legalMentions',
      PDF_FIELD_LIMITS.legalMentions,
      warnings
    );
    if (mentions) sections.push(toStructuredSection('Mentions l\u00e9gales', mentions));
  }

  if (business?.billingLegalText) {
    const extra = limitMultiline(
      business.billingLegalText,
      'billingLegalText',
      PDF_FIELD_LIMITS.legalMentions,
      warnings
    );
    if (extra) sections.push(toStructuredSection('Mentions compl\u00e9mentaires', extra));
  }

  if (!sections.length && business?.legalText) {
    const fallback = limitMultiline(business.legalText, 'legalText', PDF_FIELD_LIMITS.legalMentions, warnings);
    if (fallback) sections.push(toStructuredSection('Mentions l\u00e9gales', fallback));
  }

  const note = limitMultiline(payload.note, 'note', PDF_FIELD_LIMITS.legalMentions, warnings);
  if (note) {
    sections.push(toStructuredSection('Conditions particuli\u00e8res', note));
  }

  if (truncatedItems.length) {
    const details = truncatedItems
      .map((item) => `- Ligne ${item.index}: ${item.label}\n${item.fullDescription}`)
      .join('\n\n');
    sections.push(
      toStructuredSection(
        'Annexe \u2014 D\u00e9tail lignes',
        `Certaines descriptions ont \u00e9t\u00e9 tronqu\u00e9es dans le tableau principal (limite ${PDF_FIELD_LIMITS.itemDescription} caract\u00e8res).\n\n${details}`
      )
    );
  }

  return sections;
}

/* ------------------------------------------------------------------ */
/*  Condition pages estimation                                         */
/* ------------------------------------------------------------------ */

function estimateConditionPages(
  sections: TextSection[],
  styles: DocStyles,
  contentWidth: number,
  contentHeight: number,
  conditionsHeaderHeight: number
) {
  const sectionTitleHeight = styles.section.lineHeight + 6;
  const hrHeight = 8;
  const paragraphGap = 6;
  let totalHeight = 0;

  sections.forEach((section) => {
    totalHeight += sectionTitleHeight;
    section.paragraphs.forEach((paragraph) => {
      if (paragraph.kind === 'hr') {
        totalHeight += hrHeight;
        return;
      }
      const style = paragraph.kind === 'small' ? styles.small : paragraph.kind === 'h3' ? styles.section : styles.body;
      const text = paragraph.kind === 'li' ? `\u2022 ${paragraph.text}` : paragraph.text;
      const chunks = paragraph.kind === 'p' || paragraph.kind === 'small' ? splitParagraphs(text) : [text];
      chunks.forEach((chunk) => {
        const measured = measureParagraph(chunk, style, contentWidth - (paragraph.kind === 'li' ? 14 : 0));
        totalHeight += measured.height + paragraphGap;
      });
    });
    totalHeight += 6;
  });

  return Math.ceil((totalHeight + conditionsHeaderHeight) / contentHeight);
}

/* ------------------------------------------------------------------ */
/*  Drawing helpers                                                    */
/* ------------------------------------------------------------------ */

function drawRightAt(page: PDFPage, text: string, rightX: number, y: number, style: LayoutTextStyle) {
  const safe = sanitizePdfText(text);
  const width = style.font.widthOfTextAtSize(safe, style.size);
  page.drawText(safe, {
    x: rightX - width,
    y,
    size: style.size,
    font: style.font,
    color: style.color,
  });
}

function drawWrappedAt(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  style: LayoutTextStyle
) {
  const measured = measureParagraph(text, style, width);
  let cursor = y;
  measured.lines.forEach((line) => {
    page.drawText(sanitizePdfText(line), {
      x,
      y: cursor,
      size: style.size,
      font: style.font,
      color: style.color,
    });
    cursor -= style.lineHeight;
  });
  return cursor;
}

function renderTextParagraph(
  layout: FlowLayout,
  paragraph: TextParagraph,
  styles: DocStyles,
  contentWidth: number
) {
  if (paragraph.kind === 'hr') {
    layout.ensureHeight(10, true);
    layout.drawHorizontalRule(0.8, COLORS.line, 8);
    return;
  }

  if (!paragraph.text.trim()) return;

  if (paragraph.kind === 'h3') {
    const measured = measureParagraph(paragraph.text, styles.section, contentWidth);
    layout.drawMeasuredParagraph(measured, {
      x: MARGIN_LEFT,
      style: styles.section,
      keepTogether: true,
      spacingAfter: 4,
    });
    return;
  }

  if (paragraph.kind === 'small') {
    splitParagraphs(paragraph.text).forEach((chunk) => {
      const measured = measureParagraph(chunk, styles.small, contentWidth);
      layout.drawMeasuredParagraph(measured, {
        x: MARGIN_LEFT,
        style: styles.small,
        keepTogether: measured.lines.length <= 3,
        spacingAfter: 4,
      });
    });
    return;
  }

  if (paragraph.kind === 'li' || paragraph.kind === 'ul' || paragraph.kind === 'ol') {
    splitParagraphs(paragraph.text).forEach((chunk, chunkIndex) => {
      const bullet = chunkIndex === 0 ? '\u2022 ' : '  ';
      const measured = measureParagraph(`${bullet}${chunk}`, styles.body, contentWidth - 4);
      layout.drawMeasuredParagraph(measured, {
        x: MARGIN_LEFT + 4,
        style: styles.body,
        keepTogether: measured.lines.length <= 3,
        spacingAfter: 4,
      });
    });
    return;
  }

  splitParagraphs(paragraph.text).forEach((chunk) => {
    const measured = measureParagraph(chunk, styles.body, contentWidth);
    layout.drawMeasuredParagraph(measured, {
      x: MARGIN_LEFT,
      style: styles.body,
      keepTogether: measured.lines.length <= 3,
      spacingAfter: 6,
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Main builder                                                       */
/* ------------------------------------------------------------------ */

export async function buildBusinessDocumentPdf(payload: BuildBusinessDocumentPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  /* --- Standard fonts (variable TTF fonts have ligature encoding issues in pdf-lib) --- */
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  /* --- Styles with new colour palette --- */
  const styles: DocStyles = {
    title: { font: bold, size: 24, lineHeight: 30, color: COLORS.primary },
    number: { font: bold, size: 15, lineHeight: 19, color: COLORS.primary },
    section: { font: bold, size: 11, lineHeight: 15, color: COLORS.primary },
    body: { font, size: 10, lineHeight: 14, color: COLORS.primary },
    bodyBold: { font: bold, size: 10, lineHeight: 14, color: COLORS.primary },
    muted: { font, size: 9, lineHeight: 12, color: MUTED_COLOR },
    mutedBold: { font: bold, size: 9, lineHeight: 12, color: MUTED_COLOR },
    small: { font, size: 9, lineHeight: 12, color: MUTED_COLOR },
  };

  const warnings: PdfValidationWarning[] = [];

  /* ---------------------------------------------------------------- */
  /*  Sanitize & prepare data                                          */
  /* ---------------------------------------------------------------- */

  const businessRaw = payload.business ?? null;
  const clientRaw = payload.client ?? null;

  const issuerName =
    limitSingleLine(businessRaw?.legalName ?? payload.businessName, 'companyName', PDF_FIELD_LIMITS.companyName, warnings) ??
    'Entreprise';

  const business = businessRaw
    ? {
        ...businessRaw,
        legalName: issuerName,
        addressLine1: limitSingleLine(businessRaw.addressLine1, 'addressLine1', PDF_FIELD_LIMITS.addressLine, warnings),
        addressLine2: limitSingleLine(businessRaw.addressLine2, 'addressLine2', PDF_FIELD_LIMITS.addressLine, warnings),
        city: limitSingleLine(businessRaw.city, 'city', PDF_FIELD_LIMITS.addressLine, warnings),
        postalCode: limitSingleLine(businessRaw.postalCode, 'postalCode', PDF_FIELD_LIMITS.addressLine, warnings),
        countryCode: limitSingleLine(businessRaw.countryCode, 'countryCode', PDF_FIELD_LIMITS.addressLine, warnings),
        websiteUrl: limitSingleLine(businessRaw.websiteUrl, 'websiteUrl', PDF_FIELD_LIMITS.addressLine, warnings),
        email: limitSingleLine(businessRaw.email, 'businessEmail', PDF_FIELD_LIMITS.addressLine, warnings),
        phone: limitSingleLine(businessRaw.phone, 'businessPhone', PDF_FIELD_LIMITS.addressLine, warnings),
        siret: limitSingleLine(businessRaw.siret, 'siret', PDF_FIELD_LIMITS.addressLine, warnings),
        vatNumber: limitSingleLine(businessRaw.vatNumber, 'vatNumber', PDF_FIELD_LIMITS.addressLine, warnings),
      }
    : null;

  const clientName =
    limitSingleLine(
      clientRaw?.companyName ?? clientRaw?.name ?? payload.clientName,
      'clientName',
      PDF_FIELD_LIMITS.clientName,
      warnings
    ) ?? 'Client';

  const client = clientRaw
    ? {
        ...clientRaw,
        name: limitSingleLine(clientRaw.name, 'clientContact', PDF_FIELD_LIMITS.clientName, warnings),
        companyName: limitSingleLine(clientRaw.companyName, 'clientCompanyName', PDF_FIELD_LIMITS.clientName, warnings),
        addressLine1: limitSingleLine(clientRaw.addressLine1, 'clientAddressLine1', PDF_FIELD_LIMITS.addressLine, warnings),
        addressLine2: limitSingleLine(clientRaw.addressLine2, 'clientAddressLine2', PDF_FIELD_LIMITS.addressLine, warnings),
        city: limitSingleLine(clientRaw.city, 'clientCity', PDF_FIELD_LIMITS.addressLine, warnings),
        postalCode: limitSingleLine(clientRaw.postalCode, 'clientPostalCode', PDF_FIELD_LIMITS.addressLine, warnings),
        countryCode: limitSingleLine(clientRaw.countryCode, 'clientCountryCode', PDF_FIELD_LIMITS.addressLine, warnings),
        address: limitSingleLine(clientRaw.address, 'clientAddress', PDF_FIELD_LIMITS.addressLine, warnings),
        email: limitSingleLine(clientRaw.email ?? payload.clientEmail, 'clientEmail', PDF_FIELD_LIMITS.addressLine, warnings),
        phone: limitSingleLine(clientRaw.phone, 'clientPhone', PDF_FIELD_LIMITS.addressLine, warnings),
        vatNumber: limitSingleLine(clientRaw.vatNumber, 'clientVatNumber', PDF_FIELD_LIMITS.addressLine, warnings),
      }
    : null;

  const truncatedItems: Array<{ index: number; label: string; fullDescription: string }> = [];
  const items: NormalizedLineItem[] = payload.items.map((item, index) => {
    const label =
      limitSingleLine(item.label, `itemTitle#${index + 1}`, PDF_FIELD_LIMITS.itemTitle, warnings) ?? `Ligne ${index + 1}`;

    const descriptionResult = trimToMax(item.description ?? null, PDF_FIELD_LIMITS.itemDescription);
    if (descriptionResult.truncated && item.description) {
      addWarning(warnings, `itemDescription#${index + 1}`, item.description, true, PDF_FIELD_LIMITS.itemDescription);
      truncatedItems.push({ index: index + 1, label, fullDescription: item.description.trim() });
    }

    return {
      ...item,
      label,
      description: descriptionResult.value,
      fullDescription: item.description?.trim() ?? null,
    };
  });

  /* ---------------------------------------------------------------- */
  /*  Compute totals                                                    */
  /* ---------------------------------------------------------------- */

  const vatEnabled = payload.vatEnabled ?? false;
  const vatRate = payload.vatRatePercent ?? 0;
  const totalCents = toBigInt(payload.totalCents);
  const vatCents = vatEnabled ? (totalCents * BigInt(Math.round(vatRate))) / BigInt(100) : BigInt(0);
  const totalTtcCents = totalCents + vatCents;
  const depositCents = toBigInt(payload.depositCents);
  const balanceCents = toBigInt(payload.balanceCents);

  const depositPercent = totalTtcCents > BigInt(0) ? Math.round(Number(depositCents * BigInt(100)) / Number(totalTtcCents)) : 0;

  const totalsRows: TotalsRow[] = [];
  totalsRows.push({ label: 'Total HT', value: formatAmount(totalCents, payload.currency), style: 'body' });
  if (vatEnabled) {
    totalsRows.push({ label: `TVA ${vatRate}%`, value: formatAmount(vatCents, payload.currency), style: 'body' });
  }
  if (vatEnabled || depositCents > BigInt(0)) {
    totalsRows.push({ label: 'Total TTC', value: formatAmount(totalTtcCents, payload.currency), style: 'section', emphasize: true });
  }
  if (depositCents > BigInt(0)) {
    const depositLabel = depositPercent > 0 ? `Acompte ${depositPercent}%` : 'Acompte';
    totalsRows.push({ label: depositLabel, value: formatAmount(depositCents, payload.currency), style: 'body' });
    totalsRows.push({
      label: payload.balanceLabel,
      value: formatAmount(balanceCents, payload.currency),
      style: payload.kind === 'INVOICE' ? 'section' : 'body',
      emphasize: payload.kind === 'INVOICE',
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Prepare address / contact data                                    */
  /* ---------------------------------------------------------------- */

  const issuerAddressLines = buildAddressLines({
    addressLine1: business?.addressLine1,
    addressLine2: business?.addressLine2,
    postalCode: business?.postalCode,
    city: business?.city,
    countryCode: business?.countryCode,
  });

  const clientContact =
    client?.companyName && client?.name && client.companyName !== client.name ? `Contact: ${client.name}` : null;

  const clientAddressLines = buildAddressLines({
    addressLine1: client?.addressLine1,
    addressLine2: client?.addressLine2,
    postalCode: client?.postalCode,
    city: client?.city,
    countryCode: client?.countryCode,
    address: client?.address,
  });

  const contentWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const contentHeight = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

  const legalSections = buildLegalSections(payload, business, truncatedItems, warnings);

  /* ---------------------------------------------------------------- */
  /*  Derive year from issuedAt for title                              */
  /* ---------------------------------------------------------------- */

  const issuedYear = (() => {
    if (!payload.issuedAt) return new Date().getFullYear();
    try {
      return new Date(payload.issuedAt).getFullYear();
    } catch {
      return new Date().getFullYear();
    }
  })();

  const docTitle = payload.kind === 'QUOTE' ? `Devis ${issuedYear}` : `Facture ${issuedYear}`;

  const secondaryDateLabel =
    payload.kind === 'QUOTE'
      ? 'Valable jusqu\'au'
      : 'Date d\'\u00e9ch\u00e9ance';

  /* ---------------------------------------------------------------- */
  /*  Condition pages estimation                                       */
  /* ---------------------------------------------------------------- */

  const conditionsHeaderEstimate = styles.title.lineHeight + styles.muted.lineHeight + 10;
  const estimatedConditionPages = estimateConditionPages(
    legalSections,
    styles,
    contentWidth,
    contentHeight,
    conditionsHeaderEstimate
  );

  if (estimatedConditionPages > PDF_FIELD_LIMITS.maxConditionPagesWarning) {
    legalSections.unshift({
      title: 'Information',
      paragraphs: [
        {
          kind: 'small',
          text: `Les mentions l\u00e9gales/CGV repr\u00e9sentent environ ${estimatedConditionPages} pages. Pour un meilleur confort, une annexe PDF d\u00e9di\u00e9e sera propos\u00e9e dans une version ult\u00e9rieure.`,
        },
      ],
    });
  }

  /* ================================================================ */
  /*  PAGE 1 — Main invoice/quote page                                 */
  /* ================================================================ */

  const page1 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;
  const rightX = PAGE_WIDTH - MARGIN_RIGHT;

  /* --- 1. Header: Title + dates --- */

  // Left: large title
  page1.drawText(sanitizePdfText(docTitle), {
    x: MARGIN_LEFT,
    y,
    size: styles.title.size,
    font: styles.title.font,
    color: styles.title.color,
  });

  // Below title: website URL in muted text
  const titleLineY = y;
  y -= styles.title.lineHeight + 2;

  if (business?.websiteUrl) {
    page1.drawText(sanitizePdfText(business.websiteUrl), {
      x: MARGIN_LEFT,
      y,
      size: styles.muted.size,
      font: styles.muted.font,
      color: styles.muted.color,
    });
    y -= styles.muted.lineHeight + 2;
  }

  // Right side: dates
  let dateY = titleLineY;
  const dateLines: string[] = [
    `Cr\u00e9\u00e9 le ${formatDate(payload.issuedAt)}`,
    `${secondaryDateLabel} ${formatDate(payload.secondaryDate)}`,
    ...(payload.extraDateLines ?? [])
      .filter((line) => line.value)
      .map((line) => `${line.label}: ${formatDate(line.value)}`),
  ];

  dateLines.forEach((line) => {
    drawRightAt(page1, line, rightX, dateY, styles.body);
    dateY -= styles.body.lineHeight + 2;
  });

  // Document number below dates
  if (payload.number || payload.documentId) {
    const numText = `N\u00b0 ${sanitizePdfText(payload.number ?? payload.documentId)}`;
    drawRightAt(page1, numText, rightX, dateY, styles.muted);
    dateY -= styles.muted.lineHeight;
  }

  y = Math.min(y, dateY) - 10;

  // Separator
  page1.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: rightX, y },
    thickness: 0.8,
    color: COLORS.line,
  });
  y -= 16;

  /* --- 2. Client / Issuer info (two columns) --- */

  const colWidth = (contentWidth - 30) / 2; // 30px gap between columns
  const leftColX = MARGIN_LEFT;
  const rightColX = MARGIN_LEFT + colWidth + 30;
  const sectionStartY = y;

  // Left column: Client
  let leftY = sectionStartY;
  page1.drawText('Client', {
    x: leftColX,
    y: leftY,
    size: styles.mutedBold.size,
    font: styles.mutedBold.font,
    color: styles.mutedBold.color,
  });
  leftY -= styles.mutedBold.lineHeight + 4;

  // Client name (bold)
  page1.drawText(sanitizePdfText(clientName), {
    x: leftColX,
    y: leftY,
    size: styles.bodyBold.size,
    font: styles.bodyBold.font,
    color: styles.bodyBold.color,
  });
  leftY -= styles.bodyBold.lineHeight + 1;

  // Client contact if different name
  if (clientContact) {
    page1.drawText(sanitizePdfText(clientContact), {
      x: leftColX,
      y: leftY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    leftY -= styles.body.lineHeight;
  }

  // Client address
  clientAddressLines.forEach((line) => {
    leftY = drawWrappedAt(page1, line, leftColX, leftY, colWidth, styles.body);
  });

  // Client email
  if (client?.email ?? payload.clientEmail) {
    const email = client?.email ?? payload.clientEmail ?? '';
    page1.drawText(sanitizePdfText(email), {
      x: leftColX,
      y: leftY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    leftY -= styles.body.lineHeight;
  }

  // Client phone
  if (client?.phone) {
    page1.drawText(sanitizePdfText(client.phone), {
      x: leftColX,
      y: leftY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    leftY -= styles.body.lineHeight;
  }

  // Client VAT
  if (client?.vatNumber) {
    page1.drawText(sanitizePdfText(`TVA: ${client.vatNumber}`), {
      x: leftColX,
      y: leftY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    leftY -= styles.body.lineHeight;
  }

  // Client reference
  if (client?.reference) {
    page1.drawText(sanitizePdfText(`R\u00e9f: ${client.reference}`), {
      x: leftColX,
      y: leftY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    leftY -= styles.body.lineHeight;
  }

  // Right column: Issuer
  let issuerY = sectionStartY;
  page1.drawText('\u00c9metteur', {
    x: rightColX,
    y: issuerY,
    size: styles.mutedBold.size,
    font: styles.mutedBold.font,
    color: styles.mutedBold.color,
  });
  issuerY -= styles.mutedBold.lineHeight + 4;

  // Issuer name (bold)
  page1.drawText(sanitizePdfText(issuerName), {
    x: rightColX,
    y: issuerY,
    size: styles.bodyBold.size,
    font: styles.bodyBold.font,
    color: styles.bodyBold.color,
  });
  issuerY -= styles.bodyBold.lineHeight + 1;

  // Issuer address
  issuerAddressLines.forEach((line) => {
    issuerY = drawWrappedAt(page1, line, rightColX, issuerY, colWidth, styles.body);
  });

  // SIRET
  if (business?.siret) {
    page1.drawText(sanitizePdfText(`SIRET: ${business.siret}`), {
      x: rightColX,
      y: issuerY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    issuerY -= styles.body.lineHeight;
  }

  // Issuer email
  if (business?.email) {
    page1.drawText(sanitizePdfText(business.email), {
      x: rightColX,
      y: issuerY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    issuerY -= styles.body.lineHeight;
  }

  // Issuer phone
  if (business?.phone) {
    page1.drawText(sanitizePdfText(business.phone), {
      x: rightColX,
      y: issuerY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    issuerY -= styles.body.lineHeight;
  }

  // Issuer VAT
  if (business?.vatNumber) {
    page1.drawText(sanitizePdfText(`TVA: ${business.vatNumber}`), {
      x: rightColX,
      y: issuerY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    issuerY -= styles.body.lineHeight;
  }

  y = Math.min(leftY, issuerY) - 10;

  // Separator
  page1.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: rightX, y },
    thickness: 0.8,
    color: COLORS.line,
  });
  y -= 16;

  /* --- 3. Line items table (3 columns: Description, Qté, Prix) --- */

  const colDescWidth = Math.round(contentWidth * 0.65);
  const colQtyWidth = Math.round(contentWidth * 0.15);

  const tableDescX = MARGIN_LEFT;
  const tableQtyRight = MARGIN_LEFT + colDescWidth + colQtyWidth;
  const tablePriceRight = rightX;

  // Table header
  page1.drawText('Description', {
    x: tableDescX,
    y,
    size: styles.mutedBold.size,
    font: styles.mutedBold.font,
    color: styles.mutedBold.color,
  });
  drawRightAt(page1, 'Qt\u00e9', tableQtyRight, y, styles.mutedBold);
  drawRightAt(page1, 'Prix', tablePriceRight, y, styles.mutedBold);

  y -= styles.mutedBold.lineHeight + 4;

  // Header separator
  page1.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: rightX, y },
    thickness: 0.8,
    color: COLORS.line,
  });
  y -= 10;

  // Use FlowLayout from here for automatic page breaks in the items table
  // We create a layout that starts on page1 at cursor y
  // But since page1 is already created manually, we need to handle pagination manually for items
  // If there are many items and they don't fit, we'll break to new pages via FlowLayout
  // Actually, for items on page 1, let's draw them directly and overflow to a FlowLayout if needed

  const itemsTotalHeight = items.reduce((sum, item) => {
    const labelM = measureParagraph(item.label, styles.bodyBold, colDescWidth - 6);
    const descM = item.description ? measureParagraph(item.description, styles.small, colDescWidth - 16) : null;
    return sum + labelM.height + (descM ? descM.height + 4 : 0) + 12;
  }, 0);

  const totalsBlockHeight =
    18 +
    totalsRows.reduce(
      (sum, row) => sum + (row.style === 'section' ? styles.section.lineHeight : styles.body.lineHeight) + 2,
      0
    );

  const signatureBlockHeight = payload.includeSignature ? 100 : 0;
  const bankBlockHeight = (business?.iban || business?.bic) ? 40 : 0;

  const remainingOnPage1 = y - MARGIN_BOTTOM - FOOTER_DIVIDER_Y;

  // If everything fits on page 1, draw directly. Otherwise use FlowLayout for overflow.
  const totalNeeded = itemsTotalHeight + totalsBlockHeight + signatureBlockHeight + bankBlockHeight + 20;
  const fitsOnPage1 = totalNeeded <= remainingOnPage1;

  if (fitsOnPage1 && items.length > 0) {
    // Draw items directly on page 1
    items.forEach((item, index) => {
      const labelM = measureParagraph(item.label, styles.bodyBold, colDescWidth - 6);

      // First label line + numeric columns
      labelM.lines.forEach((line, lineIndex) => {
        if (lineIndex === 0) {
          const unitLabel = resolveUnitLabel(item);
          drawRightAt(page1, unitLabel ? `${item.quantity} ${unitLabel}` : String(item.quantity), tableQtyRight, y, styles.body);
          drawRightAt(page1, formatAmount(item.totalCents, payload.currency), tablePriceRight, y, styles.bodyBold);
        }
        const lineStyle = lineIndex === 0 ? styles.bodyBold : styles.body;
        page1.drawText(sanitizePdfText(line), {
          x: tableDescX,
          y,
          size: lineStyle.size,
          font: lineStyle.font,
          color: lineStyle.color,
        });
        y -= lineStyle.lineHeight;
      });

      // Description lines
      if (item.description) {
        const descM = measureParagraph(item.description, styles.small, colDescWidth - 16);
        y -= 2;
        descM.lines.forEach((line) => {
          page1.drawText(sanitizePdfText(line), {
            x: tableDescX + 10,
            y,
            size: styles.small.size,
            font: styles.small.font,
            color: styles.small.color,
          });
          y -= styles.small.lineHeight;
        });
      }

      y -= 4;

      // Row separator
      if (index < items.length - 1) {
        page1.drawLine({
          start: { x: MARGIN_LEFT, y },
          end: { x: rightX, y },
          thickness: 0.5,
          color: COLORS.line,
        });
        y -= 8;
      }
    });

    // Table bottom separator
    y -= 4;
    page1.drawLine({
      start: { x: MARGIN_LEFT, y },
      end: { x: rightX, y },
      thickness: 0.8,
      color: COLORS.line,
    });
    y -= 14;

    /* --- 4. Totals section (right-aligned) --- */
    const totalsLabelX = rightX - 220;

    totalsRows.forEach((row) => {
      const rowStyle = row.style === 'section' ? styles.section : styles.body;
      const labelColor = row.emphasize ? COLORS.primary : MUTED_COLOR;

      page1.drawText(sanitizePdfText(row.label), {
        x: totalsLabelX,
        y,
        size: rowStyle.size,
        font: rowStyle.font,
        color: labelColor,
      });

      drawRightAt(page1, row.value, rightX, y, rowStyle);
      y -= rowStyle.lineHeight + 2;
    });

    y -= 6;
    page1.drawLine({
      start: { x: MARGIN_LEFT, y },
      end: { x: rightX, y },
      thickness: 0.8,
      color: COLORS.line,
    });
    y -= 14;

    /* --- 5. IBAN/BIC section --- */
    if (business?.iban || business?.bic) {
      const bankParts: string[] = [];
      if (business.iban) bankParts.push(`IBAN: ${business.iban}`);
      if (business.bic) bankParts.push(`BIC: ${business.bic}`);

      page1.drawText(sanitizePdfText(bankParts.join('    ')), {
        x: MARGIN_LEFT,
        y,
        size: styles.body.size,
        font: styles.body.font,
        color: styles.body.color,
      });
      y -= styles.body.lineHeight;

      if (business.accountHolder) {
        page1.drawText(sanitizePdfText(`Titulaire: ${business.accountHolder}`), {
          x: MARGIN_LEFT,
          y,
          size: styles.body.size,
          font: styles.body.font,
          color: styles.body.color,
        });
        y -= styles.body.lineHeight;
      }

      y -= 8;
      page1.drawLine({
        start: { x: MARGIN_LEFT, y },
        end: { x: rightX, y },
        thickness: 0.8,
        color: COLORS.line,
      });
      y -= 14;
    }

    /* --- 6. Signature block (quotes only) --- */
    if (payload.includeSignature) {
      page1.drawText('Bon pour accord', {
        x: MARGIN_LEFT,
        y,
        size: styles.section.size,
        font: styles.section.font,
        color: styles.section.color,
      });
      y -= styles.section.lineHeight + 10;

      page1.drawText('Signature:', {
        x: MARGIN_LEFT,
        y,
        size: styles.body.size,
        font: styles.body.font,
        color: styles.body.color,
      });
      page1.drawLine({
        start: { x: MARGIN_LEFT + 65, y: y + 2 },
        end: { x: MARGIN_LEFT + 260, y: y + 2 },
        thickness: 0.8,
        color: COLORS.line,
      });
      y -= styles.body.lineHeight + 14;

      page1.drawText('Date:', {
        x: MARGIN_LEFT,
        y,
        size: styles.body.size,
        font: styles.body.font,
        color: styles.body.color,
      });
      page1.drawLine({
        start: { x: MARGIN_LEFT + 38, y: y + 2 },
        end: { x: MARGIN_LEFT + 200, y: y + 2 },
        thickness: 0.8,
        color: COLORS.line,
      });
      y -= styles.body.lineHeight + 8;
    }
  } else {
    /* --- Items overflow: use FlowLayout for multi-page table --- */

    const repeatedSectionTitle: string | null = null;

    const drawOverflowPageHeader = (layout: FlowLayout) => {
      const page = layout.getPage();
      const startY = layout.getCursorY();

      // Compact header on overflow pages
      page.drawText(sanitizePdfText(docTitle), {
        x: MARGIN_LEFT,
        y: startY,
        size: styles.section.size,
        font: styles.section.font,
        color: styles.section.color,
      });

      const numText = payload.number ? `N\u00b0 ${sanitizePdfText(payload.number)}` : '';
      if (numText) {
        drawRightAt(page, numText, rightX, startY, styles.muted);
      }

      layout.setCursorY(startY - styles.section.lineHeight - 4);
      layout.drawHorizontalRule(0.8, COLORS.line, 10);

      if (repeatedSectionTitle) {
        const measured = measureParagraph(repeatedSectionTitle, styles.title, contentWidth);
        layout.ensureHeight(measured.height + 6, true);
        layout.drawMeasuredParagraph(measured, {
          x: MARGIN_LEFT,
          style: styles.title,
          keepTogether: true,
          spacingAfter: 6,
        });
        layout.drawHorizontalRule(0.8, COLORS.line, 10);
      }
    };

    // Create a separate layout that skips page1 (already created)
    // We'll draw remaining items using FlowLayout starting from new pages
    // But first, draw what fits on page1

    let itemsDrawnOnPage1 = 0;
    const availableForItems = remainingOnPage1 - totalsBlockHeight - signatureBlockHeight - bankBlockHeight - 30;

    // Draw items that fit on page 1
    let usedHeight = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const labelM = measureParagraph(item.label, styles.bodyBold, colDescWidth - 6);
      const descM = item.description ? measureParagraph(item.description, styles.small, colDescWidth - 16) : null;
      const rowH = labelM.height + (descM ? descM.height + 6 : 0) + 12;

      if (usedHeight + rowH > availableForItems && i > 0) break;

      // Draw item row
      labelM.lines.forEach((line, lineIndex) => {
        if (lineIndex === 0) {
          const unitLabel = resolveUnitLabel(item);
          drawRightAt(page1, unitLabel ? `${item.quantity} ${unitLabel}` : String(item.quantity), tableQtyRight, y, styles.body);
          drawRightAt(page1, formatAmount(item.totalCents, payload.currency), tablePriceRight, y, styles.bodyBold);
        }
        const lineStyle = lineIndex === 0 ? styles.bodyBold : styles.body;
        page1.drawText(sanitizePdfText(line), {
          x: tableDescX,
          y,
          size: lineStyle.size,
          font: lineStyle.font,
          color: lineStyle.color,
        });
        y -= lineStyle.lineHeight;
      });

      if (descM) {
        y -= 2;
        descM.lines.forEach((line) => {
          page1.drawText(sanitizePdfText(line), {
            x: tableDescX + 10,
            y,
            size: styles.small.size,
            font: styles.small.font,
            color: styles.small.color,
          });
          y -= styles.small.lineHeight;
        });
      }

      y -= 4;
      if (i < items.length - 1) {
        page1.drawLine({
          start: { x: MARGIN_LEFT, y },
          end: { x: rightX, y },
          thickness: 0.5,
          color: COLORS.line,
        });
        y -= 8;
      }

      usedHeight += rowH;
      itemsDrawnOnPage1 = i + 1;
    }

    const remainingItems = items.slice(itemsDrawnOnPage1);

    if (remainingItems.length > 0) {
      // Continue on new pages using FlowLayout
      const overflowLayout = new FlowLayout({
        pdfDoc,
        pageWidth: PAGE_WIDTH,
        pageHeight: PAGE_HEIGHT,
        marginTop: MARGIN_TOP,
        marginBottom: MARGIN_BOTTOM,
        marginLeft: MARGIN_LEFT,
        marginRight: MARGIN_RIGHT,
        minLinesOnSplit: 3,
        minLinesPerPage: 6,
        onNewPage: drawOverflowPageHeader,
      });

      // Draw table header on overflow page
      const drawOverflowTableHeader = () => {
        overflowLayout.ensureHeight(styles.mutedBold.lineHeight + 12, true);
        const page = overflowLayout.getPage();
        const headerY = overflowLayout.getCursorY();

        page.drawText('Description', {
          x: tableDescX,
          y: headerY,
          size: styles.mutedBold.size,
          font: styles.mutedBold.font,
          color: styles.mutedBold.color,
        });
        drawRightAt(page, 'Qt\u00e9', tableQtyRight, headerY, styles.mutedBold);
        drawRightAt(page, 'Prix', tablePriceRight, headerY, styles.mutedBold);

        overflowLayout.moveDown(styles.mutedBold.lineHeight + 2);
        overflowLayout.drawHorizontalRule(0.8, COLORS.line, 8);
      };

      drawOverflowTableHeader();

      remainingItems.forEach((item, index) => {
        const labelM = measureParagraph(item.label, styles.bodyBold, colDescWidth - 6);
        const descM = item.description ? measureParagraph(item.description, styles.small, colDescWidth - 16) : null;
        const rowH = labelM.height + (descM ? descM.height + 6 : 0) + 12;

        const isLast = index === remainingItems.length - 1;
        const reserveForFinal = isLast ? totalsBlockHeight + signatureBlockHeight + bankBlockHeight + 20 : 0;

        if (overflowLayout.getAvailableHeight() < rowH + reserveForFinal) {
          overflowLayout.addPage();
          drawOverflowTableHeader();
        }

        const overflowPage = overflowLayout.getPage();

        labelM.lines.forEach((line, lineIndex) => {
          const lineY = overflowLayout.getCursorY();
          if (lineIndex === 0) {
            const unitLabel = resolveUnitLabel(item);
            drawRightAt(overflowPage, unitLabel ? `${item.quantity} ${unitLabel}` : String(item.quantity), tableQtyRight, lineY, styles.body);
            drawRightAt(overflowPage, formatAmount(item.totalCents, payload.currency), tablePriceRight, lineY, styles.bodyBold);
          }
          const lineStyle = lineIndex === 0 ? styles.bodyBold : styles.body;
          overflowLayout.drawTextLine(line, tableDescX, lineStyle);
        });

        if (descM) {
          overflowLayout.moveDown(2);
          descM.lines.forEach((line) => {
            overflowLayout.drawTextLine(line, tableDescX + 10, styles.small);
          });
        }

        overflowLayout.moveDown(4);
        if (!isLast) {
          overflowLayout.drawHorizontalRule(0.5, COLORS.line, 8);
        }
      });

      // Table bottom separator
      overflowLayout.moveDown(4);
      overflowLayout.drawHorizontalRule(0.8, COLORS.line, 14);

      // Totals
      const totalsLabelX = rightX - 220;
      overflowLayout.ensureHeight(totalsBlockHeight, true);

      totalsRows.forEach((row) => {
        const rowStyle = row.style === 'section' ? styles.section : styles.body;
        const labelColor = row.emphasize ? COLORS.primary : MUTED_COLOR;
        const rowY = overflowLayout.getCursorY();
        const overflowPage = overflowLayout.getPage();

        overflowPage.drawText(sanitizePdfText(row.label), {
          x: totalsLabelX,
          y: rowY,
          size: rowStyle.size,
          font: rowStyle.font,
          color: labelColor,
        });

        drawRightAt(overflowPage, row.value, rightX, rowY, rowStyle);
        overflowLayout.moveDown(rowStyle.lineHeight + 2);
      });

      overflowLayout.moveDown(6);
      overflowLayout.drawHorizontalRule(0.8, COLORS.line, 14);

      // IBAN/BIC
      if (business?.iban || business?.bic) {
        overflowLayout.ensureHeight(bankBlockHeight, true);
        const bankParts: string[] = [];
        if (business.iban) bankParts.push(`IBAN: ${business.iban}`);
        if (business.bic) bankParts.push(`BIC: ${business.bic}`);

        overflowLayout.drawTextLine(bankParts.join('    '), MARGIN_LEFT, styles.body);
        if (business.accountHolder) {
          overflowLayout.drawTextLine(`Titulaire: ${business.accountHolder}`, MARGIN_LEFT, styles.body);
        }
        overflowLayout.moveDown(8);
        overflowLayout.drawHorizontalRule(0.8, COLORS.line, 14);
      }

      // Signature
      if (payload.includeSignature) {
        overflowLayout.ensureHeight(signatureBlockHeight, true);
        overflowLayout.drawTextLine('Bon pour accord', MARGIN_LEFT, styles.section);
        overflowLayout.moveDown(10);

        const sigPage = overflowLayout.getPage();
        const sigY = overflowLayout.getCursorY();

        sigPage.drawText('Signature:', {
          x: MARGIN_LEFT,
          y: sigY,
          size: styles.body.size,
          font: styles.body.font,
          color: styles.body.color,
        });
        sigPage.drawLine({
          start: { x: MARGIN_LEFT + 65, y: sigY + 2 },
          end: { x: MARGIN_LEFT + 260, y: sigY + 2 },
          thickness: 0.8,
          color: COLORS.line,
        });

        overflowLayout.moveDown(styles.body.lineHeight + 14);
        const dateYOvf = overflowLayout.getCursorY();

        sigPage.drawText('Date:', {
          x: MARGIN_LEFT,
          y: dateYOvf,
          size: styles.body.size,
          font: styles.body.font,
          color: styles.body.color,
        });
        sigPage.drawLine({
          start: { x: MARGIN_LEFT + 38, y: dateYOvf + 2 },
          end: { x: MARGIN_LEFT + 200, y: dateYOvf + 2 },
          thickness: 0.8,
          color: COLORS.line,
        });

        overflowLayout.moveDown(styles.body.lineHeight + 8);
      }

      // We don't call overflowLayout.finalizeFooters here; footers handled globally below
    } else {
      // All items fit on page 1 but totals/bank/signature don't.
      // Check if totals actually fit in remaining space; if not, overflow to new page.
      const remainingAfterItems = y - MARGIN_BOTTOM - FOOTER_DIVIDER_Y;
      const trailingNeeded = totalsBlockHeight + bankBlockHeight + signatureBlockHeight + 30;

      if (trailingNeeded <= remainingAfterItems) {
        // Enough room on page 1 — draw directly
        y -= 4;
        page1.drawLine({
          start: { x: MARGIN_LEFT, y },
          end: { x: rightX, y },
          thickness: 0.8,
          color: COLORS.line,
        });
        y -= 14;

        const totalsLabelX = rightX - 220;
        totalsRows.forEach((row) => {
          const rowStyle = row.style === 'section' ? styles.section : styles.body;
          const labelColor = row.emphasize ? COLORS.primary : MUTED_COLOR;

          page1.drawText(sanitizePdfText(row.label), {
            x: totalsLabelX,
            y,
            size: rowStyle.size,
            font: rowStyle.font,
            color: labelColor,
          });
          drawRightAt(page1, row.value, rightX, y, rowStyle);
          y -= rowStyle.lineHeight + 2;
        });

        y -= 6;
        page1.drawLine({
          start: { x: MARGIN_LEFT, y },
          end: { x: rightX, y },
          thickness: 0.8,
          color: COLORS.line,
        });
        y -= 14;

        if (business?.iban || business?.bic) {
          const bankParts: string[] = [];
          if (business.iban) bankParts.push(`IBAN: ${business.iban}`);
          if (business.bic) bankParts.push(`BIC: ${business.bic}`);

          page1.drawText(sanitizePdfText(bankParts.join('    ')), {
            x: MARGIN_LEFT,
            y,
            size: styles.body.size,
            font: styles.body.font,
            color: styles.body.color,
          });
          y -= styles.body.lineHeight;

          if (business.accountHolder) {
            page1.drawText(sanitizePdfText(`Titulaire: ${business.accountHolder}`), {
              x: MARGIN_LEFT,
              y,
              size: styles.body.size,
              font: styles.body.font,
              color: styles.body.color,
            });
            y -= styles.body.lineHeight;
          }

          y -= 8;
          page1.drawLine({
            start: { x: MARGIN_LEFT, y },
            end: { x: rightX, y },
            thickness: 0.8,
            color: COLORS.line,
          });
          y -= 14;
        }

        if (payload.includeSignature) {
          page1.drawText('Bon pour accord', {
            x: MARGIN_LEFT,
            y,
            size: styles.section.size,
            font: styles.section.font,
            color: styles.section.color,
          });
          y -= styles.section.lineHeight + 10;

          page1.drawText('Signature:', {
            x: MARGIN_LEFT,
            y,
            size: styles.body.size,
            font: styles.body.font,
            color: styles.body.color,
          });
          page1.drawLine({
            start: { x: MARGIN_LEFT + 65, y: y + 2 },
            end: { x: MARGIN_LEFT + 260, y: y + 2 },
            thickness: 0.8,
            color: COLORS.line,
          });
          y -= styles.body.lineHeight + 14;

          page1.drawText('Date:', {
            x: MARGIN_LEFT,
            y,
            size: styles.body.size,
            font: styles.body.font,
            color: styles.body.color,
          });
          page1.drawLine({
            start: { x: MARGIN_LEFT + 38, y: y + 2 },
            end: { x: MARGIN_LEFT + 200, y: y + 2 },
            thickness: 0.8,
            color: COLORS.line,
          });
          y -= styles.body.lineHeight + 8;
        }
      } else {
        // Not enough room — overflow totals/bank/signature to a new page
        y -= 4;
        page1.drawLine({
          start: { x: MARGIN_LEFT, y },
          end: { x: rightX, y },
          thickness: 0.8,
          color: COLORS.line,
        });

        const trailingLayout = new FlowLayout({
          pdfDoc,
          pageWidth: PAGE_WIDTH,
          pageHeight: PAGE_HEIGHT,
          marginTop: MARGIN_TOP,
          marginBottom: MARGIN_BOTTOM,
          marginLeft: MARGIN_LEFT,
          marginRight: MARGIN_RIGHT,
          minLinesOnSplit: 3,
          minLinesPerPage: 6,
          onNewPage: drawOverflowPageHeader,
        });

        // Totals
        const totalsLabelX = rightX - 220;
        trailingLayout.ensureHeight(totalsBlockHeight, true);
        totalsRows.forEach((row) => {
          const rowStyle = row.style === 'section' ? styles.section : styles.body;
          const labelColor = row.emphasize ? COLORS.primary : MUTED_COLOR;
          const rowY = trailingLayout.getCursorY();
          const tPage = trailingLayout.getPage();

          tPage.drawText(sanitizePdfText(row.label), {
            x: totalsLabelX,
            y: rowY,
            size: rowStyle.size,
            font: rowStyle.font,
            color: labelColor,
          });
          drawRightAt(tPage, row.value, rightX, rowY, rowStyle);
          trailingLayout.moveDown(rowStyle.lineHeight + 2);
        });

        trailingLayout.moveDown(6);
        trailingLayout.drawHorizontalRule(0.8, COLORS.line, 14);

        if (business?.iban || business?.bic) {
          trailingLayout.ensureHeight(bankBlockHeight, true);
          const bankParts: string[] = [];
          if (business.iban) bankParts.push(`IBAN: ${business.iban}`);
          if (business.bic) bankParts.push(`BIC: ${business.bic}`);

          trailingLayout.drawTextLine(bankParts.join('    '), MARGIN_LEFT, styles.body);
          if (business.accountHolder) {
            trailingLayout.drawTextLine(`Titulaire: ${business.accountHolder}`, MARGIN_LEFT, styles.body);
          }
          trailingLayout.moveDown(8);
          trailingLayout.drawHorizontalRule(0.8, COLORS.line, 14);
        }

        if (payload.includeSignature) {
          trailingLayout.ensureHeight(signatureBlockHeight, true);
          trailingLayout.drawTextLine('Bon pour accord', MARGIN_LEFT, styles.section);
          trailingLayout.moveDown(10);

          const sigPage = trailingLayout.getPage();
          const sigY = trailingLayout.getCursorY();

          sigPage.drawText('Signature:', {
            x: MARGIN_LEFT,
            y: sigY,
            size: styles.body.size,
            font: styles.body.font,
            color: styles.body.color,
          });
          sigPage.drawLine({
            start: { x: MARGIN_LEFT + 65, y: sigY + 2 },
            end: { x: MARGIN_LEFT + 260, y: sigY + 2 },
            thickness: 0.8,
            color: COLORS.line,
          });

          trailingLayout.moveDown(styles.body.lineHeight + 14);
          const dateYOvf = trailingLayout.getCursorY();

          sigPage.drawText('Date:', {
            x: MARGIN_LEFT,
            y: dateYOvf,
            size: styles.body.size,
            font: styles.body.font,
            color: styles.body.color,
          });
          sigPage.drawLine({
            start: { x: MARGIN_LEFT + 38, y: dateYOvf + 2 },
            end: { x: MARGIN_LEFT + 200, y: dateYOvf + 2 },
            thickness: 0.8,
            color: COLORS.line,
          });

          trailingLayout.moveDown(styles.body.lineHeight + 8);
        }
      }
    }
  }

  /* ================================================================ */
  /*  PAGE 2 — Summary / Récapitulatif                                 */
  /* ================================================================ */

  // Summary page uses FlowLayout to handle overflow when content is long
  const summaryLayout = new FlowLayout({
    pdfDoc,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    marginTop: MARGIN_TOP,
    marginBottom: MARGIN_BOTTOM,
    marginLeft: MARGIN_LEFT,
    marginRight: MARGIN_RIGHT,
    minLinesOnSplit: 3,
    minLinesPerPage: 6,
    onNewPage: (layout) => {
      const page = layout.getPage();
      const startY = layout.getCursorY();

      page.drawText(sanitizePdfText(docTitle), {
        x: MARGIN_LEFT,
        y: startY,
        size: styles.section.size,
        font: styles.section.font,
        color: styles.section.color,
      });

      if (payload.number) {
        drawRightAt(page, `N\u00b0 ${sanitizePdfText(payload.number)}`, rightX, startY, styles.muted);
      }

      layout.setCursorY(startY - styles.section.lineHeight - 4);
      layout.drawHorizontalRule(0.8, COLORS.line, 10);

      // Repeat "Récapitulatif" subtitle on overflow pages
      const subtitleM = measureParagraph('R\u00e9capitulatif (suite)', styles.section, contentWidth);
      layout.drawMeasuredParagraph(subtitleM, {
        x: MARGIN_LEFT,
        style: styles.section,
        keepTogether: true,
        spacingAfter: 6,
      });
      layout.drawHorizontalRule(0.8, COLORS.line, 10);
    },
  });

  // Page title
  const summaryTitleM = measureParagraph('R\u00e9capitulatif', styles.title, contentWidth);
  summaryLayout.drawMeasuredParagraph(summaryTitleM, {
    x: MARGIN_LEFT,
    style: styles.title,
    keepTogether: true,
    spacingAfter: 6,
  });
  summaryLayout.drawHorizontalRule(0.8, COLORS.line, 18);

  // Summary rows: label (left, muted) + value (right, body), separated by lines
  const projectName = limitSingleLine(payload.projectName, 'projectName', PDF_FIELD_LIMITS.clientName, warnings);

  type SummaryRow = { label: string; value: string; multiline?: boolean };
  const summaryRows: SummaryRow[] = [];

  // Objet
  if (projectName) {
    summaryRows.push({ label: 'Objet', value: projectName });
  }

  // Date
  summaryRows.push({ label: 'Date', value: formatDate(payload.issuedAt) });

  // Client
  summaryRows.push({ label: 'Client', value: clientName });

  // Émetteur
  summaryRows.push({ label: '\u00c9metteur', value: issuerName });

  // Montant total
  const displayTotal = vatEnabled ? totalTtcCents : totalCents;
  summaryRows.push({ label: 'Montant total', value: formatAmount(displayTotal, payload.currency) });

  // Engagements (deposit + payment terms)
  const engagementParts: string[] = [];
  if (depositCents > BigInt(0)) {
    const pct = depositPercent > 0 ? ` (${depositPercent}%)` : '';
    engagementParts.push(`Acompte${pct}: ${formatAmount(depositCents, payload.currency)}`);
  }
  if (payload.paymentTermsDays != null) {
    engagementParts.push(`Paiement sous ${payload.paymentTermsDays} jours`);
  }
  if (engagementParts.length) {
    summaryRows.push({ label: 'Engagements', value: engagementParts.join(' \u2014 ') });
  }

  // Détail prestations
  if (items.length) {
    const itemLines = items.map((item) => `${item.label}: ${formatAmount(item.totalCents, payload.currency)}`);
    summaryRows.push({ label: 'D\u00e9tail prestations', value: itemLines.join('\n'), multiline: true });
  }

  // Conditions particulières
  const noteText = limitMultiline(payload.note, 'summaryNote', PDF_FIELD_LIMITS.legalMentions, warnings);
  if (noteText) {
    summaryRows.push({ label: 'Conditions particuli\u00e8res', value: noteText, multiline: true });
  }

  // Draw summary rows with overflow protection
  summaryRows.forEach((row) => {
    if (row.multiline) {
      // Keep label + first few lines together
      const firstLineH = styles.muted.lineHeight + 4 + styles.body.lineHeight * 2;
      summaryLayout.ensureHeight(firstLineH, true);

      summaryLayout.drawTextLine(row.label, MARGIN_LEFT, styles.muted);
      summaryLayout.moveDown(4);

      const valueLines = row.value.split('\n');
      valueLines.forEach((vLine) => {
        const measured = measureParagraph(vLine, styles.body, contentWidth);
        summaryLayout.drawMeasuredParagraph(measured, {
          x: MARGIN_LEFT,
          style: styles.body,
          keepTogether: measured.lines.length <= 3,
        });
      });
      summaryLayout.moveDown(4);
    } else {
      // Single-line row: label left, value right — keep together
      summaryLayout.ensureHeight(styles.body.lineHeight + 6, true);
      const rowPage = summaryLayout.getPage();
      const rowY = summaryLayout.getCursorY();

      rowPage.drawText(sanitizePdfText(row.label), {
        x: MARGIN_LEFT,
        y: rowY,
        size: styles.muted.size,
        font: styles.muted.font,
        color: styles.muted.color,
      });
      drawRightAt(rowPage, row.value, rightX, rowY, styles.body);
      summaryLayout.moveDown(styles.body.lineHeight + 6);
    }

    // Separator
    summaryLayout.drawHorizontalRule(0.5, COLORS.line, 14);
  });

  /* ================================================================ */
  /*  CONDITIONS PAGES (CGV, legal, etc.)                              */
  /* ================================================================ */

  if (legalSections.length) {
    let conditionsRepeatedTitle: string | null = null;

    const conditionsLayout = new FlowLayout({
      pdfDoc,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      marginTop: MARGIN_TOP,
      marginBottom: MARGIN_BOTTOM,
      marginLeft: MARGIN_LEFT,
      marginRight: MARGIN_RIGHT,
      minLinesOnSplit: 3,
      minLinesPerPage: 6,
      onNewPage: (layout) => {
        const page = layout.getPage();
        const startY = layout.getCursorY();

        // Compact header
        page.drawText(sanitizePdfText(docTitle), {
          x: MARGIN_LEFT,
          y: startY,
          size: styles.section.size,
          font: styles.section.font,
          color: styles.section.color,
        });

        if (payload.number) {
          drawRightAt(page, `N\u00b0 ${sanitizePdfText(payload.number)}`, rightX, startY, styles.muted);
        }

        layout.setCursorY(startY - styles.section.lineHeight - 4);
        layout.drawHorizontalRule(0.8, COLORS.line, 10);

        if (conditionsRepeatedTitle) {
          const measured = measureParagraph(conditionsRepeatedTitle, styles.section, contentWidth);
          layout.ensureHeight(measured.height + 6, true);
          layout.drawMeasuredParagraph(measured, {
            x: MARGIN_LEFT,
            style: styles.section,
            keepTogether: true,
            spacingAfter: 6,
          });
          layout.drawHorizontalRule(0.8, COLORS.line, 10);
        }
      },
    });

    // Title on first conditions page
    conditionsRepeatedTitle = 'Conditions g\u00e9n\u00e9rales';

    const titleMeasured = measureParagraph('Conditions g\u00e9n\u00e9rales', styles.title, contentWidth);
    conditionsLayout.drawMeasuredParagraph(titleMeasured, {
      x: MARGIN_LEFT,
      style: styles.title,
      keepTogether: true,
      spacingAfter: 6,
    });
    conditionsLayout.drawHorizontalRule(0.8, COLORS.line, 12);

    legalSections.forEach((section) => {
      const firstParagraph = section.paragraphs.find((paragraph) => paragraph.kind !== 'hr' && paragraph.text.trim().length > 0);
      const firstParagraphStyle =
        firstParagraph?.kind === 'small' ? styles.small : firstParagraph?.kind === 'h3' ? styles.section : styles.body;
      const firstParagraphHeight = firstParagraph
        ? measureParagraph(firstParagraph.text, firstParagraphStyle, contentWidth).height
        : styles.body.lineHeight * 3;

      conditionsLayout.ensureHeight(styles.section.lineHeight + Math.max(firstParagraphHeight, styles.body.lineHeight * 3), true);
      conditionsLayout.drawTextLine(section.title, MARGIN_LEFT, styles.section);
      conditionsLayout.moveDown(2);

      section.paragraphs.forEach((paragraph) => {
        renderTextParagraph(conditionsLayout, paragraph, styles, contentWidth);
      });

      conditionsLayout.moveDown(4);
    });
  }

  /* ================================================================ */
  /*  FOOTERS — All pages                                              */
  /* ================================================================ */

  const vatFooterText = !vatEnabled ? 'TVA non applicable - article 293B du CGI' : null;
  const allPages = pdfDoc.getPages();
  const totalPages = allPages.length;

  allPages.forEach((page, index) => {
    // Divider line
    page.drawLine({
      start: { x: MARGIN_LEFT, y: FOOTER_DIVIDER_Y },
      end: { x: rightX, y: FOOTER_DIVIDER_Y },
      thickness: 0.6,
      color: COLORS.line,
    });

    // Left: VAT exemption text
    if (vatFooterText) {
      page.drawText(sanitizePdfText(vatFooterText), {
        x: MARGIN_LEFT,
        y: FOOTER_Y,
        size: styles.muted.size,
        font: styles.muted.font,
        color: styles.muted.color,
      });
    }

    // Right: page number
    const pageText = `Page ${index + 1}/${totalPages}`;
    drawRightAt(page, pageText, rightX, FOOTER_Y, styles.muted);
  });

  /* ================================================================ */
  /*  Finalize                                                         */
  /* ================================================================ */

  if (warnings.length) {
    // Warnings are intentionally only logged server-side for observability.
    console.warn('[pdf] generation warnings', warnings);
  }

  return pdfDoc.save();
}
