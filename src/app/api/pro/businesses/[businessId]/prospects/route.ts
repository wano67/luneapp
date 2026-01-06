import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import type { Prisma, Prospect } from '@/generated/prisma';
import {
  LeadSource,
  ProspectPipelineStatus,
  QualificationLevel,
  ProspectStatus,
} from '@/generated/prisma';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  forbidden,
  getRequestId,
  readJson,
  unauthorized,
  withRequestId,
  isRecord,
} from '@/server/http/apiUtils';

function normalizeStr(v: unknown) {
  return String(v ?? '').trim();
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function sanitizePhone(s: string) {
  return normalizeStr(s).replace(/\s+/g, ' ');
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

function parseBusinessId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) {
    return null;
  }
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function ensureProspectDelegate(requestId: string) {
  if (!(prisma as { prospect?: unknown }).prospect) {
    return withIdNoStore(
      NextResponse.json(
        { error: 'Prisma client not generated / wrong import (prospect delegate absent).' },
        { status: 500 }
      ),
      requestId
    );
  }
  return null;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeProspect(p: Prospect) {
  return {
    id: p.id.toString(),
    businessId: p.businessId.toString(),
    name: p.name,
    title: p.title,
    contactName: p.contactName,
    contactEmail: p.contactEmail,
    contactPhone: p.contactPhone,
    source: p.source ?? null,
    interestNote: p.interestNote,
    qualificationLevel: p.qualificationLevel ?? null,
    projectIdea: p.projectIdea,
    estimatedBudget: p.estimatedBudget,
    origin: p.origin,
    probability: p.probability,
    nextActionDate: p.nextActionDate ? p.nextActionDate.toISOString() : null,
    firstContactAt: p.firstContactAt ? p.firstContactAt.toISOString() : null,
    pipelineStatus: p.pipelineStatus,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// GET /api/pro/businesses/{businessId}/prospects
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  try {
    const { businessId: businessIdParam } = await context.params;
    let userId: string;
    try {
      ({ userId } = await requireAuthPro(request));
    } catch {
      return withIdNoStore(unauthorized(), requestId);
    }

    const delegateError = ensureProspectDelegate(requestId);
    if (delegateError) return delegateError;

    const businessId = parseBusinessId(businessIdParam);
    if (!businessId) {
      return withIdNoStore(badRequest('businessId invalide.'), requestId);
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return withIdNoStore(
        NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }),
        requestId
      );
    }

    const membership = await requireBusinessRole(businessId, BigInt(userId), 'VIEWER');
    if (!membership) return withIdNoStore(forbidden(), requestId);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q')?.trim() ?? searchParams.get('search')?.trim();
    const pipelineStatusParam = searchParams.get('pipelineStatus') as ProspectPipelineStatus | null;
    const statusParam = searchParams.get('status') as ProspectStatus | null;
    const probabilityMin = parseInt(searchParams.get('probabilityMin') ?? '', 10);
    const nextActionBeforeRaw = searchParams.get('nextActionBefore');
    const nextActionBefore = parseDate(nextActionBeforeRaw);
    if (nextActionBeforeRaw && !nextActionBefore) {
      return withIdNoStore(badRequest('nextActionBefore invalide.'), requestId);
    }

    const where: Prisma.ProspectWhereInput = { businessId };

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

    return withIdNoStore(
      jsonNoStore({
        items: prospects.map(serializeProspect),
      }),
      requestId
    );
  } catch (err) {
    console.error({
      requestId,
      route: '/api/pro/businesses/[businessId]/prospects',
      err,
    });
    return withIdNoStore(
      NextResponse.json({ error: 'Server error while loading prospects' }, { status: 500 }),
      requestId
    );
  }
}

// POST /api/pro/businesses/{businessId}/prospects
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  try {
    const { businessId: businessIdParam } = await context.params;
    let userId: string;
    try {
      ({ userId } = await requireAuthPro(request));
    } catch {
      return withIdNoStore(unauthorized(), requestId);
    }

    const delegateError = ensureProspectDelegate(requestId);
    if (delegateError) return delegateError;

    const businessId = parseBusinessId(businessIdParam);
    if (!businessId) {
      return withIdNoStore(badRequest('businessId invalide.'), requestId);
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return withIdNoStore(
        NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }),
        requestId
      );
    }

    const membership = await requireBusinessRole(businessId, BigInt(userId), 'ADMIN');
    if (!membership) return withIdNoStore(forbidden(), requestId);

    const limited = rateLimit(request, {
      key: `pro:prospects:create:${businessId.toString()}:${userId.toString()}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return withIdNoStore(limited, requestId);

    const body = await readJson(request);

    if (!isRecord(body) || typeof body.name !== 'string') {
      return withIdNoStore(badRequest("Le nom du prospect est requis."), requestId);
    }

    const name = normalizeStr(body.name);
    if (!name) {
      return withIdNoStore(badRequest("Le nom du prospect ne peut pas être vide."), requestId);
    }
    if (name.length > 120) {
      return withIdNoStore(badRequest('Le nom du prospect est trop long (max 120).'), requestId);
    }

    const contactNameRaw = normalizeStr(
      typeof body.contactName === 'string' ? body.contactName : ''
    );
    if (contactNameRaw && contactNameRaw.length > 120) {
      return withIdNoStore(badRequest('Le nom du contact est trop long (max 120).'), requestId);
    }

    const contactEmailRaw = normalizeStr(
      typeof body.contactEmail === 'string' ? body.contactEmail : ''
    );
    if (contactEmailRaw && (contactEmailRaw.length > 254 || !isValidEmail(contactEmailRaw))) {
      return withIdNoStore(badRequest('Email du contact invalide.'), requestId);
    }

    const contactPhoneRaw = sanitizePhone(
      typeof body.contactPhone === 'string' ? body.contactPhone : ''
    );
    if (contactPhoneRaw && (contactPhoneRaw.length > 32 || !isValidPhone(contactPhoneRaw))) {
      return withIdNoStore(badRequest('Téléphone du contact invalide.'), requestId);
    }

    const interestNoteRaw = normalizeStr(
      typeof body.interestNote === 'string' ? body.interestNote : ''
    );
    if (interestNoteRaw && interestNoteRaw.length > 2000) {
      return withIdNoStore(badRequest('Note d’intérêt trop longue (max 2000).'), requestId);
    }

    const projectIdeaRaw = normalizeStr(typeof body.projectIdea === 'string' ? body.projectIdea : '');
    if (projectIdeaRaw && projectIdeaRaw.length > 2000) {
      return withIdNoStore(badRequest('Idée de projet trop longue (max 2000).'), requestId);
    }

    const origin = normalizeStr(body.origin);
    const title = normalizeStr(typeof body.title === 'string' ? body.title : '');
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
      business: { connect: { id: businessId } },
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
      data.qualificationLevel =
        body.qualificationLevel as keyof typeof QualificationLevel;
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

    const prospect = await prisma.prospect.create({
      data,
    });

    return withIdNoStore(jsonNoStore(serializeProspect(prospect), { status: 201 }), requestId);
  } catch (err) {
    console.error({
      requestId,
      route: '/api/pro/businesses/[businessId]/prospects',
      err,
    });
    return withIdNoStore(
      NextResponse.json({ error: 'Server error while creating the prospect' }, { status: 500 }),
      requestId
    );
  }
}
