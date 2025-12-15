import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import type { Prisma, Prospect } from '@/generated/prisma/client';
import { LeadSource, ProspectPipelineStatus, QualificationLevel } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

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

async function getUserId(request: NextRequest): Promise<bigint | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await verifyAuthToken(token);
    if (!payload.sub) return null;
    return BigInt(payload.sub);
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
  try {
    const { businessId: businessIdParam } = await context.params;
    const userId = await getUserId(request);
    if (!userId) return unauthorized();

    const businessId = parseBusinessId(businessIdParam);
    if (!businessId) {
      return badRequest('businessId invalide.');
    }

    const membership = await requireBusinessRole(businessId, userId, 'VIEWER');
    if (!membership) return forbidden();

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
    console.error(
      'GET /api/pro/businesses/[businessId]/prospects error:',
      err
    );
    return NextResponse.json(
      { error: 'Server error while loading prospects' },
      { status: 500 }
    );
  }
}

// POST /api/pro/businesses/{businessId}/prospects
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const { businessId: businessIdParam } = await context.params;
    const userId = await getUserId(request);
    if (!userId) return unauthorized();

    const businessId = parseBusinessId(businessIdParam);
    if (!businessId) {
      return badRequest('businessId invalide.');
    }

    const membership = await requireBusinessRole(businessId, userId, 'ADMIN');
    if (!membership) return forbidden();

    const limited = rateLimit(request, {
      key: `pro:prospects:create:${businessId.toString()}:${userId.toString()}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await request.json().catch(() => null);

    if (!isRecord(body) || typeof body.name !== 'string') {
      return badRequest("Le nom du prospect est requis.");
    }

    const name = normalizeStr(body.name);
    if (!name) {
      return badRequest("Le nom du prospect ne peut pas être vide.");
    }
    if (name.length > 120) {
      return badRequest('Le nom du prospect est trop long (max 120).');
    }

    const contactNameRaw = normalizeStr(
      typeof body.contactName === 'string' ? body.contactName : ''
    );
    if (contactNameRaw && contactNameRaw.length > 120) {
      return badRequest('Le nom du contact est trop long (max 120).');
    }

    const contactEmailRaw = normalizeStr(
      typeof body.contactEmail === 'string' ? body.contactEmail : ''
    );
    if (contactEmailRaw && (contactEmailRaw.length > 254 || !isValidEmail(contactEmailRaw))) {
      return badRequest('Email du contact invalide.');
    }

    const contactPhoneRaw = sanitizePhone(
      typeof body.contactPhone === 'string' ? body.contactPhone : ''
    );
    if (contactPhoneRaw && (contactPhoneRaw.length > 32 || !isValidPhone(contactPhoneRaw))) {
      return badRequest('Téléphone du contact invalide.');
    }

    const interestNoteRaw = normalizeStr(
      typeof body.interestNote === 'string' ? body.interestNote : ''
    );
    if (interestNoteRaw && interestNoteRaw.length > 2000) {
      return badRequest('Note d’intérêt trop longue (max 2000).');
    }

    const projectIdeaRaw = normalizeStr(
      typeof body.projectIdea === 'string' ? body.projectIdea : ''
    );
    if (projectIdeaRaw && projectIdeaRaw.length > 2000) {
      return badRequest('Idée de projet trop longue (max 2000).');
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
        return badRequest('Budget estimé invalide.');
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
    console.error(
      'POST /api/pro/businesses/[businessId]/prospects error:',
      err
    );
    return NextResponse.json(
      { error: "Server error while creating the prospect" },
      { status: 500 }
    );
  }
}
