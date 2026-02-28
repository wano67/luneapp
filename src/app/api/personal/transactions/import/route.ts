import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';

type ParsedRow = {
  rowNumber: number;
  dateIso: string;
  label: string;
  amountCents: string;
  currency: string;
  note: string | null;
  categoryName: string | null;
};

type ParsedValid = ParsedRow & {
  type: 'INCOME' | 'EXPENSE';
};

type RowError = { row: number; reason: string; data?: unknown };

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function sanitizeCategoryLabel(name: string) {
  return name.trim().slice(0, 80);
}

function normalizeCategoryName(name: string) {
  return sanitizeCategoryLabel(name).toLowerCase();
}

function sanitizeLabel(raw: unknown) {
  const label = String(raw ?? '').trim();
  if (label.length > 160) {
    return {
      value: label,
      error: { reason: 'LABEL_TOO_LONG', data: { labelLen: label.length } as const },
    } as const;
  }
  return { value: label } as const;
}

function sanitizeNote(raw: unknown) {
  if (raw === null || raw === undefined) return { value: null as string | null } as const;
  const note = String(raw).trim();
  if (!note) return { value: null as string | null } as const;
  if (note.length > 2000) {
    return {
      value: null as string | null,
      error: { reason: 'NOTE_TOO_LONG', data: { noteLen: note.length } as const },
    } as const;
  }
  return { value: note } as const;
}

function sanitizeCurrency(raw: unknown, fallback: string) {
  const base = typeof fallback === 'string' && fallback.trim() ? fallback.trim() : 'EUR';
  const candidate =
    typeof raw === 'string'
      ? raw.trim()
      : raw === null || raw === undefined
      ? ''
      : String(raw).trim();
  const value = (candidate || base).toUpperCase();
  if (value.length > 8) {
    return {
      value,
      error: { reason: 'CURRENCY_TOO_LONG', data: { currencyLen: value.length } as const },
    } as const;
  }
  return { value } as const;
}

function parseCSV(content: string, delimiter: ',' | ';' | '\t') {
  const rows: string[][] = [];
  let cur = '';
  let inQuotes = false;
  const row: string[] = [];

  function pushCell() {
    row.push(cur);
    cur = '';
  }

  function pushRow() {
    if (row.length === 1 && row[0].trim() === '') return;
    rows.push([...row]);
    row.length = 0;
  }

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (ch === '"') {
      const next = content[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      pushCell();
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      pushCell();
      pushRow();
      continue;
    }

    cur += ch;
  }

  pushCell();
  pushRow();

  return rows;
}

