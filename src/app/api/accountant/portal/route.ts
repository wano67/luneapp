import { prisma } from '@/server/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { hashToken } from '@/server/security/tokenHash';

// GET /api/accountant/portal?token=xxx
// Public endpoint for accountant portal — token-based auth
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { key: makeIpKey(req, 'accountant:portal'), limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token requis.' }, { status: 400 });
  }

  const access = await prisma.accountantAccess.findUnique({
    where: { token: hashToken(token) },
  });

  if (!access) {
    return NextResponse.json({ error: 'Accès introuvable.' }, { status: 404 });
  }

  if (access.revokedAt) {
    return NextResponse.json({ error: 'Accès révoqué.' }, { status: 403 });
  }

  if (access.expiresAt && access.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Accès expiré.' }, { status: 403 });
  }

  // Update last access timestamp
  await prisma.accountantAccess.update({
    where: { id: access.id },
    data: { lastAccessAt: new Date() },
  });

  const bId = access.businessId;

  // Fetch business info
  const business = await prisma.business.findUnique({
    where: { id: bId },
    select: { name: true, siret: true },
  });

  // Fetch business financial data
  const [finances, invoices, payments] = await Promise.all([
    prisma.finance.findMany({
      where: { businessId: bId, deletedAt: null },
      select: {
        id: true, type: true, category: true, amountCents: true, date: true,
        vendor: true, method: true, pieceRef: true, reconciled: true,
      },
      orderBy: { date: 'desc' },
      take: 500,
    }),
    prisma.invoice.findMany({
      where: { businessId: bId },
      select: {
        id: true, number: true, totalCents: true, status: true, issuedAt: true,
        dueAt: true, client: { select: { name: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    }),
    prisma.payment.findMany({
      where: { businessId: bId, deletedAt: null },
      select: {
        id: true, amountCents: true, paidAt: true, method: true, reference: true,
        invoice: { select: { number: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: 200,
    }),
  ]);

  return NextResponse.json({
    business: {
      name: business?.name ?? null,
      siret: business?.siret ?? null,
    },
    accessLevel: access.accessLevel,
    finances: finances.map((f) => ({
      id: f.id.toString(),
      type: f.type,
      category: f.category,
      amountCents: f.amountCents.toString(),
      date: f.date.toISOString(),
      vendor: f.vendor,
      method: f.method,
      pieceRef: f.pieceRef,
      reconciled: f.reconciled,
    })),
    invoices: invoices.map((i) => ({
      id: i.id.toString(),
      number: i.number,
      totalCents: i.totalCents.toString(),
      status: i.status,
      issuedAt: i.issuedAt?.toISOString() ?? null,
      dueAt: i.dueAt?.toISOString() ?? null,
      clientName: i.client?.name ?? null,
    })),
    payments: payments.map((p) => ({
      id: p.id.toString(),
      amountCents: p.amountCents.toString(),
      paidAt: p.paidAt.toISOString(),
      method: p.method,
      reference: p.reference,
      invoiceNumber: p.invoice.number,
    })),
  });
}
