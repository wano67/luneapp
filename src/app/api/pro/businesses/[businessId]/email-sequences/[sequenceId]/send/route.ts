import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

// POST /api/pro/businesses/{businessId}/email-sequences/{sequenceId}/send
// Enqueue emails to clients/prospects
export const POST = withBusinessRoute<{ businessId: string; sequenceId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:emailseq:send:${ctx.businessId}:${ctx.userId}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const seqId = parseIdOpt(params?.sequenceId);
    if (!seqId) return badRequest('sequenceId invalide.');

    const sequence = await prisma.emailSequence.findFirst({
      where: { id: seqId, businessId: ctx.businessId, status: 'ACTIVE' },
    });
    if (!sequence) return notFound('Séquence introuvable ou inactive.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const { target, clientIds, prospectIds } = body as Record<string, unknown>;

    const recipients: Array<{ email: string; name: string | null; clientId: bigint | null; prospectId: bigint | null }> = [];

    if (target === 'all_clients' || (Array.isArray(clientIds) && clientIds.length > 0)) {
      const where: Record<string, unknown> = { businessId: ctx.businessId };
      if (Array.isArray(clientIds) && clientIds.length > 0) {
        where.id = { in: clientIds.map((id) => BigInt(id as string)) };
      }
      const clients = await prisma.client.findMany({
        where,
        select: { id: true, email: true, name: true },
      });
      for (const c of clients) {
        if (c.email) recipients.push({ email: c.email, name: c.name, clientId: c.id, prospectId: null });
      }
    }

    if (target === 'all_prospects' || (Array.isArray(prospectIds) && prospectIds.length > 0)) {
      const where: Record<string, unknown> = { businessId: ctx.businessId };
      if (Array.isArray(prospectIds) && prospectIds.length > 0) {
        where.id = { in: prospectIds.map((id) => BigInt(id as string)) };
      }
      const prospects = await prisma.prospect.findMany({
        where,
        select: { id: true, contactEmail: true, contactName: true },
      });
      for (const p of prospects) {
        if (p.contactEmail) recipients.push({ email: p.contactEmail, name: p.contactName, clientId: null, prospectId: p.id });
      }
    }

    if (recipients.length === 0) return badRequest('Aucun destinataire avec email valide.');

    const scheduledAt = new Date(Date.now() + sequence.delayDays * 24 * 60 * 60 * 1000);

    const sends = await prisma.emailSequenceSend.createMany({
      data: recipients.map((r) => ({
        sequenceId: seqId,
        businessId: ctx.businessId,
        recipientEmail: r.email,
        recipientName: r.name,
        clientId: r.clientId,
        prospectId: r.prospectId,
        scheduledAt,
      })),
    });

    return jsonb({ queued: sends.count, scheduledAt: scheduledAt.toISOString() }, ctx.requestId);
  },
);
