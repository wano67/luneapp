import { prisma } from '@/server/db/client';
import { type Prisma } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

function serialize(p: {
  id: bigint; businessId: bigint; userId: bigint; period: string;
  grossCents: number; netCents: number; employerChargesCents: number;
  status: string; details: unknown; sentAt: Date | null;
  createdAt: Date; updatedAt: Date;
  employee?: { firstName: string | null; lastName: string | null; email: string } | null;
}) {
  return {
    id: p.id.toString(),
    userId: p.userId.toString(),
    period: p.period,
    grossCents: p.grossCents,
    netCents: p.netCents,
    employerChargesCents: p.employerChargesCents,
    status: p.status,
    details: p.details,
    sentAt: p.sentAt?.toISOString() ?? null,
    employeeName: p.employee ? `${p.employee.firstName ?? ''} ${p.employee.lastName ?? ''}`.trim() || p.employee.email : null,
    employeeEmail: p.employee?.email ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

const include = {
  employee: { select: { firstName: true, lastName: true, email: true } },
} as const;

// GET /api/pro/businesses/{businessId}/payslips
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'ADMIN' },
  async (ctx) => {
    const items = await prisma.payslip.findMany({
      where: { businessId: ctx.businessId },
      include,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/payslips
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:payslips:create:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const { userId, period, grossCents, netCents, employerChargesCents, details } = body as Record<string, unknown>;

    const uid = parseIdOpt(userId as string);
    if (!uid) return badRequest('userId requis.');

    // Verify user is a member of this business
    const membership = await prisma.businessMembership.findFirst({
      where: { businessId: ctx.businessId, userId: uid },
      select: { id: true },
    });
    if (!membership) return badRequest('Employé introuvable dans l\'équipe.');

    if (typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period)) return badRequest('period requis (YYYY-MM).');
    if (typeof grossCents !== 'number' || grossCents < 0) return badRequest('grossCents requis (>= 0).');
    if (typeof netCents !== 'number' || netCents < 0) return badRequest('netCents requis (>= 0).');
    if (typeof employerChargesCents !== 'number' || employerChargesCents < 0) return badRequest('employerChargesCents requis (>= 0).');

    // Check unique constraint
    const existing = await prisma.payslip.findUnique({
      where: { businessId_userId_period: { businessId: ctx.businessId, userId: uid, period } },
    });
    if (existing) return badRequest('Une fiche de paie existe déjà pour cet employé et cette période.');

    const item = await prisma.payslip.create({
      data: {
        businessId: ctx.businessId,
        userId: uid,
        period,
        grossCents: Math.trunc(grossCents),
        netCents: Math.trunc(netCents),
        employerChargesCents: Math.trunc(employerChargesCents),
        details: (details && typeof details === 'object' ? details : {}) as Prisma.InputJsonValue,
      },
      include,
    });

    return jsonbCreated({ item: serialize(item) }, ctx.requestId);
  },
);