function guessDelimiter(text: string): ',' | ';' | '\t' {
  const firstLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);

  const sample = firstLines.join('\n');
  const commas = (sample.match(/,/g) || []).length;
  const semis = (sample.match(/;/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;

  if (tabs > semis && tabs > commas) return '\t';
  return semis > commas ? ';' : ',';
}

function toISODate(input: string) {
  const s = input.trim();
  if (!s) return '';

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1];
    const mm = m[2];
    const yyyy = m[3];
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function centsFromAmount(amount: string) {
  const raw = amount.trim().replace(/\s/g, '').replace(',', '.');
  if (!raw) return '';
  if (!/^-?\d+(\.\d{0,2})?$/.test(raw)) return '';

  const neg = raw.startsWith('-');
  const [intRaw, decRaw = ''] = raw.replace('-', '').split('.');
  const intPart = intRaw || '0';
  const decPart = (decRaw + '00').slice(0, 2);

  const hundred = BigInt(100);
  const cents = BigInt(intPart) * hundred + BigInt(decPart);
  return (neg ? -cents : cents).toString();
}

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:tx:import:${ctx.userId}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const form = await req.formData();
  const file = form.get('file');
  const accountId = String(form.get('accountId') ?? '').trim();
  const dryRun = String(form.get('dryRun') ?? 'false') === 'true';

  if (!file || typeof file === 'string') return badRequest('Missing file');

  const fileSize = typeof (file as { size?: unknown }).size === 'number' ? (file as { size: number }).size : null;
  if (fileSize !== null && fileSize > 2 * 1024 * 1024) return badRequest('File too large (max 2MB)');

  const mime = typeof (file as { type?: unknown }).type === 'string'
    ? ((file as { type: string }).type.toLowerCase?.() ?? (file as { type: string }).type.toLowerCase())
    : undefined;
  if (mime && mime !== 'text/csv' && mime !== 'application/vnd.ms-excel') {
    return badRequest('Invalid file type');
  }

  if (!accountId || !/^\d+$/.test(accountId)) return badRequest('Missing or invalid accountId');

  // ensure account belongs to user
  const acc = await prisma.personalAccount.findFirst({
    where: { id: BigInt(accountId), userId: ctx.userId },
    select: { id: true, currency: true },
  });
  if (!acc) return notFound('Account not found');

  const text = await file.text();
  const delimiter = guessDelimiter(text);
  const table = parseCSV(text, delimiter);

  if (table.length < 2) return badRequest('CSV seems empty');
  if (table.length - 1 > 5000) return badRequest('Too many rows (max 5000)');

  const headers = table[0].map((h) => normalizeHeader(h));
  const idx = (name: string) => headers.indexOf(name);

  const iDate = idx('date');
  const iLabel = idx('label');
  const iAmount = idx('amount');
  const iCurrency = idx('currency');
  const iNote = idx('note');
  const iCategory = idx('category');

  if (iDate === -1 || iLabel === -1 || iAmount === -1) {
    return badRequest('Invalid headers. Required: date,label,amount. Optional: currency,note,category.');
  }

  const parsed: ParsedRow[] = [];
  const errors: RowError[] = [];

  for (let r = 1; r < table.length; r++) {
    const row = table[r];

    const dateIso = toISODate(String(row[iDate] ?? ''));
    const labelResult = sanitizeLabel(row[iLabel]);
    if (labelResult.error) {
      errors.push({ row: r + 1, reason: labelResult.error.reason, data: labelResult.error.data });
      continue;
    }
    const label = labelResult.value;
    const amountCents = centsFromAmount(String(row[iAmount] ?? ''));

    const noteResult = sanitizeNote(iNote !== -1 ? row[iNote] : null);
    if (noteResult.error) {
      errors.push({ row: r + 1, reason: noteResult.error.reason, data: noteResult.error.data });
      continue;
    }
    const note = noteResult.value;

    const currencyResult = sanitizeCurrency(iCurrency !== -1 ? row[iCurrency] : acc.currency, acc.currency);
    if (currencyResult.error) {
      errors.push({
        row: r + 1,
        reason: currencyResult.error.reason,
        data: currencyResult.error.data,
      });
      continue;
    }
    const currency = currencyResult.value;
    const rawCategory = iCategory !== -1 ? String(row[iCategory] ?? '') : '';
    const categoryName = rawCategory ? sanitizeCategoryLabel(rawCategory) || null : null;

    if (!dateIso || !label || !amountCents) {
      errors.push({
        row: r + 1,
        reason: 'Missing/invalid date, label or amount',
        data: { date: row[iDate], label: row[iLabel], amount: row[iAmount] },
      });
      continue;
    }

    parsed.push({ rowNumber: r + 1, dateIso, label, amountCents, currency, note, categoryName });
  }

  if (dryRun) {
    return jsonb(
      {
        delimiter,
        totalRows: table.length - 1,
        validRows: parsed.length,
        invalidRows: errors.length,
        errors: errors.slice(0, 25),
        preview: parsed.slice(0, 10),
      },
      ctx.requestId
    );
  }

  const parsedWithType: ParsedValid[] = [];
  for (const p of parsed) {
    const amount = BigInt(p.amountCents);
    if (amount === 0n) {
      errors.push({ row: p.rowNumber, reason: 'Zero amount not allowed' });
      continue;
    }
    const type: ParsedValid['type'] = amount < 0n ? 'EXPENSE' : 'INCOME';
    parsedWithType.push({ ...p, type, amountCents: amount.toString() });
  }

  // categories (unique per user)
  const catKeyToLabel = new Map<string, string>();
  for (const p of parsedWithType) {
    if (!p.categoryName) continue;
    const label = sanitizeCategoryLabel(p.categoryName);
    if (!label) continue;
    const key = normalizeCategoryName(label);
    if (!catKeyToLabel.has(key)) catKeyToLabel.set(key, label);
  }

  const uniqueCatKeys = Array.from(catKeyToLabel.keys());
  const catMap = new Map<string, bigint>();

  if (uniqueCatKeys.length) {
    const orFilters = uniqueCatKeys.map((key) => {
      const label = catKeyToLabel.get(key) ?? key;
      return { name: { equals: label, mode: 'insensitive' as const } };
    });

    const existing = await prisma.personalCategory.findMany({
      where: { userId: ctx.userId, OR: orFilters },
      select: { id: true, name: true },
    });
    existing.forEach((c) => catMap.set(normalizeCategoryName(c.name), c.id));

    const missing = uniqueCatKeys.filter((k) => !catMap.has(k));
    for (const key of missing) {
      const label = catKeyToLabel.get(key) ?? key;
      const created = await prisma.personalCategory.create({
        data: { userId: ctx.userId, name: label },
        select: { id: true, name: true },
      });
      catMap.set(normalizeCategoryName(created.name), created.id);
    }
  }

  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let sumPos = 0n;
  let sumNegAbs = 0n;

  const txData = [];

  for (const p of parsedWithType) {
    const d = new Date(p.dateIso);
    if (!Number.isNaN(d.getTime())) {
      if (minDate === null || d < minDate) minDate = d;
      if (maxDate === null || d > maxDate) maxDate = d;
    }

    const amt = BigInt(p.amountCents);
    if (amt > 0n) sumPos += amt;
    if (amt < 0n) sumNegAbs += -amt;

    const catKey = p.categoryName ? normalizeCategoryName(p.categoryName) : null;

    txData.push({
      userId: ctx.userId,
      accountId: BigInt(accountId),
      categoryId: catKey ? catMap.get(catKey) ?? null : null,
      type: p.type,
      date: d,
      amountCents: amt,
      currency: p.currency || acc.currency,
      label: p.label,
      note: p.note,
    });
  }

  const CHUNK = 1000;
  let createdCount = 0;

  for (let i = 0; i < txData.length; i += CHUNK) {
    const chunk = txData.slice(i, i + CHUNK);
    const r = await prisma.personalTransaction.createMany({ data: chunk });
    createdCount += r.count;
  }

  return jsonb(
    {
      imported: createdCount,
      invalidRows: errors.length,
      errors: errors.slice(0, 25),
      summary: {
        accountId,
        fromDateIso: minDate ? minDate.toISOString() : null,
        toDateIso: maxDate ? maxDate.toISOString() : null,
        incomeCents: sumPos,
        expenseAbsCents: sumNegAbs,
      },
    },
    ctx.requestId
  );
});
