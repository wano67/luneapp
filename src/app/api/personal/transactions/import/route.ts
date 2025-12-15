import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';

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

type RowError = { row: number; reason: string; data?: any };

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function parseCSV(content: string, delimiter: ',' | ';' | '\t') {
  // Minimal CSV parser with quotes support
  const rows: string[][] = [];
  let cur = '';
  let inQuotes = false;
  const row: string[] = [];

  function pushCell() {
    row.push(cur);
    cur = '';
  }

  function pushRow() {
    // avoid pushing empty trailing line
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

  // Support: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO date-time
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
  // amount like "12,34" or "-12.34"
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

export async function POST(req: NextRequest) {
  try {
    const csrf = assertSameOrigin(req);
    if (csrf) return csrf;

    const { userId } = await requireAuthAsync(req);

    const form = await req.formData();
    const file = form.get('file');
    const accountId = String(form.get('accountId') ?? '').trim();
    const dryRun = String(form.get('dryRun') ?? 'false') === 'true';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (typeof (file as any).size === 'number' && (file as any).size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 });
    }
    const mime = (file as any).type?.toLowerCase?.() as string | undefined;
    if (mime && mime !== 'text/csv' && mime !== 'application/vnd.ms-excel') {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    if (!accountId || !/^\d+$/.test(accountId)) {
      return NextResponse.json({ error: 'Missing or invalid accountId' }, { status: 400 });
    }

    // ensure account belongs to user
    const acc = await prisma.personalAccount.findFirst({
      where: { id: BigInt(accountId), userId: BigInt(userId) },
      select: { id: true, currency: true },
    });
    if (!acc) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const text = await file.text();
    const delimiter = guessDelimiter(text);
    const table = parseCSV(text, delimiter);

    if (table.length < 2) {
      return NextResponse.json({ error: 'CSV seems empty' }, { status: 400 });
    }
    if (table.length - 1 > 5000) {
      return NextResponse.json({ error: 'Too many rows (max 5000)' }, { status: 400 });
    }

    const headers = table[0].map((h) => normalizeHeader(h));
    const idx = (name: string) => headers.indexOf(name);

    // Required: date,label,amount. Optional: currency,note,category
    const iDate = idx('date');
    const iLabel = idx('label');
    const iAmount = idx('amount');
    const iCurrency = idx('currency');
    const iNote = idx('note');
    const iCategory = idx('category');

    if (iDate === -1 || iLabel === -1 || iAmount === -1) {
      return NextResponse.json(
        {
          error: 'Invalid headers. Required: date,label,amount. Optional: currency,note,category.',
          got: table[0],
          delimiter,
        },
        { status: 400 }
      );
    }

    const parsed: ParsedRow[] = [];
    const errors: RowError[] = [];

    for (let r = 1; r < table.length; r++) {
      const row = table[r];

      const dateIso = toISODate(String(row[iDate] ?? ''));
      const label = String(row[iLabel] ?? '').trim();
      const amountCents = centsFromAmount(String(row[iAmount] ?? ''));

      const currency = String((iCurrency !== -1 ? row[iCurrency] : acc.currency) ?? acc.currency)
        .trim()
        .toUpperCase();

      const note = iNote !== -1 ? String(row[iNote] ?? '').trim() || null : null;
      const categoryName = iCategory !== -1 ? String(row[iCategory] ?? '').trim() || null : null;

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
      return jsonNoStore({
        delimiter,
        totalRows: table.length - 1,
        validRows: parsed.length,
        invalidRows: errors.length,
        errors: errors.slice(0, 25),
        preview: parsed.slice(0, 10),
      });
    }

    const parsedWithType: ParsedValid[] = [];
    for (const p of parsed) {
      const amount = BigInt(p.amountCents);
      if (amount === BigInt(0)) {
        errors.push({ row: p.rowNumber, reason: 'Zero amount not allowed' });
        continue;
      }
      const type: ParsedValid['type'] = amount < BigInt(0) ? 'EXPENSE' : 'INCOME';
      parsedWithType.push({ ...p, type, amountCents: amount.toString() });
    }

    // categories (unique per user)
    const uniqueCats = Array.from(
      new Set(parsedWithType.map((p) => p.categoryName).filter(Boolean) as string[])
    );

    const catMap = new Map<string, bigint>();

    if (uniqueCats.length) {
      const existing = await prisma.personalCategory.findMany({
        where: { userId: BigInt(userId), name: { in: uniqueCats } },
        select: { id: true, name: true },
      });
      existing.forEach((c) => catMap.set(c.name, c.id));

      const missing = uniqueCats.filter((n) => !catMap.has(n));
      for (const name of missing) {
        const created = await prisma.personalCategory.create({
          data: { userId: BigInt(userId), name },
          select: { id: true, name: true },
        });
        catMap.set(created.name, created.id);
      }
    }

    // ---- stats + build data (done in clear loops => no TS "never")
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    let sumPos = BigInt(0);
    let sumNegAbs = BigInt(0);

    const txData = [];

    for (const p of parsedWithType) {
      const d = new Date(p.dateIso);
      if (!Number.isNaN(d.getTime())) {
        if (minDate === null || d < minDate) minDate = d;
        if (maxDate === null || d > maxDate) maxDate = d;
      }

      const amt = BigInt(p.amountCents);
      if (amt > BigInt(0)) sumPos += amt;
      if (amt < BigInt(0)) sumNegAbs += -amt;

      txData.push({
        userId: BigInt(userId),
        accountId: BigInt(accountId),
        categoryId: p.categoryName ? catMap.get(p.categoryName) ?? null : null,
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

    return jsonNoStore({
      imported: createdCount,
      invalidRows: errors.length,
      errors: errors.slice(0, 25),
      summary: {
        accountId: accountId, // already string
        fromDateIso: minDate ? minDate.toISOString() : null,
        toDateIso: maxDate ? maxDate.toISOString() : null,
        incomeCents: sumPos.toString(),
        expenseAbsCents: sumNegAbs.toString(),
      },
    });
  } catch (e: any) {
    if (String(e?.message) === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
