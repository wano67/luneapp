export type ParagraphKind = 'p' | 'h3' | 'ul' | 'ol' | 'li' | 'hr' | 'small';

export type TextParagraph = {
  kind: ParagraphKind;
  text: string;
};

export type TextSection = {
  title: string;
  paragraphs: TextParagraph[];
};

export function splitParagraphs(text: string) {
  const hardWrap = (value: string) => {
    const words = value.split(/\s+/).filter(Boolean);
    if (!words.length) return [] as string[];
    const chunks: string[] = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > 320 && current) {
        chunks.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);
    return chunks;
  };

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
      hardWrap(line).forEach((chunk) => paragraphs.push(chunk));
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
    if (current) {
      hardWrap(current).forEach((chunk) => paragraphs.push(chunk));
    }
  });

  return paragraphs;
}

export function parseMarkdownSubset(input: string): TextParagraph[] {
  const paragraphs: TextParagraph[] = [];
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (!currentParagraph.length) return;
    const text = currentParagraph.join(' ').trim();
    if (text) paragraphs.push({ kind: 'p', text });
    currentParagraph = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      return;
    }

    if (/^---+$/.test(line)) {
      flushParagraph();
      paragraphs.push({ kind: 'hr', text: '' });
      return;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      paragraphs.push({ kind: 'h3', text: line.slice(3).trim() });
      return;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      paragraphs.push({ kind: 'h3', text: line.slice(2).trim() });
      return;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      paragraphs.push({ kind: 'li', text: line.slice(2).trim() });
      return;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      paragraphs.push({ kind: 'li', text: line.replace(/^\d+\.\s+/, '').trim() });
      return;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      paragraphs.push({ kind: 'small', text: line.slice(2).trim() });
      return;
    }

    currentParagraph.push(line);
  });

  flushParagraph();

  return paragraphs;
}
