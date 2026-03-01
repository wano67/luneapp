import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type Moneyish = bigint | number | string;

type PartyDetails = {
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

type ClientDetails = {
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

const PDF_UNSAFE_SPACE = /[\u00A0\u202F]/g;

function sanitizePdfText(value: string) {
  return value.replace(PDF_UNSAFE_SPACE, ' ');
}

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

function wrapText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number
) {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function splitParagraphs(text: string) {
  const raw = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  raw.forEach((line) => {
    if (line.length <= 360) {
      paragraphs.push(line);
      return;
    }
    const sentenceParts = line.split(/(?<=[.!?;:])\s+/).map((part) => part.trim()).filter(Boolean);
    if (!sentenceParts.length) {
      paragraphs.push(line);
      return;
    }
    let current = '';
    sentenceParts.forEach((part) => {
      const next = current ? `${current} ${part}` : part;
      if (next.length > 320 && current) {
        paragraphs.push(current);
        current = part;
      } else {
        current = next;
      }
    });
    if (current) paragraphs.push(current);
  });

  return paragraphs;
}

function formatUnitPrice(value: Moneyish, currency: string, unitLabel: string | null) {
  const base = formatAmount(value, currency);
  return unitLabel ? `${base} ${unitLabel}` : base;
}

type InvoicePdfItem = {
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: Moneyish;
  originalUnitPriceCents?: Moneyish | null;
  unitLabel?: string | null;
  billingUnit?: string | null;
  totalCents: Moneyish;
};

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

type LegalSection = {
  title: string;
  text: string;
};

function resolveUnitLabel(item: Pick<InvoicePdfItem, 'unitLabel' | 'billingUnit'>) {
  if (item.unitLabel && item.unitLabel.trim()) return item.unitLabel.trim();
  if (item.billingUnit === 'MONTHLY') return '/mois';
  return null;
}

function buildLegalSections(business: PartyDetails | null | undefined, paymentTermsDays?: number | null): LegalSection[] {
  if (!business) return [];
  const sections: LegalSection[] = [];
  if (business.cgvText) sections.push({ title: 'Conditions générales de vente', text: business.cgvText });
  if (business.paymentTermsText || paymentTermsDays != null) {
    const text = business.paymentTermsText ?? `Paiement sous ${paymentTermsDays} jours.`;
    sections.push({ title: 'Conditions de paiement', text });
  }
  if (business.lateFeesText) sections.push({ title: 'Pénalités de retard', text: business.lateFeesText });
  if (business.fixedIndemnityText) sections.push({ title: 'Indemnité forfaitaire', text: business.fixedIndemnityText });
  if (business.legalMentionsText) sections.push({ title: 'Mentions légales', text: business.legalMentionsText });
  if (business.billingLegalText) sections.push({ title: 'Mentions complémentaires', text: business.billingLegalText });
  if (!sections.length && business.legalText) sections.push({ title: 'Mentions légales', text: business.legalText });
  return sections;
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

export async function buildInvoicePdf(payload: InvoicePdfPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const marginX = 50;
  const topY = 790;
  const bottomY = 56;
  const contentWidth = pageWidth - marginX * 2;

  const colors = {
    primary: rgb(0.1, 0.1, 0.1),
    secondary: rgb(0.42, 0.42, 0.42),
    line: rgb(0.86, 0.86, 0.86),
  };

  const sizes = {
    title: 22,
    number: 15,
    section: 11,
    body: 10,
    muted: 8,
  };

  const lineHeights = {
    body: 13,
    muted: 11,
    legal: 14,
  };

  const pages: ReturnType<typeof pdfDoc.addPage>[] = [];
  let page = pdfDoc.addPage([pageWidth, 842]);
  let y = topY;
  pages.push(page);

  const ensureSpace = (height: number, onNewPage?: () => void) => {
    if (y - height < bottomY) {
      page = pdfDoc.addPage([pageWidth, 842]);
      y = topY;
      pages.push(page);
      if (onNewPage) onNewPage();
    }
  };

  const drawRightText = (text: string, rightX: number, size: number, color = colors.primary, fontRef = font) => {
    const safe = sanitizePdfText(text);
    const width = fontRef.widthOfTextAtSize(safe, size);
    page.drawText(safe, { x: rightX - width, y, size, font: fontRef, color });
  };

  const drawParagraph = (
    paragraph: string,
    opts: {
      x: number;
      width: number;
      size: number;
      lineHeight: number;
      color: typeof colors.primary;
      onNewPage?: () => void;
    }
  ) => {
    const lines = wrapText(paragraph, opts.width, font, opts.size);
    const paragraphHeight = lines.length * opts.lineHeight;
    const pageBodyHeight = topY - bottomY;

    if (paragraphHeight <= pageBodyHeight) {
      ensureSpace(paragraphHeight, opts.onNewPage);
    }

    for (const line of lines) {
      ensureSpace(opts.lineHeight, opts.onNewPage);
      page.drawText(sanitizePdfText(line), {
        x: opts.x,
        y,
        size: opts.size,
        font,
        color: opts.color,
      });
      y -= opts.lineHeight;
    }
  };

  const drawDivider = (thickness = 0.8) => {
    page.drawLine({
      start: { x: marginX, y },
      end: { x: pageWidth - marginX, y },
      thickness,
      color: colors.line,
    });
    y -= 12;
  };

  const business = payload.business ?? null;
  const client = payload.client ?? null;

  const issuerName = business?.legalName || payload.businessName;
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
  ].filter((line): line is string => !!line);

  const issuerContact = [business?.email, business?.phone, business?.websiteUrl].filter(Boolean).join(' · ');

  const clientName = client?.companyName || client?.name || payload.clientName || 'Client';
  const clientContact = client?.companyName && client?.name && client.companyName !== client.name ? client.name : null;
  const clientAddressLines = buildAddressLines({
    addressLine1: client?.addressLine1,
    addressLine2: client?.addressLine2,
    postalCode: client?.postalCode,
    city: client?.city,
    countryCode: client?.countryCode,
    address: client?.address,
  });
  const clientReachLine = [client?.email ?? payload.clientEmail ?? null, client?.phone ?? null].filter(Boolean).join(' · ');

  const vatEnabled = payload.vatEnabled ?? false;
  const vatRate = payload.vatRatePercent ?? 0;
  const totalCents = toBigInt(payload.totalCents);
  const vatCents = vatEnabled ? (totalCents * BigInt(Math.round(vatRate))) / BigInt(100) : BigInt(0);
  const totalTtcCents = totalCents + vatCents;
  const depositCents = toBigInt(payload.depositCents);
  const balanceCents = toBigInt(payload.balanceCents);

  const colDescription = Math.round(contentWidth * 0.6);
  const colQty = Math.round(contentWidth * 0.1);
  const colUnitPrice = Math.round(contentWidth * 0.15);
  const colTotal = contentWidth - colDescription - colQty - colUnitPrice;

  const tableX = {
    description: marginX,
    qtyRight: marginX + colDescription + colQty,
    unitPriceRight: marginX + colDescription + colQty + colUnitPrice,
    totalRight: marginX + colDescription + colQty + colUnitPrice + colTotal,
  };

  const totalRows: Array<{ label: string; value: string; size: number; bold?: boolean }> = [
    { label: 'Sous-total HT', value: formatAmount(totalCents, payload.currency), size: sizes.body },
    ...(vatEnabled
      ? [{ label: `TVA ${vatRate}%`, value: formatAmount(vatCents, payload.currency), size: sizes.body }]
      : []),
    { label: 'Total TTC', value: formatAmount(totalTtcCents, payload.currency), size: sizes.number, bold: true },
    ...(depositCents > BigInt(0)
      ? [{ label: 'Acompte', value: formatAmount(depositCents, payload.currency), size: sizes.body }]
      : []),
    {
      label: 'Reste à régler',
      value: formatAmount(balanceCents, payload.currency),
      size: sizes.section,
      bold: true,
    },
  ];

  const totalsBlockHeight = 24 + totalRows.length * lineHeights.body;

  const drawHeader = () => {
    ensureSpace(150);

    const leftX = marginX;
    const rightX = pageWidth - marginX;
    const rightBlockX = pageWidth - 210;

    let leftY = y;
    page.drawText(sanitizePdfText(issuerName), {
      x: leftX,
      y: leftY,
      size: sizes.section + 1,
      font: bold,
      color: colors.primary,
    });
    leftY -= 16;

    issuerLegalLines.forEach((line) => {
      const wrapped = wrapText(line, 300, font, sizes.muted);
      wrapped.forEach((part) => {
        page.drawText(sanitizePdfText(part), {
          x: leftX,
          y: leftY,
          size: sizes.muted,
          font,
          color: colors.secondary,
        });
        leftY -= lineHeights.muted;
      });
    });

    if (issuerContact) {
      const wrappedContact = wrapText(issuerContact, 300, font, sizes.muted);
      wrappedContact.forEach((part) => {
        page.drawText(sanitizePdfText(part), {
          x: leftX,
          y: leftY,
          size: sizes.muted,
          font,
          color: colors.secondary,
        });
        leftY -= lineHeights.muted;
      });
    }

    let rightY = y;
    page.drawText('FACTURE', {
      x: rightBlockX,
      y: rightY,
      size: sizes.section,
      font: bold,
      color: colors.primary,
    });
    rightY -= 16;

    const numberLabel = payload.number ?? payload.invoiceId;
    page.drawText(sanitizePdfText(numberLabel), {
      x: rightBlockX,
      y: rightY,
      size: sizes.title,
      font: bold,
      color: colors.primary,
    });
    rightY -= 24;

    const rightLines = [
      `Date d'émission: ${formatDate(payload.issuedAt)}`,
      `Date d'échéance: ${formatDate(payload.dueAt)}`,
    ];

    rightLines.forEach((line) => {
      const wrapped = wrapText(line, 160, font, sizes.body);
      wrapped.forEach((part) => {
        drawRightText(part, rightX, sizes.body, colors.secondary, font);
        rightY -= lineHeights.body;
        y = rightY;
      });
    });

    y = Math.min(leftY, rightY) - 10;
    drawDivider();
  };

  const drawClientBlock = () => {
    const lines: string[] = [clientName];
    if (clientContact) lines.push(`Contact: ${clientContact}`);
    clientAddressLines.forEach((line) => lines.push(line));
    if (clientReachLine) lines.push(clientReachLine);
    if (client?.vatNumber) lines.push(`TVA: ${client.vatNumber}`);

    const lineCount = lines.reduce((count, line) => count + wrapText(line, contentWidth, font, sizes.body).length, 0);
    const blockHeight = 18 + lineCount * lineHeights.body + 6;
    ensureSpace(blockHeight);

    page.drawText('Client', {
      x: marginX,
      y,
      size: sizes.section,
      font: bold,
      color: colors.primary,
    });
    y -= 16;

    lines.forEach((line, idx) => {
      const wrapped = wrapText(line, contentWidth, font, sizes.body);
      wrapped.forEach((part) => {
        page.drawText(sanitizePdfText(part), {
          x: marginX,
          y,
          size: idx === 0 ? sizes.body : sizes.muted,
          font: idx === 0 ? bold : font,
          color: idx === 0 ? colors.primary : colors.secondary,
        });
        y -= idx === 0 ? lineHeights.body : lineHeights.muted;
      });
    });

    y -= 2;
    drawDivider();
  };

  const drawProjectLine = () => {
    if (!payload.projectName) return;
    ensureSpace(30);
    page.drawText(sanitizePdfText(payload.projectName), {
      x: marginX,
      y,
      size: sizes.section,
      font: bold,
      color: colors.primary,
    });
    y -= 16;
    drawDivider();
  };

  const drawTableHeader = () => {
    page.drawText('Description', {
      x: tableX.description,
      y,
      size: sizes.muted,
      font: bold,
      color: colors.secondary,
    });
    drawRightText('Qté', tableX.qtyRight, sizes.muted, colors.secondary, bold);
    drawRightText('PU', tableX.unitPriceRight, sizes.muted, colors.secondary, bold);
    drawRightText('Total', tableX.totalRight, sizes.muted, colors.secondary, bold);
    y -= 10;
    drawDivider(1);
  };

  const drawItemsTable = () => {
    drawTableHeader();

    payload.items.forEach((item, index) => {
      const labelLines = wrapText(item.label, colDescription - 6, bold, sizes.body);
      const descriptionLines = item.description
        ? wrapText(item.description, colDescription - 16, font, sizes.muted)
        : [];

      const rowHeight =
        labelLines.length * lineHeights.body +
        (descriptionLines.length ? 4 + descriptionLines.length * lineHeights.muted : 0) +
        10;

      const reservedForTotals = index === payload.items.length - 1 ? totalsBlockHeight + 8 : 0;
      ensureSpace(rowHeight + reservedForTotals, drawTableHeader);

      const unitLabel = resolveUnitLabel(item);
      const unitPriceText = formatUnitPrice(item.unitPriceCents, payload.currency, unitLabel);
      const totalText = formatAmount(item.totalCents, payload.currency);

      labelLines.forEach((line, lineIndex) => {
        page.drawText(sanitizePdfText(line), {
          x: tableX.description,
          y,
          size: sizes.body,
          font: lineIndex === 0 ? bold : font,
          color: colors.primary,
        });

        if (lineIndex === 0) {
          drawRightText(String(item.quantity), tableX.qtyRight, sizes.body, colors.primary, font);
          drawRightText(unitPriceText, tableX.unitPriceRight, sizes.body, colors.primary, font);
          drawRightText(totalText, tableX.totalRight, sizes.body, colors.primary, bold);
        }

        y -= lineHeights.body;
      });

      descriptionLines.forEach((line) => {
        page.drawText(sanitizePdfText(line), {
          x: tableX.description + 10,
          y,
          size: sizes.muted,
          font,
          color: colors.secondary,
        });
        y -= lineHeights.muted;
      });

      y -= 4;
      drawDivider(1);
    });
  };

  const drawTotalsBlock = () => {
    ensureSpace(totalsBlockHeight);

    const blockWidth = 220;
    const labelX = pageWidth - marginX - blockWidth;
    const valueRight = pageWidth - marginX;

    y -= 6;
    totalRows.forEach((row) => {
      page.drawText(sanitizePdfText(row.label), {
        x: labelX,
        y,
        size: row.size,
        font: row.bold ? bold : font,
        color: row.bold ? colors.primary : colors.secondary,
      });
      drawRightText(row.value, valueRight, row.size, colors.primary, row.bold ? bold : font);
      y -= row.size >= sizes.number ? lineHeights.body + 2 : lineHeights.body;
    });

    y -= 6;
    drawDivider();
  };

  const drawConditionsPages = () => {
    const sections = buildLegalSections(business, payload.paymentTermsDays ?? null);
    if (payload.note) sections.push({ title: 'Conditions particulières', text: payload.note });
    if (!sections.length) return;

    const drawConditionsHeader = () => {
      page.drawText('Conditions générales', {
        x: marginX,
        y,
        size: sizes.section + 2,
        font: bold,
        color: colors.primary,
      });
      y -= 16;
      drawDivider();
    };

    page = pdfDoc.addPage([pageWidth, 842]);
    y = topY;
    pages.push(page);
    drawConditionsHeader();

    for (const section of sections) {
      const paragraphs = splitParagraphs(section.text);
      if (!paragraphs.length) continue;

      ensureSpace(34, drawConditionsHeader);
      page.drawText(sanitizePdfText(section.title), {
        x: marginX,
        y,
        size: sizes.section,
        font: bold,
        color: colors.primary,
      });
      y -= 14;

      paragraphs.forEach((paragraph) => {
        drawParagraph(paragraph, {
          x: marginX,
          width: contentWidth,
          size: sizes.body,
          lineHeight: lineHeights.legal,
          color: colors.secondary,
          onNewPage: drawConditionsHeader,
        });
        y -= 8;
      });

      y -= 4;
    }
  };

  drawHeader();
  drawClientBlock();
  drawProjectLine();
  drawItemsTable();
  drawTotalsBlock();
  drawConditionsPages();

  pages.forEach((pageRef, index) => {
    pageRef.drawLine({
      start: { x: marginX, y: 34 },
      end: { x: pageWidth - marginX, y: 34 },
      thickness: 0.6,
      color: colors.line,
    });
    const pageNumber = `Page ${index + 1}/${pages.length}`;
    pageRef.drawText(sanitizePdfText(pageNumber), {
      x: pageWidth - marginX - 60,
      y: 20,
      size: sizes.muted,
      font,
      color: colors.secondary,
    });
  });

  return pdfDoc.save();
}
