import { prisma } from '@/server/db/client';
import { CalendarEventKind } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, forbidden } from '@/server/http/apiUtils';

function parseEventId(url: string): bigint | null {
  const seg = url.split('/').at(-1);
  if (!seg || !/^\d+$/.test(seg)) return null;
  return BigInt(seg);
}

// PATCH /api/pro/businesses/{businessId}/calendar/events/{eventId}
export const PATCH = withBusinessRoute(
  { minRole: 'MEMBER' },
  async (ctx, req) => {
    const eventId = parseEventId(req.url);
    if (!eventId) return badRequest('eventId invalide.');

    const existing = await prisma.calendarEvent.findFirst({
      where: { id: eventId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Événement introuvable.');

    // Only creator or admin can edit
    const isCreator = existing.userId === ctx.userId;
    const isAdmin = ctx.membership.role === 'OWNER' || ctx.membership.role === 'ADMIN';
    if (!isCreator && !isAdmin) return forbidden('Seul le créateur ou un admin peut modifier.');

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if ('title' in body && typeof body.title === 'string') {
      const t = body.title.trim();
      if (t.length === 0 || t.length > 200) return badRequest('title: 1-200 caractères.');
      data.title = t;
    }
    if ('kind' in body) {
      if (body.kind !== 'APPOINTMENT' && body.kind !== 'REMINDER') return badRequest('kind invalide.');
      data.kind = body.kind as CalendarEventKind;
    }
    if ('description' in body) data.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    if ('startAt' in body && typeof body.startAt === 'string') {
      const d = new Date(body.startAt);
      if (isNaN(d.getTime())) return badRequest('startAt invalide.');
      data.startAt = d;
    }
    if ('endAt' in body) {
      if (body.endAt === null) { data.endAt = null; }
      else if (typeof body.endAt === 'string') {
        const d = new Date(body.endAt);
        if (isNaN(d.getTime())) return badRequest('endAt invalide.');
        data.endAt = d;
      }
    }
    if ('allDay' in body) data.allDay = body.allDay === true;
    if ('location' in body) data.location = typeof body.location === 'string' ? body.location.trim() || null : null;
    if ('clientId' in body) data.clientId = body.clientId && /^\d+$/.test(String(body.clientId)) ? BigInt(body.clientId) : null;
    if ('projectId' in body) data.projectId = body.projectId && /^\d+$/.test(String(body.projectId)) ? BigInt(body.projectId) : null;
    if ('remindAt' in body) {
      if (body.remindAt === null) { data.remindAt = null; }
      else if (typeof body.remindAt === 'string') {
        const d = new Date(body.remindAt);
        if (isNaN(d.getTime())) return badRequest('remindAt invalide.');
        data.remindAt = d;
      }
    }

    const updated = await prisma.calendarEvent.update({
      where: { id: eventId },
      data,
    });

    return jsonb({
      item: {
        id: updated.id.toString(),
        kind: updated.kind,
        title: updated.title,
        description: updated.description,
        startAt: updated.startAt.toISOString(),
        endAt: updated.endAt?.toISOString() ?? null,
        allDay: updated.allDay,
        location: updated.location,
        clientId: updated.clientId?.toString() ?? null,
        projectId: updated.projectId?.toString() ?? null,
        remindAt: updated.remindAt?.toISOString() ?? null,
      },
    }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/calendar/events/{eventId}
export const DELETE = withBusinessRoute(
  { minRole: 'MEMBER' },
  async (ctx, req) => {
    const eventId = parseEventId(req.url);
    if (!eventId) return badRequest('eventId invalide.');

    const existing = await prisma.calendarEvent.findFirst({
      where: { id: eventId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Événement introuvable.');

    const isCreator = existing.userId === ctx.userId;
    const isAdmin = ctx.membership.role === 'OWNER' || ctx.membership.role === 'ADMIN';
    if (!isCreator && !isAdmin) return forbidden('Seul le créateur ou un admin peut supprimer.');

    await prisma.calendarEvent.delete({ where: { id: eventId } });

    return jsonbNoContent(ctx.requestId);
  },
);
