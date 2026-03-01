import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { FlowLayout, measureParagraph, sanitizePdfText, type LayoutTextStyle } from '@/server/pdf/layoutFlow';
import { parseMarkdownSubset, splitParagraphs, type TextParagraph, type TextSection } from '@/server/pdf/textStructure';
import { PDF_FIELD_LIMITS, trimSingleLine, trimToMax, type PdfValidationWarning } from '@/server/pdf/pdfValidation';

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

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 50;
const FOOTER_Y = 20;
const FOOTER_DIVIDER_Y = 34;

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

const COLORS = {
  primary: rgb(0.1, 0.1, 0.1),
  secondary: rgb(0.38, 0.38, 0.38),
  muted: rgb(0.5, 0.5, 0.5),
  line: rgb(0.88, 0.88, 0.88),
};

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
  if (!value) return '—';
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

function formatUnitPrice(value: Moneyish, currency: string, unitLabel: string | null) {
  const base = formatAmount(value, currency);
  return unitLabel ? `${base} ${unitLabel}` : base;
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
    message: `${field} tronqué à ${maxChars} caractères.`,
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
    if (cgv) sections.push(toStructuredSection('Conditions générales de vente', cgv));
  }

  if (business?.paymentTermsText || payload.paymentTermsDays != null) {
    const raw = business?.paymentTermsText ?? `Paiement sous ${payload.paymentTermsDays} jours.`;
    const paymentTerms = limitMultiline(raw, 'paymentTerms', PDF_FIELD_LIMITS.paymentTerms, warnings);
    if (paymentTerms) sections.push(toStructuredSection('Conditions de paiement', paymentTerms));
  }

  if (business?.lateFeesText) {
    const late = limitMultiline(business.lateFeesText, 'lateFeesText', PDF_FIELD_LIMITS.legalMentions, warnings);
    if (late) sections.push(toStructuredSection('Pénalités de retard', late));
  }

  if (business?.fixedIndemnityText) {
    const indemnity = limitMultiline(
      business.fixedIndemnityText,
      'fixedIndemnityText',
      PDF_FIELD_LIMITS.legalMentions,
      warnings
    );
    if (indemnity) sections.push(toStructuredSection('Indemnité forfaitaire', indemnity));
  }

  if (business?.legalMentionsText) {
    const mentions = limitMultiline(
      business.legalMentionsText,
      'legalMentions',
      PDF_FIELD_LIMITS.legalMentions,
      warnings
    );
    if (mentions) sections.push(toStructuredSection('Mentions légales', mentions));
  }

  if (business?.billingLegalText) {
    const extra = limitMultiline(
      business.billingLegalText,
      'billingLegalText',
      PDF_FIELD_LIMITS.legalMentions,
      warnings
    );
    if (extra) sections.push(toStructuredSection('Mentions complémentaires', extra));
  }

  if (!sections.length && business?.legalText) {
    const fallback = limitMultiline(business.legalText, 'legalText', PDF_FIELD_LIMITS.legalMentions, warnings);
    if (fallback) sections.push(toStructuredSection('Mentions légales', fallback));
  }

  const note = limitMultiline(payload.note, 'note', PDF_FIELD_LIMITS.legalMentions, warnings);
  if (note) {
    sections.push(toStructuredSection('Conditions particulières', note));
  }

  if (truncatedItems.length) {
    const details = truncatedItems
      .map((item) => `- Ligne ${item.index}: ${item.label}\n${item.fullDescription}`)
      .join('\n\n');
    sections.push(
      toStructuredSection(
        'Annexe — Détail lignes',
        `Certaines descriptions ont été tronquées dans le tableau principal (limite ${PDF_FIELD_LIMITS.itemDescription} caractères).\n\n${details}`
      )
    );
  }

  return sections;
}

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
      const text = paragraph.kind === 'li' ? `• ${paragraph.text}` : paragraph.text;
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
      const bullet = chunkIndex === 0 ? '• ' : '  ';
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

