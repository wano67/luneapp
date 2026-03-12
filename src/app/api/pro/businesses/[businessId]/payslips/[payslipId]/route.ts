import { prisma } from '@/server/db/client';
import { PayslipStatus, type Prisma } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

const VALID_STATUSES = Object.values(PayslipStatus);

const include = {
  employee: { select: { firstName: true, lastName: true, email: true } },
} as const;

// PATCH /api/pro/businesses/{businessId}/payslips/{payslipId}
export const PATCH = withBusinessRoute<{ businessId: string; payslipId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const pid = parseIdOpt(params?.payslipId);
    if (!pid) return badRequest('payslipId invalide.');

    const existing = await prisma.payslip.findFirst({
      where: { id: pid, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Fiche de paie introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if ('status' in b && VALID_STATUSES.includes(b.status as PayslipStatus)) {
      data.status = b.status;
      if (b.status === 'SENT') data.sentAt = new Date();
    }
    if ('grossCents' in b && typeof b.grossCents === 'number') data.grossCents = Math.trunc(b.grossCents);
    if ('netCents' in b && typeof b.netCents === 'number') data.netCents = Math.trunc(b.netCents);
    if ('employerChargesCents' in b && typeof b.employerChargesCents === 'number') data.employerChargesCents = Math.trunc(b.employerChargesCents);
    if ('details' in b && typeof b.details === 'object' && b.details !== null) data.details = b.details as Prisma.InputJsonValue;

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.payslip.update({
      where: { id: pid },
      data,
      include,
    });

    return jsonb({
      item: {
        id: updated.id.toString(),
        userId: updated.userId.toString(),
        period: updated.period,
        grossCents: updated.grossCents,
        netCents: updated.netCents,
        employerChargesCents: updated.employerChargesCents,
        status: updated.status,
        details: updated.details,
        sentAt: updated.sentAt?.toISOString() ?? null,
        employeeName: updated.employee ? `${updated.employee.firstName ?? ''} ${updated.employee.lastName ?? ''}`.trim() || updated.employee.email : null,
        employeeEmail: updated.employee?.email ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/payslips/{payslipId}
export const DELETE = withBusinessRoute<{ businessId: string; payslipId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const pid = parseIdOpt(params?.payslipId);
    if (!pid) return badRequest('payslipId invalide.');

    const existing = await prisma.payslip.findFirst({
      where: { id: pid, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!existing) return notFound('Fiche de paie introuvable.');

    await prisma.payslip.delete({ where: { id: pid } });
    return jsonbNoContent(ctx.requestId);
  },
);
