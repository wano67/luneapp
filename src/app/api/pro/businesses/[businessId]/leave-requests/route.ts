import { prisma } from '@/server/db/client';
import { LeaveType, LeaveStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';

const VALID_TYPES = Object.values(LeaveType);

function serialize(r: {
  id: bigint; businessId: bigint; userId: bigint; type: string; status: string;
  startDate: Date; endDate: Date; days: number; reason: string | null;
  reviewedByUserId: bigint | null; reviewedAt: Date | null;
  createdAt: Date; updatedAt: Date;
  user: { name: string | null; email: string };
  reviewedBy: { name: string | null } | null;
}) {
  return {
    id: r.id.toString(),
    userId: r.userId.toString(),
    userName: r.user.name ?? r.user.email,
    type: r.type,
    status: r.status,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    days: r.days,
    reason: r.reason,
    reviewedByName: r.reviewedBy?.name ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

const include = {
  user: { select: { name: true, email: true } },
  reviewedBy: { select: { name: true } },
} as const;

// GET /api/pro/businesses/{businessId}/leave-requests
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, req) => {
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');
    const userIdFilter = url.searchParams.get('userId');

    const where: Record<string, unknown> = { businessId: ctx.businessId };
    if (statusFilter && Object.values(LeaveStatus).includes(statusFilter as LeaveStatus)) {
      where.status = statusFilter;
    }
    // Members can only see their own requests
    if (ctx.membership.role === 'MEMBER' || ctx.membership.role === 'VIEWER') {
      where.userId = ctx.userId;
    } else if (userIdFilter) {
      where.userId = BigInt(userIdFilter);
    }

    const items = await prisma.leaveRequest.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/leave-requests
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:leave:create:${ctx.businessId}:${ctx.userId}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const { type, startDate, endDate, days, reason } = body as Record<string, unknown>;

    if (!VALID_TYPES.includes(type as LeaveType)) return badRequest('type invalide.');
    if (typeof startDate !== 'string') return badRequest('startDate requis.');
    if (typeof endDate !== 'string') return badRequest('endDate requis.');
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return badRequest('Dates invalides.');
    if (end < start) return badRequest('endDate doit être après startDate.');

    const daysCount = typeof days === 'number' && days > 0 ? days : Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const item = await prisma.leaveRequest.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.userId,
        type: type as LeaveType,
        startDate: start,
        endDate: end,
        days: daysCount,
        reason: typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null,
      },
      include,
    });

    return jsonbCreated({ item: serialize(item) }, ctx.requestId);
  },
);
