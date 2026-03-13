import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { parseDateOpt } from '@/server/http/parsers';
import { buildGrandLivrePdf } from '@/server/pdf/accountingReportPdf';

export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, request) => {
    const { businessId: businessIdBigInt } = ctx;
    const { searchParams } = new URL(request.url);

    const fromDate = parseDateOpt(searchParams.get('from'));
    const toDate = parseDateOpt(searchParams.get('to'));

    const business = await prisma.business.findUnique({
      where: { id: businessIdBigInt },
      select: { name: true },
    });

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        businessId: businessIdBigInt,
        ...(fromDate || toDate
          ? {
              date: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      include: {
        lines: {
          select: { accountCode: true, accountName: true, debitCents: true, creditCents: true },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { date: 'asc' },
    });

    const accountMap = new Map<
      string,
      {
        accountName: string;
        totalDebit: bigint;
        totalCredit: bigint;
        lines: Array<{
          date: string;
          journalCode: string | null;
          pieceRef: string | null;
          memo: string | null;
          debitCents: number;
          creditCents: number;
        }>;
      }
    >();

    for (const entry of entries) {
      for (const line of entry.lines) {
        let acc = accountMap.get(line.accountCode);
        if (!acc) {
          acc = {
            accountName: line.accountName ?? line.accountCode,
            totalDebit: 0n,
            totalCredit: 0n,
            lines: [],
          };
          accountMap.set(line.accountCode, acc);
        }
        acc.totalDebit += line.debitCents ?? 0n;
        acc.totalCredit += line.creditCents ?? 0n;
        acc.lines.push({
          date: entry.date.toISOString(),
          journalCode: entry.journalCode,
          pieceRef: entry.pieceRef,
          memo: entry.memo,
          debitCents: Number(line.debitCents ?? 0n),
          creditCents: Number(line.creditCents ?? 0n),
        });
      }
    }

    const accounts = [...accountMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, acc]) => ({
        accountCode: code,
        accountName: acc.accountName,
        totalDebitCents: Number(acc.totalDebit),
        totalCreditCents: Number(acc.totalCredit),
        lines: acc.lines,
      }));

    const from = searchParams.get('from') ?? new Date().getFullYear() + '-01-01';
    const to = searchParams.get('to') ?? new Date().getFullYear() + '-12-31';

    const pdfBytes = await buildGrandLivrePdf({
      businessName: business?.name ?? 'Business',
      from,
      to,
      accounts,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="grand-livre-${from}-${to}.pdf"`,
      },
    });
  }
);
