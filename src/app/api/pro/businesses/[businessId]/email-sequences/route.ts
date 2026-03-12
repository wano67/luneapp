import { prisma } from '@/server/db/client';
import { EmailSequenceStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';

function serialize(s: {
  id: bigint; businessId: bigint; name: string; subject: string; body: string;
  delayDays: number; position: number; status: string;
  createdAt: Date; updatedAt: Date;
  _count?: { sends: number };
}) {
  return {
    id: s.id.toString(),
    name: s.name,
    subject: s.subject,
    body: s.body,
    delayDays: s.delayDays,
    position: s.position,
    status: s.status,
    sendCount: s._count?.sends ?? 0,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// GET /api/pro/businesses/{businessId}/email-sequences
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const items = await prisma.emailSequence.findMany({
      where: { businessId: ctx.businessId },
      include: { _count: { select: { sends: true } } },
      orderBy: { position: 'asc' },
    });
    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/email-sequences
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:emailseq:create:${ctx.businessId}:${ctx.userId}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const { name, subject, body: emailBody, delayDays, status } = body as Record<string, unknown>;

    if (typeof name !== 'string' || !name.trim()) return badRequest('name requis.');
    if (typeof subject !== 'string' || !subject.trim()) return badRequest('subject requis.');
    if (typeof emailBody !== 'string' || !emailBody.trim()) return badRequest('body requis.');

    // Get next position
    const lastSeq = await prisma.emailSequence.findFirst({
      where: { businessId: ctx.businessId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const item = await prisma.emailSequence.create({
      data: {
        businessId: ctx.businessId,
        name: name.trim().slice(0, 200),
        subject: subject.trim().slice(0, 200),
        body: emailBody.trim(),
        delayDays: typeof delayDays === 'number' ? Math.max(0, Math.trunc(delayDays)) : 0,
        position: (lastSeq?.position ?? -1) + 1,
        status: status === 'PAUSED' ? 'PAUSED' as EmailSequenceStatus : 'ACTIVE' as EmailSequenceStatus,
      },
      include: { _count: { select: { sends: true } } },
    });

    return jsonbCreated({ item: serialize(item) }, ctx.requestId);
  },
);
