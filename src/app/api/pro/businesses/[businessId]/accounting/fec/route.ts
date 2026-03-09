import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { JOURNAL_CODES } from '@/config/pcg';

function fecDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function fecAmount(cents: bigint | null): string {
  if (!cents || cents === 0n) return '0,00';
  const abs = cents < 0n ? -cents : cents;
  const euros = abs / 100n;
  const remainder = abs % 100n;
  return `${euros},${String(remainder).padStart(2, '0')}`;
}

// GET /api/pro/businesses/{businessId}/accounting/fec?year=2026
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear();
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return withIdNoStore(badRequest('year invalide.'), requestId);
    }

    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        businessId: businessIdBigInt,
        date: { gte: from, lt: to },
      },
      include: {
        lines: true,
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });

    // FEC header (18 columns)
    const header = [
      'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
      'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
      'PieceRef', 'PieceDate', 'EcritureLib',
      'Debit', 'Credit',
      'EcritureLet', 'DateLet', 'ValidDate',
      'Montantdevise', 'Idevise',
    ].join('\t');

    const rows: string[] = [header];

    for (const entry of entries) {
      const journalCode = entry.journalCode ?? 'OD';
      const journalLib = JOURNAL_CODES[journalCode] ?? 'Opérations diverses';
      const ecritureNum = entry.entryNumber != null ? String(entry.entryNumber) : entry.id.toString();
      const ecritureDate = fecDate(entry.date);
      const pieceRef = entry.pieceRef ?? '';
      const pieceDate = entry.pieceDate ? fecDate(entry.pieceDate) : ecritureDate;
      const validDate = entry.validDate ? fecDate(entry.validDate) : ecritureDate;
      const ecritureLib = entry.memo ?? '';

      for (const line of entry.lines) {
        const row = [
          journalCode,
          journalLib,
          ecritureNum,
          ecritureDate,
          line.accountCode,
          line.accountName ?? '',
          '', // CompAuxNum
          '', // CompAuxLib
          pieceRef,
          pieceDate,
          ecritureLib,
          fecAmount(line.debitCents),
          fecAmount(line.creditCents),
          '', // EcritureLet
          '', // DateLet
          validDate,
          '', // Montantdevise
          '', // Idevise
        ].join('\t');
        rows.push(row);
      }
    }

    const content = rows.join('\n');
    const dateStr = fecDate(new Date());
    const filename = `FEC${dateStr}.txt`;

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Request-Id': requestId,
      },
    });
  }
);
