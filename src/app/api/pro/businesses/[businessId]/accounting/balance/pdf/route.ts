import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { parseDateOpt } from '@/server/http/parsers';
import { buildBalancePdf } from '@/server/pdf/accountingReportPdf';

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
      include: { lines: { select: { accountCode: true, accountName: true, debitCents: true, creditCents: true } } },
    });

    const accounts = new Map<string, { accountName: string; totalDebit: bigint; totalCredit: bigint }>();
    for (const entry of entries) {
      for (const line of entry.lines) {
        let acc = accounts.get(line.accountCode);
        if (!acc) {
          acc = { accountName: line.accountName ?? line.accountCode, totalDebit: 0n, totalCredit: 0n };
          accounts.set(line.accountCode, acc);
        }
        acc.totalDebit += line.debitCents ?? 0n;
        acc.totalCredit += line.creditCents ?? 0n;
      }
    }

    let totalDebit = 0n;
    let totalCredit = 0n;
    const rows = [...accounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, acc]) => {
        totalDebit += acc.totalDebit;
        totalCredit += acc.totalCredit;
        const soldeDebiteur = acc.totalDebit > acc.totalCredit ? acc.totalDebit - acc.totalCredit : 0n;
        const soldeCrediteur = acc.totalCredit > acc.totalDebit ? acc.totalCredit - acc.totalDebit : 0n;
        return {
          accountCode: code,
          accountName: acc.accountName,
          totalDebitCents: Number(acc.totalDebit),
          totalCreditCents: Number(acc.totalCredit),
          soldeDebiteurCents: Number(soldeDebiteur),
          soldeCrediteurCents: Number(soldeCrediteur),
        };
      });

    const from = searchParams.get('from') ?? new Date().getFullYear() + '-01-01';
    const to = searchParams.get('to') ?? new Date().getFullYear() + '-12-31';

    const pdfBytes = await buildBalancePdf({
      businessName: business?.name ?? 'Business',
      from,
      to,
      rows,
      totalDebitCents: Number(totalDebit),
      totalCreditCents: Number(totalCredit),
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="balance-${from}-${to}.pdf"`,
      },
    });
  }
);
