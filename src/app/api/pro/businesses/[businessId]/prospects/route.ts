import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma';
import {
  LeadSource,
  ProspectPipelineStatus,
  QualificationLevel,
  ProspectStatus,
} from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { parseDateOpt, parseStr } from '@/server/http/parsers';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, isRecord, withIdNoStore } from '@/server/http/apiUtils';
import { ensureDelegate } from '@/server/http/delegates';

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function sanitizePhone(s: string) {
  return (parseStr(s) ?? '').replace(/\s+/g, ' ');
}

function isValidPhone(s: string) {
  if (!s) return false;
  if (!/^[\d+\-().\s]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

const VALID_PIPELINE_STATUS = new Set<ProspectPipelineStatus>([
  'NEW',
  'IN_DISCUSSION',
  'OFFER_SENT',
  'FOLLOW_UP',
  'CLOSED',
]);

// GET /api/pro/businesses/{businessId}/prospects
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt } = ctx;

  const delegateError = ensureDelegate('prospect', requestId);
  if (delegateError) return delegateError;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('q')?.trim() ?? searchParams.get('search')?.trim();
  const pipelineStatusParam = searchParams.get('pipelineStatus') as ProspectPipelineStatus | null;
  const statusParam = searchParams.get('status') as ProspectStatus | null;
  const probabilityMin = parseInt(searchParams.get('probabilityMin') ?? '', 10);
  const nextActionBefore = parseDateOpt(searchParams.get('nextActionBefore'));

  const where: Prisma.ProspectWhereInput = { businessId: businessIdBigInt };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { contactName: { contains: search, mode: 'insensitive' } },
      { contactEmail: { contains: search, mode: 'insensitive' } },
      { contactPhone: { contains: search, mode: 'insensitive' } },
      { projectIdea: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (pipelineStatusParam && VALID_PIPELINE_STATUS.has(pipelineStatusParam)) {
    where.pipelineStatus = pipelineStatusParam;
  }

  if (statusParam && Object.values(ProspectStatus).includes(statusParam)) {
    where.status = statusParam;
  }

  if (!Number.isNaN(probabilityMin) && probabilityMin >= 0 && probabilityMin <= 100) {
    where.probability = { gte: probabilityMin };
  }

  if (nextActionBefore) {
    where.nextActionDate = { lte: nextActionBefore };
  }

  const prospects = await prisma.prospect.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return jsonb({ items: prospects }, requestId);
});

