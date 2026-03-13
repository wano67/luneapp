import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import icalGenerator from 'ical-generator';
import { CalendarEventKind } from '@/generated/prisma';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';

type TokenInfo = {
  userId: bigint;
  businessId: bigint | null;
  scope: 'pro' | 'personal';
};

async function resolveToken(token: string): Promise<TokenInfo | null> {
  const bt = await prisma.calendarToken.findUnique({
    where: { token },
    select: { userId: true, businessId: true, revokedAt: true },
  });
  if (bt && !bt.revokedAt) return { userId: bt.userId, businessId: bt.businessId, scope: 'pro' };

  const pt = await prisma.personalCalendarToken.findUnique({
    where: { token },
    select: { userId: true, revokedAt: true },
  });
  if (pt && !pt.revokedAt) return { userId: pt.userId, businessId: null, scope: 'personal' };

  return null;
}

function xmlResponse(status: number, body: string): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      DAV: '1, calendar-access',
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Route handler — all HTTP methods
// ──────────────────────────────────────────────────────────────────────────────

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; path: string[] }> },
) {
  const limited = rateLimit(req, {
    key: makeIpKey(req, 'caldav'),
    limit: 300,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { token, path } = await params;
  const info = await resolveToken(token);
  if (!info) return new NextResponse('Token invalide.', { status: 401 });

  // Use X-HTTP-Method-Override for PROPFIND/REPORT (rewritten by middleware)
  const method = req.headers.get('X-HTTP-Method-Override')?.toUpperCase() ?? req.method.toUpperCase();
  const joined = path.join('/');

  switch (method) {
    case 'OPTIONS':
      return new NextResponse(null, {
        status: 200,
        headers: { Allow: 'OPTIONS, GET, PUT, DELETE, PROPFIND, REPORT', DAV: '1, calendar-access' },
      });

    case 'PROPFIND':
      return handlePropfind(token, joined);

    case 'REPORT':
      return handleReport(info);

    case 'GET':
      return handleGet(info, joined);

    case 'PUT':
      return handlePut(info, joined, await req.text());

    case 'DELETE':
      return handleDelete(info, joined);

    case 'POST': {
      // Some CalDAV clients send REPORT as POST
      const bodyText = await req.text();
      if (bodyText.includes('calendar-multiget') || bodyText.includes('calendar-query')) {
        return handleReport(info);
      }
      return new NextResponse('Méthode non supportée.', { status: 405 });
    }

    default:
      return new NextResponse('Méthode non supportée.', { status: 405 });
  }
}

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
export const POST = handler;
export const OPTIONS = handler;

// ──────────────────────────────────────────────────────────────────────────────
// PROPFIND — calendar properties
// ──────────────────────────────────────────────────────────────────────────────

function handlePropfind(token: string, _path: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">
  <D:response>
    <D:href>/api/caldav/${token}/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/><C:calendar/></D:resourcetype>
        <D:displayname>Lune</D:displayname>
        <C:supported-calendar-component-set>
          <C:comp name="VEVENT"/>
        </C:supported-calendar-component-set>
        <CS:getctag>${Date.now()}</CS:getctag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;
  return xmlResponse(207, xml);
}

// ──────────────────────────────────────────────────────────────────────────────
// REPORT — calendar-query / calendar-multiget
// ──────────────────────────────────────────────────────────────────────────────

async function handleReport(info: TokenInfo): Promise<NextResponse> {
  const events = await getAllEvents(info);
  const responses = events
    .map((ev) => {
      const ics = singleEventToIcs(ev);
      return `<D:response>
  <D:href>/api/caldav/${ev.uid}.ics</D:href>
  <D:propstat>
    <D:prop>
      <D:getetag>"${ev.etag}"</D:getetag>
      <C:calendar-data>${escapeXml(ics)}</C:calendar-data>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
${responses}
</D:multistatus>`;
  return xmlResponse(207, xml);
}

// ──────────────────────────────────────────────────────────────────────────────
// GET — single event .ics or full calendar
// ──────────────────────────────────────────────────────────────────────────────

async function handleGet(info: TokenInfo, path: string): Promise<NextResponse> {
  // If path ends with .ics → single event
  if (path.endsWith('.ics')) {
    const uid = path.replace(/\.ics$/, '');
    const events = await getAllEvents(info);
    const ev = events.find((e) => e.uid === uid);
    if (!ev) return new NextResponse('Événement introuvable.', { status: 404 });
    const ics = singleEventToIcs(ev);
    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        ETag: `"${ev.etag}"`,
      },
    });
  }

  // Full calendar
  const events = await getAllEvents(info);
  const cal = icalGenerator({ name: 'Lune', timezone: 'Europe/Paris' });
  for (const ev of events) {
    cal.createEvent({
      id: ev.uid,
      summary: ev.summary,
      description: ev.description ?? undefined,
      location: ev.location ?? undefined,
      start: ev.start,
      end: ev.end ?? undefined,
      allDay: ev.allDay,
    });
  }

  return new NextResponse(cal.toString(), {
    status: 200,
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// PUT — create or update event from .ics
// ──────────────────────────────────────────────────────────────────────────────

async function handlePut(info: TokenInfo, path: string, icsData: string): Promise<NextResponse> {
  // Simple ICS parser — extract VEVENT properties
  const veventMatch = icsData.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
  if (!veventMatch) return new NextResponse('No VEVENT found.', { status: 400 });

  const vevent = veventMatch[0];
  const prop = (name: string): string | null => {
    const re = new RegExp(`^${name}[;:](.*)$`, 'm');
    const m = vevent.match(re);
    return m ? m[1].trim() : null;
  };

  const uid = prop('UID') ?? path.replace(/\.ics$/, '');
  const title = prop('SUMMARY') ?? 'Sans titre';
  const description = prop('DESCRIPTION') ?? null;
  const location = prop('LOCATION') ?? null;

  const dtstart = prop('DTSTART');
  const dtend = prop('DTEND');
  const start = dtstart ? parseIcsDate(dtstart) : new Date();
  const end = dtend ? parseIcsDate(dtend) : null;

  // All-day events use DATE format (8 digits), timed events use DATETIME (15+ chars)
  const allDay = dtstart ? !dtstart.includes('T') && /^\d{8}$/.test(dtstart.replace(/^VALUE=DATE:/, '')) : false;

  if (info.scope === 'pro' && info.businessId) {
    // Check if existing event with this icalUid — scoped to this business
    const existing = await prisma.calendarEvent.findUnique({ where: { icalUid: uid } });
    if (existing && existing.businessId === info.businessId) {
      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: { title, description, location, startAt: start, endAt: end, allDay },
      });
    } else if (!existing) {
      await prisma.calendarEvent.create({
        data: {
          businessId: info.businessId,
          userId: info.userId,
          kind: CalendarEventKind.APPOINTMENT,
          title,
          description,
          location,
          startAt: start,
          endAt: end,
          allDay,
          icalUid: uid,
        },
      });
    }
  } else {
    // Personal — scoped to this user
    const existing = await prisma.personalCalendarEvent.findUnique({ where: { icalUid: uid } });
    if (existing && existing.userId === info.userId) {
      await prisma.personalCalendarEvent.update({
        where: { id: existing.id },
        data: { title, description, location, startAt: start, endAt: end, allDay },
      });
    } else if (!existing) {
      await prisma.personalCalendarEvent.create({
        data: {
          userId: info.userId,
          kind: CalendarEventKind.APPOINTMENT,
          title,
          description,
          location,
          startAt: start,
          endAt: end,
          allDay,
          icalUid: uid,
        },
      });
    }
  }

  return new NextResponse(null, { status: 201, headers: { ETag: `"${Date.now()}"` } });
}

// ──────────────────────────────────────────────────────────────────────────────
// DELETE — remove event by icalUid
// ──────────────────────────────────────────────────────────────────────────────

async function handleDelete(info: TokenInfo, path: string): Promise<NextResponse> {
  const uid = path.replace(/\.ics$/, '');

  if (info.scope === 'pro' && info.businessId) {
    const ev = await prisma.calendarEvent.findUnique({ where: { icalUid: uid } });
    if (ev && ev.businessId === info.businessId) {
      await prisma.calendarEvent.delete({ where: { id: ev.id } });
    }
  } else {
    const ev = await prisma.personalCalendarEvent.findUnique({ where: { icalUid: uid } });
    if (ev && ev.userId === info.userId) {
      await prisma.personalCalendarEvent.delete({ where: { id: ev.id } });
    }
  }

  return new NextResponse(null, { status: 204 });
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

type EventDto = {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  allDay: boolean;
  etag: string;
};

async function getAllEvents(info: TokenInfo): Promise<EventDto[]> {
  const events: EventDto[] = [];

  if (info.scope === 'pro' && info.businessId) {
    const calEvents = await prisma.calendarEvent.findMany({
      where: { businessId: info.businessId },
      select: { id: true, icalUid: true, title: true, description: true, location: true, startAt: true, endAt: true, allDay: true, updatedAt: true },
    });
    for (const ce of calEvents) {
      events.push({
        uid: ce.icalUid ?? `event-${ce.id}@lune.app`,
        summary: ce.title,
        description: ce.description,
        location: ce.location,
        start: ce.startAt,
        end: ce.endAt,
        allDay: ce.allDay,
        etag: ce.updatedAt.getTime().toString(),
      });
    }

    const tasks = await prisma.task.findMany({
      where: { businessId: info.businessId, dueDate: { not: null }, status: { not: 'DONE' } },
      select: { id: true, title: true, dueDate: true, updatedAt: true },
    });
    for (const t of tasks) {
      if (!t.dueDate) continue;
      events.push({
        uid: `task-${t.id}@lune.app`,
        summary: `[Tâche] ${t.title}`,
        description: null,
        location: null,
        start: t.dueDate,
        end: null,
        allDay: true,
        etag: t.updatedAt.getTime().toString(),
      });
    }
  } else {
    const calEvents = await prisma.personalCalendarEvent.findMany({
      where: { userId: info.userId },
      select: { id: true, icalUid: true, title: true, description: true, location: true, startAt: true, endAt: true, allDay: true, updatedAt: true },
    });
    for (const ce of calEvents) {
      events.push({
        uid: ce.icalUid ?? `personal-event-${ce.id}@lune.app`,
        summary: ce.title,
        description: ce.description,
        location: ce.location,
        start: ce.startAt,
        end: ce.endAt,
        allDay: ce.allDay,
        etag: ce.updatedAt.getTime().toString(),
      });
    }
  }

  return events;
}

function singleEventToIcs(ev: EventDto): string {
  const cal = icalGenerator({ name: 'Lune', timezone: 'Europe/Paris' });
  cal.createEvent({
    id: ev.uid,
    summary: ev.summary,
    description: ev.description ?? undefined,
    location: ev.location ?? undefined,
    start: ev.start,
    end: ev.end ?? undefined,
    allDay: ev.allDay,
  });
  return cal.toString();
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Parse iCal date string: 20260315 (DATE) or 20260315T140000Z (DATETIME) */
function parseIcsDate(raw: string): Date {
  // Strip VALUE=DATE: or VALUE=DATE-TIME: prefixes
  const clean = raw.replace(/^VALUE=DATE(-TIME)?:/, '').replace(/^TZID=[^:]+:/, '');
  if (/^\d{8}$/.test(clean)) {
    // DATE format: YYYYMMDD
    return new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00`);
  }
  if (/^\d{8}T\d{6}Z?$/.test(clean)) {
    // DATETIME format: YYYYMMDDTHHMMSS(Z)
    const d = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;
    return clean.endsWith('Z') ? new Date(d + 'Z') : new Date(d);
  }
  // Fallback: try native parsing
  return new Date(clean);
}
