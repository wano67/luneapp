import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import type { Prisma, Prospect } from '@/generated/prisma/client';
import { LeadSource, ProspectPipelineStatus, QualificationLevel } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
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

function serializeProspect(p: Prospect) {
  return {
    id: p.id.toString(),
    businessId: p.businessId.toString(),
    name: p.name,
    contactName: p.contactName,
    contactEmail: p.contactEmail,
    contactPhone: p.contactPhone,
    source: p.source ?? null,
    interestNote: p.interestNote,
    qualificationLevel: p.qualificationLevel ?? null,
    projectIdea: p.projectIdea,
    estimatedBudget: p.estimatedBudget,
    firstContactAt: p.firstContactAt ? p.firstContactAt.toISOString() : null,
    pipelineStatus: p.pipelineStatus,
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
      return withRequestId(unauthorized(), requestId);
    }

    const businessId = parseBusinessId(businessIdParam);
    if (!businessId) {
      return withRequestId(badRequest('businessId invalide.'), requestId);
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
    }

    const membership = await requireBusinessRole(businessId, BigInt(userId), 'VIEWER');
    if (!membership) return withRequestId(forbidden(), requestId);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const statusParam = searchParams.get('status');

    const where: Prisma.ProspectWhereInput = { businessId };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (statusParam && VALID_PIPELINE_STATUS.has(statusParam as ProspectPipelineStatus)) {
      where.pipelineStatus = statusParam as ProspectPipelineStatus;
    }

    const prospects = await prisma.prospect.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return jsonNoStore({
      items: prospects.map(serializeProspect),
    });
  } catch (err) {
    console.error({
      requestId,
      route: '/api/pro/businesses/[businessId]/prospects',
      err,
    });
    return withRequestId(
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
  if (csrf) return csrf;

  try {
    const { businessId: businessIdParam } = await context.params;
    let userId: string;
    try {
      ({ userId } = await requireAuthPro(request));
    } catch {
      return withRequestId(unauthorized(), requestId);
    }

    const businessId = parseBusinessId(businessIdParam);
    if (!businessId) {
      return withRequestId(badRequest('businessId invalide.'), requestId);
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
    }

    const membership = await requireBusinessRole(businessId, BigInt(userId), 'ADMIN');
    if (!membership) return withRequestId(forbidden(), requestId);

    const limited = rateLimit(request, {
      key: `pro:prospects:create:${businessId.toString()}:${userId.toString()}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJson(request);

    if (!isRecord(body) || typeof body.name !== 'string') {
      return withRequestId(badRequest("Le nom du prospect est requis."), requestId);
    }

    const name = normalizeStr(body.name);
    if (!name) {
      return withRequestId(badRequest("Le nom du prospect ne peut pas être vide."), requestId);
    }
    if (name.length > 120) {
      return withRequestId(badRequest('Le nom du prospect est trop long (max 120).'), requestId);
    }

    const contactNameRaw = normalizeStr(
      typeof body.contactName === 'string' ? body.contactName : ''
    );
    if (contactNameRaw && contactNameRaw.length > 120) {
      return withRequestId(badRequest('Le nom du contact est trop long (max 120).'), requestId);
    }

    const contactEmailRaw = normalizeStr(
      typeof body.contactEmail === 'string' ? body.contactEmail : ''
    );
    if (contactEmailRaw && (contactEmailRaw.length > 254 || !isValidEmail(contactEmailRaw))) {
      return withRequestId(badRequest('Email du contact invalide.'), requestId);
    }

    const contactPhoneRaw = sanitizePhone(
      typeof body.contactPhone === 'string' ? body.contactPhone : ''
    );
    if (contactPhoneRaw && (contactPhoneRaw.length > 32 || !isValidPhone(contactPhoneRaw))) {
      return withRequestId(badRequest('Téléphone du contact invalide.'), requestId);
    }

    const interestNoteRaw = normalizeStr(
      typeof body.interestNote === 'string' ? body.interestNote : ''
    );
    if (interestNoteRaw && interestNoteRaw.length > 2000) {
      return withRequestId(badRequest('Note d’intérêt trop longue (max 2000).'), requestId);
    }

    const projectIdeaRaw = normalizeStr(
      typeof body.projectIdea === 'string' ? body.projectIdea : ''
    );
    if (projectIdeaRaw && projectIdeaRaw.length > 2000) {
      return withRequestId(badRequest('Idée de projet trop longue (max 2000).'), requestId);
    }

    const data: Prisma.ProspectCreateInput = {
      business: { connect: { id: businessId } },
      name,
      contactName: contactNameRaw || null,
      contactEmail: contactEmailRaw || null,
      contactPhone: contactPhoneRaw || null,
      interestNote: interestNoteRaw || null,
      projectIdea: projectIdeaRaw || null,
    };

    if (typeof body.estimatedBudget === 'number') {
      if (!Number.isFinite(body.estimatedBudget) || body.estimatedBudget < 0) {
        return withRequestId(badRequest('Budget estimé invalide.'), requestId);
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
      body.pipelineStatus in ProspectPipelineStatus
    ) {
      data.pipelineStatus =
        body.pipelineStatus as keyof typeof ProspectPipelineStatus;
    }

    const prospect = await prisma.prospect.create({
      data,
    });

    return NextResponse.json(serializeProspect(prospect), { status: 201 });
  } catch (err) {
    console.error({
      requestId,
      route: '/api/pro/businesses/[businessId]/prospects',
      err,
    });
    return withRequestId(
      NextResponse.json({ error: 'Server error while creating the prospect' }, { status: 500 }),
      requestId
    );
  }
}