// POST /api/pro/businesses/{businessId}/prospects
export const POST = withBusinessRoute(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `pro:prospects:create:${ctx.businessId}:${ctx.userId}`, limit: 120, windowMs: 60 * 60 * 1000 } },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const delegateError = ensureDelegate('prospect', requestId);
    if (delegateError) return delegateError;

    const body = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.name !== 'string') {
      return withIdNoStore(badRequest('Le nom du prospect est requis.'), requestId);
    }

    const name = parseStr(body.name) ?? '';
    if (!name) {
      return withIdNoStore(badRequest('Le nom du prospect ne peut pas être vide.'), requestId);
    }
    if (name.length > 120) {
      return withIdNoStore(badRequest('Le nom du prospect est trop long (max 120).'), requestId);
    }

    const contactNameRaw = parseStr(
      typeof body.contactName === 'string' ? body.contactName : ''
    ) ?? '';
    if (contactNameRaw && contactNameRaw.length > 120) {
      return withIdNoStore(badRequest('Le nom du contact est trop long (max 120).'), requestId);
    }

    const contactEmailRaw = parseStr(
      typeof body.contactEmail === 'string' ? body.contactEmail : ''
    ) ?? '';
    if (contactEmailRaw && (contactEmailRaw.length > 254 || !isValidEmail(contactEmailRaw))) {
      return withIdNoStore(badRequest('Email du contact invalide.'), requestId);
    }

    const contactPhoneRaw = sanitizePhone(
      typeof body.contactPhone === 'string' ? body.contactPhone : ''
    );
    if (contactPhoneRaw && (contactPhoneRaw.length > 32 || !isValidPhone(contactPhoneRaw))) {
      return withIdNoStore(badRequest('Téléphone du contact invalide.'), requestId);
    }

    const interestNoteRaw = parseStr(
      typeof body.interestNote === 'string' ? body.interestNote : ''
    ) ?? '';
    if (interestNoteRaw && interestNoteRaw.length > 2000) {
      return withIdNoStore(badRequest("Note d'intérêt trop longue (max 2000)."), requestId);
    }

    const projectIdeaRaw = parseStr(typeof body.projectIdea === 'string' ? body.projectIdea : '') ?? '';
    if (projectIdeaRaw && projectIdeaRaw.length > 2000) {
      return withIdNoStore(badRequest('Idée de projet trop longue (max 2000).'), requestId);
    }

    const origin = parseStr(body.origin) ?? '';
    const title = parseStr(typeof body.title === 'string' ? body.title : '') ?? '';
    if (title && title.length > 120) {
      return withIdNoStore(badRequest('Titre trop long (max 120).'), requestId);
    }

    let probability: number | undefined;
    if ('probability' in body) {
      const raw = (body as { probability?: unknown }).probability;
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return withIdNoStore(badRequest('Probabilité invalide.'), requestId);
      }
      probability = Math.min(100, Math.max(0, Math.trunc(raw)));
    }

    let nextActionDate: Date | null | undefined;
    if ('nextActionDate' in body) {
      const raw = (body as { nextActionDate?: unknown }).nextActionDate;
      if (raw === null || raw === undefined || raw === '') {
        nextActionDate = null;
      } else if (typeof raw === 'string') {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          return withIdNoStore(badRequest('Prochaine action invalide.'), requestId);
        }
        nextActionDate = parsed;
      } else {
        return withIdNoStore(badRequest('Prochaine action invalide.'), requestId);
      }
    }

    const data: Prisma.ProspectCreateInput = {
      business: { connect: { id: businessIdBigInt } },
      name,
      title: title || null,
      contactName: contactNameRaw || null,
      contactEmail: contactEmailRaw || null,
      contactPhone: contactPhoneRaw || null,
      interestNote: interestNoteRaw || null,
      projectIdea: projectIdeaRaw || null,
      origin: origin || null,
    };
    if (probability !== undefined) data.probability = probability;
    if (nextActionDate !== undefined) data.nextActionDate = nextActionDate;

    if (typeof body.estimatedBudget === 'number') {
      if (!Number.isFinite(body.estimatedBudget) || body.estimatedBudget < 0) {
        return withIdNoStore(badRequest('Budget estimé invalide.'), requestId);
      }
      data.estimatedBudget = Math.round(body.estimatedBudget);
    }

    if (typeof body.firstContactAt === 'string') {
      const date = new Date(body.firstContactAt);
      data.firstContactAt = Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof body.source === 'string' && body.source in LeadSource) {
      data.source = body.source as keyof typeof LeadSource;
    }

    if (
      typeof body.qualificationLevel === 'string' &&
      body.qualificationLevel in QualificationLevel
    ) {
      data.qualificationLevel = body.qualificationLevel as keyof typeof QualificationLevel;
    }

    if (
      typeof body.pipelineStatus === 'string' &&
      Object.values(ProspectPipelineStatus).includes(body.pipelineStatus as ProspectPipelineStatus)
    ) {
      data.pipelineStatus = body.pipelineStatus as ProspectPipelineStatus;
    }

    if (
      typeof body.status === 'string' &&
      Object.values(ProspectStatus).includes(body.status as ProspectStatus)
    ) {
      data.status = body.status as ProspectStatus;
    }

    const prospect = await prisma.prospect.create({ data });

    return jsonbCreated({ item: prospect }, requestId);
  }
);
