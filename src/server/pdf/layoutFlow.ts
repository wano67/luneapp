import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from 'pdf-lib';

export type LayoutTextStyle = {
  font: PDFFont;
  size: number;
  lineHeight: number;
  color: RGB;
};

export type MeasuredParagraph = {
  lines: string[];
  height: number;
};

type FlowLayoutOptions = {
  pdfDoc: PDFDocument;
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  minLinesOnSplit?: number;
  minLinesPerPage?: number;
  onNewPage?: (layout: FlowLayout) => void;
};

type PageMeta = {
  page: PDFPage;
  lineCount: number;
};

/**
 * WinAnsi (Windows-1252) character set used by pdf-lib StandardFonts.
 * Characters outside this set cause "WinAnsi cannot encode" errors.
 * We replace common Unicode symbols with ASCII equivalents and strip the rest.
 */
const UNICODE_REPLACEMENTS: [RegExp, string][] = [
  [/[\u00A0\u202F\u2007\u200B\u200C\u200D\uFEFF]/g, ' '], // special spaces & zero-width
  [/[\u2018\u2019\u201A]/g, "'"],  // smart single quotes
  [/[\u201C\u201D\u201E]/g, '"'],  // smart double quotes
  [/[\u2013\u2014]/g, '-'],        // en dash, em dash
  [/\u2026/g, '...'],              // ellipsis
  [/\u2190/g, '<-'],               // ←
  [/\u2192/g, '->'],               // →
  [/\u2194/g, '<->'],              // ↔
  [/[\u2191\u2193]/g, '|'],        // ↑ ↓
  [/[\u2022\u2023\u25E6]/g, '-'],  // bullets
  [/\u20AC/g, 'EUR'],              // € (not in WinAnsi base but ok to be safe)
  [/[\u2122]/g, 'TM'],             // ™
  [/[\u00A9]/g, '(c)'],            // ©
  [/[\u00AE]/g, '(R)'],            // ®
  [/\u2264/g, '<='],               // ≤
  [/\u2265/g, '>='],               // ≥
  [/\u2260/g, '!='],               // ≠
  [/[\u2713\u2714]/g, 'v'],        // ✓ ✔
  [/[\u2717\u2718]/g, 'x'],        // ✗ ✘
  [/[\u2605\u2606]/g, '*'],        // ★ ☆
];

// WinAnsi supports: 0x20-0x7E (ASCII printable), plus specific 0x80-0xFF code points.
// Rather than enumerate all 256 valid code points, we strip anything above 0xFF
// that wasn't already replaced, plus the handful of undefined slots in 0x80-0x9F.
const NON_WINANSI = /[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]|[\x80\x81\x8D\x8F\x90\x9D]/g;

