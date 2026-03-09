import { prisma } from '@/server/db/client';
import { CalendarEventKind } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';

function parseEventId(url: string): bigint | null {
  const seg = url.split('/').at(-1);
  if (!seg || !/^\d+$/.test(seg)) return null;
  return BigInt(seg);
}

// PATCH /api/personal/calendar/events/{eventId}
export const PATCH = withPersonalRoute(async (ctx, req) => {
  const eventId = parseEventId(req.url);
  if (!eventId) return badRequest('eventId invalide.');

  const existing = await prisma.personalCalendarEvent.findFirst({
    where: { id: eventId, userId: ctx.userId },
  });
  if (!existing) return notFound('Événement introuvable.');

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
  if ('remindAt' in body) {
    if (body.remindAt === null) { data.remindAt = null; }
    else if (typeof body.remindAt === 'string') {
      const d = new Date(body.remindAt);
      if (isNaN(d.getTime())) return badRequest('remindAt invalide.');
      data.remindAt = d;
    }
  }

  const updated = await prisma.personalCalendarEvent.update({
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
      remindAt: updated.remindAt?.toISOString() ?? null,
    },
  }, ctx.requestId);
});

// DELETE /api/personal/calendar/events/{eventId}
export const DELETE = withPersonalRoute(async (ctx, req) => {
  const eventId = parseEventId(req.url);
  if (!eventId) return badRequest('eventId invalide.');

  const existing = await prisma.personalCalendarEvent.findFirst({
    where: { id: eventId, userId: ctx.userId },
  });
  if (!existing) return notFound('Événement introuvable.');

  await prisma.personalCalendarEvent.delete({ where: { id: eventId } });

  return jsonbNoContent(ctx.requestId);
});
