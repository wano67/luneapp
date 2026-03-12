import { prisma } from '@/server/db/client';
import { EmailSequenceStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

const VALID_STATUSES = Object.values(EmailSequenceStatus);

// PATCH /api/pro/businesses/{businessId}/email-sequences/{sequenceId}
export const PATCH = withBusinessRoute<{ businessId: string; sequenceId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:emailseq:update:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const seqId = parseIdOpt(params?.sequenceId);
    if (!seqId) return badRequest('sequenceId invalide.');

    const existing = await prisma.emailSequence.findFirst({
      where: { id: seqId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Séquence introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if ('name' in b && typeof b.name === 'string') data.name = b.name.trim().slice(0, 200);
    if ('subject' in b && typeof b.subject === 'string') data.subject = b.subject.trim().slice(0, 200);
    if ('body' in b && typeof b.body === 'string') data.body = b.body.trim();
    if ('delayDays' in b && typeof b.delayDays === 'number') data.delayDays = Math.max(0, Math.trunc(b.delayDays));
    if ('status' in b && VALID_STATUSES.includes(b.status as EmailSequenceStatus)) data.status = b.status;

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.emailSequence.update({
      where: { id: seqId },
      data,
      include: { _count: { select: { sends: true } } },
    });

    return jsonb({
      item: {
        id: updated.id.toString(),
        name: updated.name,
        subject: updated.subject,
        body: updated.body,
        delayDays: updated.delayDays,
        position: updated.position,
        status: updated.status,
        sendCount: updated._count?.sends ?? 0,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/email-sequences/{sequenceId}
export const DELETE = withBusinessRoute<{ businessId: string; sequenceId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const seqId = parseIdOpt(params?.sequenceId);
    if (!seqId) return badRequest('sequenceId invalide.');

    const existing = await prisma.emailSequence.findFirst({
      where: { id: seqId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!existing) return notFound('Séquence introuvable.');

    await prisma.emailSequence.delete({ where: { id: seqId } });
    return jsonbNoContent(ctx.requestId);
  },
);