export function sanitizePdfText(value: string) {
  let result = value;
  for (const [pattern, replacement] of UNICODE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(NON_WINANSI, '');
}

export function wrapTextToLines(
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

export function measureParagraph(
  text: string,
  style: Pick<LayoutTextStyle, 'font' | 'size' | 'lineHeight'>,
  width: number
): MeasuredParagraph {
  const lines = wrapTextToLines(text, width, style.font, style.size);
  return { lines, height: lines.length * style.lineHeight };
}

export class FlowLayout {
  private readonly pdfDoc: PDFDocument;
  private readonly pageWidth: number;
  private readonly pageHeight: number;
  private readonly marginTop: number;
  private readonly marginBottom: number;
  private readonly marginLeft: number;
  private readonly marginRight: number;
  private readonly minLinesOnSplit: number;
  private readonly minLinesPerPage: number;
  private readonly onNewPage?: (layout: FlowLayout) => void;

  private pages: PageMeta[] = [];
  private pageIndex = 0;
  private cursorY = 0;

  constructor(options: FlowLayoutOptions) {
    this.pdfDoc = options.pdfDoc;
    this.pageWidth = options.pageWidth;
    this.pageHeight = options.pageHeight;
    this.marginTop = options.marginTop;
    this.marginBottom = options.marginBottom;
    this.marginLeft = options.marginLeft;
    this.marginRight = options.marginRight;
    this.minLinesOnSplit = options.minLinesOnSplit ?? 3;
    this.minLinesPerPage = options.minLinesPerPage ?? 6;
    this.onNewPage = options.onNewPage;

    this.addPage();
  }

  getPage() {
    return this.pages[this.pageIndex].page;
  }

  getCursorY() {
    return this.cursorY;
  }

  setCursorY(value: number) {
    this.cursorY = value;
  }

  getMarginLeft() {
    return this.marginLeft;
  }

  getMarginRight() {
    return this.marginRight;
  }

  getPageWidth() {
    return this.pageWidth;
  }

  getPageHeight() {
    return this.pageHeight;
  }

  getContentBottomY() {
    return this.marginBottom;
  }

  getContentWidth() {
    return this.pageWidth - this.marginLeft - this.marginRight;
  }

  getPages() {
    return this.pages.map((meta) => meta.page);
  }

  getPageCount() {
    return this.pages.length;
  }

  getCurrentPageLineCount() {
    return this.pages[this.pageIndex].lineCount;
  }

  getAvailableHeight() {
    return this.cursorY - this.marginBottom;
  }

  getAvailableLines(lineHeight: number) {
    return Math.floor(this.getAvailableHeight() / lineHeight);
  }

  getMinLinesPerPage() {
    return this.minLinesPerPage;
  }

  moveDown(height: number) {
    this.cursorY -= height;
  }

  addPage() {
    const page = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    this.pages.push({ page, lineCount: 0 });
    this.pageIndex = this.pages.length - 1;
    this.cursorY = this.pageHeight - this.marginTop;
    if (this.onNewPage) this.onNewPage(this);
  }

  ensureHeight(height: number, keepTogether = false) {
    if (keepTogether && this.getAvailableHeight() < height) {
      this.addPage();
      return;
    }
    if (this.getAvailableHeight() < height) {
      this.addPage();
    }
  }

  ensureLines(minLines: number, lineHeight: number) {
    if (this.getAvailableLines(lineHeight) < minLines) {
      this.addPage();
    }
  }

  drawTextLine(text: string, x: number, style: LayoutTextStyle) {
    if (this.getAvailableHeight() < style.lineHeight) {
      this.addPage();
    }
    this.getPage().drawText(sanitizePdfText(text), {
      x,
      y: this.cursorY,
      size: style.size,
      font: style.font,
      color: style.color,
    });
    this.cursorY -= style.lineHeight;
    this.pages[this.pageIndex].lineCount += 1;
  }

  drawRightTextLine(text: string, rightX: number, style: LayoutTextStyle) {
    if (this.getAvailableHeight() < style.lineHeight) {
      this.addPage();
    }
    const safe = sanitizePdfText(text);
    const width = style.font.widthOfTextAtSize(safe, style.size);
    this.getPage().drawText(safe, {
      x: rightX - width,
      y: this.cursorY,
      size: style.size,
      font: style.font,
      color: style.color,
    });
    this.cursorY -= style.lineHeight;
    this.pages[this.pageIndex].lineCount += 1;
  }

  drawHorizontalRule(thickness = 0.8, color = rgb(0.86, 0.86, 0.86), gapAfter = 12) {
    this.getPage().drawLine({
      start: { x: this.marginLeft, y: this.cursorY },
      end: { x: this.pageWidth - this.marginRight, y: this.cursorY },
      thickness,
      color,
    });
    this.cursorY -= gapAfter;
  }

  drawMeasuredParagraph(
    measured: MeasuredParagraph,
    opts: {
      x: number;
      style: LayoutTextStyle;
      keepTogether?: boolean;
      spacingAfter?: number;
    }
  ) {
    if (!measured.lines.length) return;

    const pageBodyHeight = this.pageHeight - this.marginTop - this.marginBottom;
    const paragraphHeight = measured.height;

    if (opts.keepTogether && paragraphHeight <= pageBodyHeight && this.getAvailableHeight() < paragraphHeight) {
      this.addPage();
    }

    let remaining = [...measured.lines];
    while (remaining.length) {
      const availableLines = this.getAvailableLines(opts.style.lineHeight);
      if (availableLines <= 0) {
        this.addPage();
        continue;
      }

      if (remaining.length <= availableLines) {
        remaining.forEach((line) => this.drawTextLine(line, opts.x, opts.style));
        remaining = [];
        break;
      }

      if (availableLines < this.minLinesOnSplit) {
        this.addPage();
        continue;
      }

      let linesToDraw = availableLines;
      const minRemainder = Math.max(this.minLinesOnSplit, this.minLinesPerPage);
      const orphanRemainder = remaining.length - linesToDraw;
      if (orphanRemainder > 0 && orphanRemainder < minRemainder) {
        linesToDraw = remaining.length - minRemainder;
      }

      if (linesToDraw < this.minLinesOnSplit) {
        this.addPage();
        continue;
      }

      remaining.slice(0, linesToDraw).forEach((line) => this.drawTextLine(line, opts.x, opts.style));
      remaining = remaining.slice(linesToDraw);
      this.addPage();
    }

    if (opts.spacingAfter) {
      this.cursorY -= opts.spacingAfter;
    }
  }

  finalizeFooters(drawFooter: (page: PDFPage, pageIndex: number, pageCount: number) => void) {
    const pageCount = this.pages.length;
    this.pages.forEach((meta, index) => {
      drawFooter(meta.page, index, pageCount);
    });
  }

  hasLowContentPage() {
    return this.pages.some((meta) => meta.lineCount > 0 && meta.lineCount < this.minLinesPerPage);
  }
}
