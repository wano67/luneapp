import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import {
  LeadSource,
  ProspectPipelineStatus,
  QualificationLevel,
} from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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

function serializeProspect(p: any) {
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

    const where: any = { businessId };

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

    const body = await request.json().catch(() => null);

    if (!body || typeof body.name !== 'string') {
      return badRequest("Le nom du prospect est requis.");
    }

    const name = body.name.trim();
    if (!name) {
      return badRequest("Le nom du prospect ne peut pas être vide.");
    }

    const data: any = {
      businessId,
      name,
      contactName:
        typeof body.contactName === 'string' && body.contactName.trim()
          ? body.contactName.trim()
          : null,
      contactEmail:
        typeof body.contactEmail === 'string' && body.contactEmail.trim()
          ? body.contactEmail.trim()
          : null,
      contactPhone:
        typeof body.contactPhone === 'string' && body.contactPhone.trim()
          ? body.contactPhone.trim()
          : null,
      interestNote:
        typeof body.interestNote === 'string' && body.interestNote.trim()
          ? body.interestNote.trim()
          : null,
      projectIdea:
        typeof body.projectIdea === 'string' && body.projectIdea.trim()
          ? body.projectIdea.trim()
          : null,
    };

    if (typeof body.estimatedBudget === 'number') {
      data.estimatedBudget = Number.isFinite(body.estimatedBudget)
        ? Math.round(body.estimatedBudget)
        : null;
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
