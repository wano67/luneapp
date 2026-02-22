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

function formatUnitPrice(value: Moneyish, currency: string, unitLabel: string | null) {
  const base = formatAmount(value, currency);
  return unitLabel ? `${base} ${unitLabel}` : base;
}

type QuotePdfItem = {
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: Moneyish;
  originalUnitPriceCents?: Moneyish | null;
  unitLabel?: string | null;
  billingUnit?: string | null;
  totalCents: Moneyish;
};

function resolveUnitLabel(item: Pick<QuotePdfItem, 'unitLabel' | 'billingUnit'>) {
  if (item.unitLabel && item.unitLabel.trim()) return item.unitLabel.trim();
  if (item.billingUnit === 'MONTHLY') return '/mois';
  return null;
}

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

type LegalSection = {
  title: string;
  text: string;
};

function splitParagraphs(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
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

function getYearLabel(value?: string | null) {
  if (!value) return new Date().getFullYear();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
}

export async function buildQuotePdf(payload: QuotePdfPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const marginX = 50;
  const topY = 790;
  const bottomY = 60;

  const colors = {
    primary: rgb(0.1, 0.1, 0.1),
    secondary: rgb(0.4, 0.4, 0.4),
    legal: rgb(0.5, 0.5, 0.5),
    line: rgb(0.86, 0.86, 0.86),
    soft: rgb(0.97, 0.96, 0.94),
  };

  const sizes = {
    docTitle: 20,
    section: 12,
    body: 10,
    small: 9,
    tiny: 8,
    itemTitle: 11,
  };

  const spacing = {
    section: 28,
    block: 24,
    row: 14,
    rowGap: 12,
    headerGap: 18,
  };

  const columns = {
    labelX: marginX,
    qtyX: 330,
    unitX: 370,
    unitPriceX: 440,
    totalX: pageWidth - marginX,
    labelWidth: 260,
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

  const drawWrappedText = (
    text: string,
    opts: {
      x: number;
      maxWidth: number;
      size: number;
      color?: typeof colors.primary;
      fontRef?: typeof font;
      lineHeight?: number;
      onNewPage?: () => void;
    }
  ) => {
    const lines = wrapText(text, opts.maxWidth, opts.fontRef ?? font, opts.size);
    const lineHeight = opts.lineHeight ?? Math.round(opts.size * 1.5);
    for (const line of lines) {
      ensureSpace(lineHeight, opts.onNewPage);
      page.drawText(sanitizePdfText(line), {
        x: opts.x,
        y,
        size: opts.size,
        font: opts.fontRef ?? font,
        color: opts.color ?? colors.primary,
      });
      y -= lineHeight;
    }
  };

  const drawDivider = () => {
    page.drawLine({
      start: { x: marginX, y },
      end: { x: pageWidth - marginX, y },
      thickness: 0.6,
      color: colors.line,
    });
    y -= 10;
  };

  const business = payload.business ?? null;
  const client = payload.client ?? null;
  const issuerLines: string[] = [];
  const legalName = business?.legalName || payload.businessName;
  if (legalName) issuerLines.push(legalName);
  if (business?.addressLine1) issuerLines.push(business.addressLine1);
  if (business?.addressLine2) issuerLines.push(business.addressLine2);
  const cityLine = [business?.postalCode, business?.city].filter(Boolean).join(' ');
  if (cityLine) issuerLines.push(cityLine);
  if (business?.countryCode) issuerLines.push(business.countryCode);
  if (business?.siret) issuerLines.push(`SIRET: ${business.siret}`);
  if (business?.vatNumber) issuerLines.push(`TVA: ${business.vatNumber}`);
  if (business?.websiteUrl) issuerLines.push(business.websiteUrl);
  if (business?.email) issuerLines.push(business.email);
  if (business?.phone) issuerLines.push(business.phone);

  const clientLines: string[] = [];
  const clientLabel = client?.companyName || client?.name || payload.clientName || '';
  if (clientLabel) clientLines.push(clientLabel);
  if (client?.companyName && client?.name && client.companyName !== client.name) {
    clientLines.push(`Contact: ${client.name}`);
  }
  const clientAddressLines: string[] = [];
  if (client?.addressLine1) clientAddressLines.push(client.addressLine1);
  if (client?.addressLine2) clientAddressLines.push(client.addressLine2);
  const clientCity = [client?.postalCode, client?.city].filter(Boolean).join(' ');
  if (clientCity) clientAddressLines.push(clientCity);
  if (client?.countryCode) clientAddressLines.push(client.countryCode);
  if (!clientAddressLines.length && client?.address) clientAddressLines.push(client.address);
  clientAddressLines.forEach((line) => clientLines.push(line));
  if (client?.email || payload.clientEmail) clientLines.push(client?.email ?? payload.clientEmail ?? '');
  if (client?.phone) clientLines.push(client.phone);
  if (client?.vatNumber) clientLines.push(`TVA: ${client.vatNumber}`);
  if (client?.reference) clientLines.push(`Réf: ${client.reference}`);

  const vatEnabled = payload.vatEnabled ?? false;
  const vatRate = payload.vatRatePercent ?? 0;
  const totalCents = toBigInt(payload.totalCents);
  const vatCents = vatEnabled ? (totalCents * BigInt(Math.round(vatRate))) / BigInt(100) : BigInt(0);
  const totalTtcCents = totalCents + vatCents;

  const drawHeader = () => {
    const year = getYearLabel(payload.issuedAt ?? payload.expiresAt);
    page.drawText(sanitizePdfText(`DEVIS ${year}`), { x: marginX, y, size: sizes.docTitle, font: bold, color: colors.primary });
    y -= sizes.docTitle + 6;
    const numberLabel = payload.number ?? payload.quoteId;
    page.drawText(sanitizePdfText(`Devis n° ${numberLabel}`), { x: marginX, y, size: sizes.section, font: bold, color: colors.primary });
    y -= sizes.section + 8;

    const headerRightX = 360;
    const metaX = 380;
    let metaY = topY;
    page.drawText('DEVIS', { x: headerRightX, y: metaY, size: sizes.section, font: bold, color: colors.primary });
    metaY -= 16;
    const metaLines = [
      payload.issuedAt ? `Créé le ${formatDate(payload.issuedAt)}` : null,
      payload.expiresAt ? `Valable jusqu'au ${formatDate(payload.expiresAt)}` : null,
      payload.currency ? `Devise: ${payload.currency}` : null,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    for (const line of metaLines) {
      page.drawText(sanitizePdfText(line), { x: metaX, y: metaY, size: sizes.tiny, font, color: colors.secondary });
      metaY -= 12;
    }

    y -= spacing.headerGap;
    page.drawText('ÉMETTEUR', { x: marginX, y, size: sizes.tiny, font: bold, color: colors.secondary });
    const issuerStartY = y - 12;
    let issuerY = issuerStartY;
    issuerLines.forEach((line) => {
      page.drawText(sanitizePdfText(line), { x: marginX, y: issuerY, size: sizes.small, font, color: colors.primary });
      issuerY -= 12;
    });

    const clientBlockX = 320;
    page.drawText('CLIENT', { x: clientBlockX, y, size: sizes.tiny, font: bold, color: colors.secondary });
    let clientY = issuerStartY;
    clientLines.forEach((line) => {
      page.drawText(sanitizePdfText(line), { x: clientBlockX, y: clientY, size: sizes.small, font, color: colors.primary });
      clientY -= 12;
    });

    y = Math.min(issuerY, clientY) - spacing.block;
  };

  const drawTableHeader = () => {
    page.drawText('Description', { x: columns.labelX, y, size: sizes.small, font: bold, color: colors.secondary });
    drawRightText('Qté', columns.qtyX, sizes.small, colors.secondary, bold);
    drawRightText('Unité', columns.unitX, sizes.small, colors.secondary, bold);
    drawRightText('PU', columns.unitPriceX, sizes.small, colors.secondary, bold);
    drawRightText('Total', columns.totalX, sizes.small, colors.secondary, bold);
    y -= 10;
    drawDivider();
  };

  const drawLineItem = (item: QuotePdfItem) => {
    const labelLines = wrapText(item.label, columns.labelWidth, bold, sizes.itemTitle);
    const descriptionLines = item.description ? wrapText(item.description, columns.labelWidth, font, sizes.small) : [];
    const unitLabel = resolveUnitLabel(item);
    const unitPriceText = formatUnitPrice(item.unitPriceCents, payload.currency, unitLabel);
    const hasOriginalPrice =
      item.originalUnitPriceCents != null && toBigInt(item.originalUnitPriceCents) > toBigInt(item.unitPriceCents);
    const originalPriceText = hasOriginalPrice
      ? formatUnitPrice(item.originalUnitPriceCents as Moneyish, payload.currency, unitLabel)
      : null;

    const rowHeight =
      (labelLines.length + descriptionLines.length) * spacing.row +
      spacing.rowGap +
      (originalPriceText ? spacing.row : 0);

    ensureSpace(rowHeight, drawTableHeader);

    labelLines.forEach((line, idx) => {
      page.drawText(sanitizePdfText(line), {
        x: columns.labelX,
        y,
        size: sizes.itemTitle,
        font: bold,
        color: colors.primary,
      });
      if (idx === 0) {
        drawRightText(String(item.quantity), columns.qtyX, sizes.body, colors.primary, font);
        drawRightText(unitLabel ?? '—', columns.unitX, sizes.small, colors.secondary, font);
        if (originalPriceText) {
          const safe = sanitizePdfText(originalPriceText);
          const priceY = y + 10;
          const width = font.widthOfTextAtSize(safe, sizes.tiny);
          page.drawText(safe, {
            x: columns.unitPriceX - width,
            y: priceY,
            size: sizes.tiny,
            font,
            color: colors.secondary,
          });
          page.drawLine({
            start: { x: columns.unitPriceX - width, y: priceY + 4 },
            end: { x: columns.unitPriceX, y: priceY + 4 },
            thickness: 0.6,
            color: colors.secondary,
          });
        }
        drawRightText(unitPriceText, columns.unitPriceX, sizes.body, colors.primary, font);
        drawRightText(formatAmount(item.totalCents, payload.currency), columns.totalX, sizes.body, colors.primary, bold);
      }
      y -= spacing.row;
    });

    descriptionLines.forEach((line) => {
      page.drawText(sanitizePdfText(line), {
        x: columns.labelX,
        y,
        size: sizes.small,
        font,
        color: colors.secondary,
      });
      y -= spacing.row;
    });

    y -= spacing.rowGap;
  };

  const drawTotalsBlock = () => {
    y -= spacing.section;
    ensureSpace(120);
    page.drawLine({ start: { x: columns.unitPriceX - 20, y }, end: { x: columns.totalX, y }, thickness: 0.8, color: colors.line });
    y -= 14;

    const drawTotalRow = (label: string, value: string, size = sizes.body, isBold = false) => {
      page.drawText(sanitizePdfText(label), {
        x: columns.unitPriceX - 20,
        y,
        size,
        font: isBold ? bold : font,
        color: colors.primary,
      });
      drawRightText(value, columns.totalX, size, colors.primary, isBold ? bold : font);
      y -= spacing.row;
    };

    drawTotalRow('Sous-total HT', formatAmount(totalCents, payload.currency));
    drawTotalRow(`TVA ${vatEnabled ? `${vatRate}%` : '—'}`, formatAmount(vatCents, payload.currency));
    drawTotalRow('Total TTC', formatAmount(totalTtcCents, payload.currency), sizes.section, true);
    y -= 8;

    const depositPercentText =
      payload.depositPercent != null && Number.isFinite(payload.depositPercent) ? `${payload.depositPercent}%` : null;
    const depositLabel = depositPercentText ? `Acompte ${depositPercentText}` : 'Acompte';
    drawTotalRow(depositLabel, formatAmount(payload.depositCents, payload.currency));
    drawTotalRow('Solde', formatAmount(payload.balanceCents, payload.currency));
  };

  const drawPaymentBlock = () => {
    const paymentLines: string[] = [];
    if (business?.accountHolder) paymentLines.push(`Titulaire: ${business.accountHolder}`);
    if (business?.bankName) paymentLines.push(`Banque: ${business.bankName}`);
    if (business?.iban) paymentLines.push(`IBAN: ${business.iban}`);
    if (business?.bic) paymentLines.push(`BIC: ${business.bic}`);
    const paymentTermsLine =
      business?.paymentTermsText?.trim() ||
      (payload.paymentTermsDays != null ? `Paiement sous ${payload.paymentTermsDays} jours.` : null);

    if (!paymentLines.length && !paymentTermsLine) return;

    y -= spacing.section;
    ensureSpace(80);
    page.drawText('Règlement', { x: marginX, y, size: sizes.section, font: bold, color: colors.primary });
    y -= 14;

    if (paymentTermsLine) {
      page.drawText(sanitizePdfText(paymentTermsLine), {
        x: marginX,
        y,
        size: sizes.small,
        font,
        color: colors.secondary,
      });
      y -= spacing.row;
    }

    paymentLines.forEach((line) => {
      page.drawText(sanitizePdfText(line), {
        x: marginX,
        y,
        size: sizes.small,
        font,
        color: colors.secondary,
      });
      y -= spacing.row;
    });
  };

  const drawDepositBlock = () => {
    y -= spacing.section;
    ensureSpace(90);
    page.drawText('Bon pour accord', { x: marginX, y, size: sizes.section, font: bold, color: colors.primary });
    y -= 16;
    page.drawText('Signature du client', { x: marginX, y, size: sizes.small, font, color: colors.secondary });
    const boxWidth = 240;
    const boxHeight = 70;
    page.drawRectangle({
      x: marginX,
      y: y - boxHeight,
      width: boxWidth,
      height: boxHeight,
      borderColor: colors.line,
      borderWidth: 0.8,
      color: rgb(1, 1, 1),
    });
    y -= boxHeight + 18;
  };

  const drawCoverPage = () => {
    drawHeader();
    drawTableHeader();
    payload.items.forEach(drawLineItem);
    drawTotalsBlock();
    drawPaymentBlock();
    drawDepositBlock();
  };

  const drawRecapPage = () => {
    page = pdfDoc.addPage([pageWidth, 842]);
    y = topY;
    pages.push(page);

    const onNewPage = () => {
      page.drawText('Récapitulatif du devis', { x: marginX, y, size: sizes.section + 4, font: bold, color: colors.primary });
      y -= spacing.block;
    };

    onNewPage();

    const labelX = marginX;
    const valueX = marginX + 140;

    const drawRow = (label: string, value: string | null) => {
      if (!value) return;
      page.drawText(sanitizePdfText(label), { x: labelX, y, size: sizes.small, font: bold, color: colors.primary });
      drawWrappedText(value, {
        x: valueX,
        maxWidth: pageWidth - valueX - marginX,
        size: sizes.small,
        color: colors.secondary,
        onNewPage,
      });
      y -= 6;
    };

    drawRow('Objet', payload.projectName ?? '—');
    drawRow('Date', payload.issuedAt ? formatDate(payload.issuedAt) : '—');
    drawRow('Client', clientLabel || payload.clientName || '—');
    drawRow('Émetteur', legalName || payload.businessName);
    drawRow('Montant total', formatAmount(totalTtcCents, payload.currency));

    const prestationsText = payload.prestationsText?.trim();
    if (prestationsText) {
      page.drawText('Détail des prestations', { x: labelX, y, size: sizes.small, font: bold, color: colors.primary });
      y -= 12;
      const paragraphs = splitParagraphs(prestationsText);
      paragraphs.forEach((paragraph) => {
        drawWrappedText(paragraph, {
          x: valueX,
          maxWidth: pageWidth - valueX - marginX,
          size: sizes.small,
          color: colors.secondary,
          onNewPage,
        });
        y -= 6;
      });
    }

    if (payload.items.length) {
      y -= 6;
      page.drawText('Prestations tarifées', { x: labelX, y, size: sizes.small, font: bold, color: colors.primary });
      y -= 12;
      const itemsText = payload.items.map((item, index) => `${index + 1}. ${item.label}`).join('\n');
      drawWrappedText(itemsText, {
        x: valueX,
        maxWidth: pageWidth - valueX - marginX,
        size: sizes.small,
        color: colors.secondary,
        onNewPage,
      });
    }
  };

  const drawConditionsPage = (text: string) => {
    page = pdfDoc.addPage([pageWidth, 842]);
    y = topY;
    pages.push(page);

    const onNewPage = () => {
      page.drawText('Conditions de collaboration', { x: marginX, y, size: sizes.section + 4, font: bold, color: colors.primary });
      y -= spacing.block;
    };

    onNewPage();

    const paragraphs = splitParagraphs(text);
    paragraphs.forEach((paragraph) => {
      drawWrappedText(paragraph, {
        x: marginX,
        maxWidth: pageWidth - marginX * 2,
        size: sizes.small,
        color: colors.secondary,
        onNewPage,
      });
      y -= 6;
    });
  };

  const drawLegalPages = (sections: LegalSection[]) => {
    if (!sections.length) return;

    const pageTitle = sections.some((section) => section.title === 'Conditions générales de vente')
      ? 'Conditions générales de vente'
      : 'Mentions légales';

    const drawLegalHeader = () => {
      page.drawText(pageTitle, { x: marginX, y, size: sizes.section + 4, font: bold, color: colors.primary });
      y -= spacing.block;
    };

    page = pdfDoc.addPage([pageWidth, 842]);
    y = topY;
    pages.push(page);
    drawLegalHeader();

    const onNewLegalPage = () => {
      drawLegalHeader();
    };

    for (const section of sections) {
      ensureSpace(40, onNewLegalPage);
      if (section.title !== pageTitle) {
        page.drawText(sanitizePdfText(section.title), {
          x: marginX,
          y,
          size: sizes.small,
          font: bold,
          color: colors.primary,
        });
        y -= 12;
      }
      const paragraphs = splitParagraphs(section.text);
      paragraphs.forEach((paragraph) => {
        drawWrappedText(paragraph, {
          x: marginX,
          maxWidth: pageWidth - marginX * 2,
          size: sizes.tiny,
          color: colors.legal,
          lineHeight: 12,
          onNewPage: onNewLegalPage,
        });
        y -= 6;
      });
      y -= 6;
    }
  };

  drawCoverPage();
  drawRecapPage();
  if (payload.note) drawConditionsPage(payload.note);
  drawLegalPages(buildLegalSections(business, payload.paymentTermsDays ?? null));

  pages.forEach((pageRef, index) => {
    pageRef.drawLine({
      start: { x: marginX, y: 32 },
      end: { x: pageWidth - marginX, y: 32 },
      thickness: 0.5,
      color: colors.line,
    });
    const pageNumber = `Page ${index + 1}/${pages.length}`;
    pageRef.drawText(sanitizePdfText(pageNumber), {
      x: pageWidth - marginX - 60,
      y: 20,
      size: sizes.tiny,
      font,
      color: colors.secondary,
    });
  });

  return pdfDoc.save();
}
