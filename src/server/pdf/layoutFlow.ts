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

const PDF_UNSAFE_SPACE = /[\u00A0\u202F]/g;

export function sanitizePdfText(value: string) {
  return value.replace(PDF_UNSAFE_SPACE, ' ');
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