export async function buildBusinessDocumentPdf(payload: BuildBusinessDocumentPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const styles: DocStyles = {
    title: { font: bold, size: 20, lineHeight: 24, color: COLORS.primary },
    number: { font: bold, size: 15, lineHeight: 19, color: COLORS.primary },
    section: { font: bold, size: 11, lineHeight: 15, color: COLORS.primary },
    body: { font, size: 10, lineHeight: 13, color: COLORS.primary },
    bodyBold: { font: bold, size: 10, lineHeight: 13, color: COLORS.primary },
    muted: { font, size: 8, lineHeight: 11, color: COLORS.secondary },
    mutedBold: { font: bold, size: 8, lineHeight: 11, color: COLORS.secondary },
    small: { font, size: 9, lineHeight: 12, color: COLORS.muted },
  };

  const warnings: PdfValidationWarning[] = [];

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

  const vatEnabled = payload.vatEnabled ?? false;
  const vatRate = payload.vatRatePercent ?? 0;
  const totalCents = toBigInt(payload.totalCents);
  const vatCents = vatEnabled ? (totalCents * BigInt(Math.round(vatRate))) / BigInt(100) : BigInt(0);
  const totalTtcCents = totalCents + vatCents;
  const depositCents = toBigInt(payload.depositCents);
  const balanceCents = toBigInt(payload.balanceCents);

  const totalsRows: TotalsRow[] = [
    { label: 'Sous-total HT', value: formatAmount(totalCents, payload.currency), style: 'body' },
    ...(vatEnabled
      ? [{ label: `TVA ${vatRate}%`, value: formatAmount(vatCents, payload.currency), style: 'body' as const }]
      : []),
    { label: 'Total TTC', value: formatAmount(totalTtcCents, payload.currency), style: 'section', emphasize: true },
    ...(depositCents > BigInt(0)
      ? [{ label: 'Acompte', value: formatAmount(depositCents, payload.currency), style: 'body' as const }]
      : []),
    {
      label: payload.balanceLabel,
      value: formatAmount(balanceCents, payload.currency),
      style: payload.kind === 'INVOICE' ? 'section' : 'body',
      emphasize: payload.kind === 'INVOICE',
    },
  ];

  const issuerLegalLines = [
    ...buildAddressLines({
      addressLine1: business?.addressLine1,
      addressLine2: business?.addressLine2,
      postalCode: business?.postalCode,
      city: business?.city,
      countryCode: business?.countryCode,
    }),
    business?.siret ? `SIRET: ${business.siret}` : null,
    business?.vatNumber ? `TVA: ${business.vatNumber}` : null,
  ].filter((line): line is string => Boolean(line));

  const issuerContact = [business?.email, business?.phone, business?.websiteUrl].filter(Boolean).join(' · ');

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

  const clientReachLine = [client?.email ?? payload.clientEmail ?? null, client?.phone ?? null].filter(Boolean).join(' · ');

  const contentWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const contentHeight = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

  const legalSections = buildLegalSections(payload, business, truncatedItems, warnings);

  const headerRightLines: string[] = [
    `${payload.secondaryDateLabel ? `Date d'émission: ${formatDate(payload.issuedAt)}` : formatDate(payload.issuedAt)}`,
    `${payload.secondaryDateLabel}: ${formatDate(payload.secondaryDate)}`,
    ...(payload.extraDateLines ?? [])
      .filter((line) => line.value)
      .map((line) => `${line.label}: ${formatDate(line.value)}`),
  ];

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
          text: `Les mentions légales/CGV représentent environ ${estimatedConditionPages} pages. Pour un meilleur confort, une annexe PDF dédiée sera proposée dans une version ultérieure.`,
        },
      ],
    });
  }

  let repeatedSectionTitle: string | null = null;

  const drawPageHeader = (layout: FlowLayout) => {
    const page = layout.getPage();
    const startY = layout.getCursorY();

    const leftWidth = 290;
    const rightBlockWidth = 165;
    const rightX = PAGE_WIDTH - MARGIN_RIGHT;
    const rightBlockX = rightX - rightBlockWidth;

    let leftY = startY;
    leftY = drawWrappedAt(page, issuerName, MARGIN_LEFT, leftY, leftWidth, styles.section);
    issuerLegalLines.forEach((line) => {
      leftY = drawWrappedAt(page, line, MARGIN_LEFT, leftY, leftWidth, styles.muted);
    });
    if (issuerContact) {
      leftY = drawWrappedAt(page, issuerContact, MARGIN_LEFT, leftY, leftWidth, styles.muted);
    }

    let rightY = startY;
    page.drawText(payload.kind === 'QUOTE' ? 'DEVIS' : 'FACTURE', {
      x: rightBlockX,
      y: rightY,
      size: styles.section.size,
      font: styles.section.font,
      color: styles.section.color,
    });
    rightY -= styles.section.lineHeight;

    page.drawText(sanitizePdfText(payload.number ?? payload.documentId), {
      x: rightBlockX,
      y: rightY,
      size: styles.title.size,
      font: styles.title.font,
      color: styles.title.color,
    });
    rightY -= styles.title.lineHeight;

    headerRightLines.forEach((line) => {
      const measured = measureParagraph(line, styles.body, rightBlockWidth);
      measured.lines.forEach((wrapped) => {
        drawRightAt(page, wrapped, rightX, rightY, styles.body);
        rightY -= styles.body.lineHeight;
      });
    });

    const nextY = Math.min(leftY, rightY) - 8;
    layout.setCursorY(nextY);
    layout.drawHorizontalRule(0.8, COLORS.line, 12);

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

  const layout = new FlowLayout({
    pdfDoc,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    marginTop: MARGIN_TOP,
    marginBottom: MARGIN_BOTTOM,
    marginLeft: MARGIN_LEFT,
    marginRight: MARGIN_RIGHT,
    minLinesOnSplit: 3,
    minLinesPerPage: 6,
    onNewPage: drawPageHeader,
  });

  const drawClientBlock = () => {
    const lines = [
      clientName,
      clientContact,
      ...clientAddressLines,
      clientReachLine || null,
      client?.vatNumber ? `TVA: ${client.vatNumber}` : null,
      client?.reference ? `Référence client: ${client.reference}` : null,
    ].filter((line): line is string => Boolean(line));

    const bodyLineCount = lines
      .map((line, index) => measureParagraph(line, index === 0 ? styles.bodyBold : styles.muted, contentWidth).lines.length)
      .reduce((sum, count) => sum + count, 0);

    const blockHeight = styles.section.lineHeight + bodyLineCount * styles.body.lineHeight + 8;
    layout.ensureHeight(blockHeight, true);

    layout.drawTextLine('Client', MARGIN_LEFT, styles.section);

    lines.forEach((line, index) => {
      const style = index === 0 ? styles.bodyBold : styles.muted;
      const measured = measureParagraph(line, style, contentWidth);
      layout.drawMeasuredParagraph(measured, {
        x: MARGIN_LEFT,
        style,
        keepTogether: measured.lines.length <= 3,
      });
    });

    layout.moveDown(2);
    layout.drawHorizontalRule(0.8, COLORS.line, 10);
  };

  const drawProjectLine = () => {
    const projectName = limitSingleLine(payload.projectName, 'projectName', PDF_FIELD_LIMITS.clientName, warnings);
    if (!projectName) return;
    const measured = measureParagraph(projectName, styles.section, contentWidth);
    layout.drawMeasuredParagraph(measured, {
      x: MARGIN_LEFT,
      style: styles.section,
      keepTogether: true,
      spacingAfter: 2,
    });
    layout.drawHorizontalRule(0.8, COLORS.line, 10);
  };

  const colDescription = Math.round(contentWidth * 0.6);
  const colQty = Math.round(contentWidth * 0.1);
  const colUnitPrice = Math.round(contentWidth * 0.15);
  const colTotal = contentWidth - colDescription - colQty - colUnitPrice;

  const tableX = {
    description: MARGIN_LEFT,
    qtyRight: MARGIN_LEFT + colDescription + colQty,
    unitPriceRight: MARGIN_LEFT + colDescription + colQty + colUnitPrice,
    totalRight: MARGIN_LEFT + colDescription + colQty + colUnitPrice + colTotal,
  };

  const totalsBlockHeight =
    18 +
    totalsRows.reduce(
      (sum, row) => sum + (row.style === 'section' ? styles.section.lineHeight : styles.body.lineHeight),
      0
    );

  const signatureBlockHeight = payload.includeSignature ? 82 : 0;

  const drawTableHeader = () => {
    layout.ensureHeight(styles.muted.lineHeight + 12, true);
    const page = layout.getPage();
    const lineY = layout.getCursorY();

    page.drawText('Description', {
      x: tableX.description,
      y: lineY,
      size: styles.mutedBold.size,
      font: styles.mutedBold.font,
      color: styles.mutedBold.color,
    });

    drawRightAt(page, 'Qté', tableX.qtyRight, lineY, styles.mutedBold);
    drawRightAt(page, 'PU', tableX.unitPriceRight, lineY, styles.mutedBold);
    drawRightAt(page, 'Total', tableX.totalRight, lineY, styles.mutedBold);

    layout.moveDown(styles.mutedBold.lineHeight - 1);
    layout.drawHorizontalRule(1, COLORS.line, 8);
  };

  const drawItemsTable = () => {
    drawTableHeader();

    if (!items.length) {
      const measured = measureParagraph('Aucune ligne de facturation.', styles.muted, colDescription - 6);
      layout.drawMeasuredParagraph(measured, {
        x: tableX.description,
        style: styles.muted,
        keepTogether: true,
        spacingAfter: 4,
      });
      layout.drawHorizontalRule(0.8, COLORS.line, 8);
      return;
    }

    items.forEach((item, index) => {
      const labelMeasured = measureParagraph(item.label, styles.bodyBold, colDescription - 6);
      const descMeasured = item.description ? measureParagraph(item.description, styles.small, colDescription - 16) : null;

      const rowHeight =
        labelMeasured.height +
        (descMeasured ? descMeasured.height + 4 : 0) +
        8;

      const reserveForFinal = index === items.length - 1 ? totalsBlockHeight + signatureBlockHeight + 8 : 0;
      if (layout.getAvailableHeight() < rowHeight + reserveForFinal) {
        layout.addPage();
        drawTableHeader();
      }

      labelMeasured.lines.forEach((line, lineIndex) => {
        const lineY = layout.getCursorY();
        if (lineIndex === 0) {
          const unitLabel = resolveUnitLabel(item);
          drawRightAt(layout.getPage(), String(item.quantity), tableX.qtyRight, lineY, styles.body);
          drawRightAt(
            layout.getPage(),
            formatUnitPrice(item.unitPriceCents, payload.currency, unitLabel),
            tableX.unitPriceRight,
            lineY,
            styles.body
          );
          drawRightAt(layout.getPage(), formatAmount(item.totalCents, payload.currency), tableX.totalRight, lineY, styles.bodyBold);
        }
        layout.drawTextLine(line, tableX.description, lineIndex === 0 ? styles.bodyBold : styles.body);
      });

      if (descMeasured) {
        descMeasured.lines.forEach((line) => {
          layout.drawTextLine(line, tableX.description + 10, styles.small);
        });
      }

      layout.moveDown(3);
      layout.drawHorizontalRule(0.8, COLORS.line, 8);
    });
  };

  const drawTotalsBlock = () => {
    layout.ensureHeight(totalsBlockHeight, true);

    const labelX = PAGE_WIDTH - MARGIN_RIGHT - 220;
    const rightX = PAGE_WIDTH - MARGIN_RIGHT;

    layout.moveDown(2);
    totalsRows.forEach((row) => {
      const style = row.style === 'section' ? styles.section : styles.body;
      const lineY = layout.getCursorY();

      layout.getPage().drawText(sanitizePdfText(row.label), {
        x: labelX,
        y: lineY,
        size: style.size,
        font: style.font,
        color: row.emphasize ? COLORS.primary : COLORS.secondary,
      });

      drawRightAt(layout.getPage(), row.value, rightX, lineY, style);
      layout.moveDown(style.lineHeight + (row.style === 'section' ? 1 : 0));
    });

    layout.moveDown(2);
    layout.drawHorizontalRule(0.8, COLORS.line, 10);
  };

  const drawSignatureBlock = () => {
    if (!payload.includeSignature) return;
    layout.ensureHeight(signatureBlockHeight, true);

    layout.drawTextLine('Bon pour accord', MARGIN_LEFT, styles.section);
    layout.moveDown(4);

    const signatureY = layout.getCursorY();
    layout.getPage().drawText('Signature:', {
      x: MARGIN_LEFT,
      y: signatureY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    layout.getPage().drawLine({
      start: { x: MARGIN_LEFT + 62, y: signatureY + 2 },
      end: { x: MARGIN_LEFT + 240, y: signatureY + 2 },
      thickness: 0.8,
      color: COLORS.line,
    });

    layout.moveDown(styles.body.lineHeight + 6);

    const dateY = layout.getCursorY();
    layout.getPage().drawText('Date:', {
      x: MARGIN_LEFT,
      y: dateY,
      size: styles.body.size,
      font: styles.body.font,
      color: styles.body.color,
    });
    layout.getPage().drawLine({
      start: { x: MARGIN_LEFT + 35, y: dateY + 2 },
      end: { x: MARGIN_LEFT + 170, y: dateY + 2 },
      thickness: 0.8,
      color: COLORS.line,
    });

    layout.moveDown(styles.body.lineHeight + 4);
  };

  const drawConditions = () => {
    if (!legalSections.length) return;

    repeatedSectionTitle = 'Conditions générales';
    layout.addPage();

    legalSections.forEach((section) => {
      const firstParagraph = section.paragraphs.find((paragraph) => paragraph.kind !== 'hr' && paragraph.text.trim().length > 0);
      const firstParagraphStyle =
        firstParagraph?.kind === 'small' ? styles.small : firstParagraph?.kind === 'h3' ? styles.section : styles.body;
      const firstParagraphHeight = firstParagraph
        ? measureParagraph(firstParagraph.text, firstParagraphStyle, contentWidth).height
        : styles.body.lineHeight * 3;

      layout.ensureHeight(styles.section.lineHeight + Math.max(firstParagraphHeight, styles.body.lineHeight * 3), true);
      layout.drawTextLine(section.title, MARGIN_LEFT, styles.section);
      layout.moveDown(2);

      section.paragraphs.forEach((paragraph) => {
        renderTextParagraph(layout, paragraph, styles, contentWidth);
      });

      layout.moveDown(4);
    });

    repeatedSectionTitle = null;
  };

  drawClientBlock();
  drawProjectLine();
  drawItemsTable();
  drawTotalsBlock();
  drawSignatureBlock();
  drawConditions();

  const legalFooterLine = [business?.siret ? `SIRET ${business.siret}` : null, business?.vatNumber ? `TVA ${business.vatNumber}` : null]
    .filter((line): line is string => Boolean(line))
    .join(' · ');

  layout.finalizeFooters((page, pageIndex, pageCount) => {
    page.drawLine({
      start: { x: MARGIN_LEFT, y: FOOTER_DIVIDER_Y },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: FOOTER_DIVIDER_Y },
      thickness: 0.6,
      color: COLORS.line,
    });

    if (legalFooterLine) {
      page.drawText(sanitizePdfText(legalFooterLine), {
        x: MARGIN_LEFT,
        y: FOOTER_Y,
        size: styles.muted.size,
        font: styles.muted.font,
        color: styles.muted.color,
      });
    }

    const pageText = `Page ${pageIndex + 1}/${pageCount}`;
    drawRightAt(page, pageText, PAGE_WIDTH - MARGIN_RIGHT, FOOTER_Y, styles.muted);
  });

  if (warnings.length) {
    // Warnings are intentionally only logged server-side for observability.
    console.warn('[pdf] generation warnings', warnings);
  }

  return pdfDoc.save();
}
