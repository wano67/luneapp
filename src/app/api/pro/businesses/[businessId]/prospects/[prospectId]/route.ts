import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import {
  LeadSource,
  QualificationLevel,
  ProspectPipelineStatus,
} from '@/generated/prisma/client';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseId(param: string | undefined) {
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

async function requireMembership(businessId: bigint, userId: bigint) {
  return prisma.businessMembership.findUnique({
    where: {
      businessId_userId: { businessId, userId },
    },
  });
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

// GET /api/pro/businesses/{businessId}/prospects/{prospectId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  try {
    const { businessId: businessIdParam, prospectId: prospectIdParam } =
      await context.params;

    const userId = await getUserId(request);
    if (!userId) return unauthorized();

    const businessId = parseId(businessIdParam);
    const prospectId = parseId(prospectIdParam);
    if (!businessId || !prospectId) {
      return badRequest('businessId ou prospectId invalide.');
    }

    const membership = await requireMembership(businessId, userId);
    if (!membership) return forbidden();

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, businessId },
    });

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 });
    }

    return NextResponse.json(serializeProspect(prospect));
  } catch (err) {
    console.error(
      'GET /api/pro/businesses/[businessId]/prospects/[prospectId] error:',
      err
    );
    return NextResponse.json(
      { error: 'Server error while loading the prospect.' },
      { status: 500 }
    );
  }
}

// PATCH /api/pro/businesses/{businessId}/prospects/{prospectId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  try {
    const { businessId: businessIdParam, prospectId: prospectIdParam } =
      await context.params;

    const userId = await getUserId(request);
    if (!userId) return unauthorized();

    const businessId = parseId(businessIdParam);
    const prospectId = parseId(prospectIdParam);
    if (!businessId || !prospectId) {
      return badRequest('businessId ou prospectId invalide.');
    }

    const membership = await requireMembership(businessId, userId);
    if (!membership) return forbidden();

    const existing = await prisma.prospect.findFirst({
      where: { id: prospectId, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Corps de requête invalide.');
    }

    const data: any = {};

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) {
        return badRequest("Le nom du prospect ne peut pas être vide.");
      }
      data.name = name;
    }

    if (typeof body.contactName === 'string') {
      data.contactName = body.contactName.trim() || null;
    }

    if (typeof body.contactEmail === 'string') {
      data.contactEmail = body.contactEmail.trim() || null;
    }

    if (typeof body.contactPhone === 'string') {
      data.contactPhone = body.contactPhone.trim() || null;
    }

    if (typeof body.interestNote === 'string') {
      data.interestNote = body.interestNote.trim() || null;
    }

    if (typeof body.projectIdea === 'string') {
      data.projectIdea = body.projectIdea.trim() || null;
    }

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
      data.qualificationLevel = body.qualificationLevel as keyof typeof QualificationLevel;
    }

    if (
      typeof body.pipelineStatus === 'string' &&
      body.pipelineStatus in ProspectPipelineStatus
    ) {
      data.pipelineStatus = body.pipelineStatus as keyof typeof ProspectPipelineStatus;
    }

    if (Object.keys(data).length === 0) {
      return badRequest('Aucune donnée à mettre à jour.');
    }

    const prospect = await prisma.prospect.update({
      where: { id: prospectId },
      data,
    });

    return NextResponse.json(serializeProspect(prospect));
  } catch (err) {
    console.error(
      'PATCH /api/pro/businesses/[businessId]/prospects/[prospectId] error:',
      err
    );
    return NextResponse.json(
      { error: 'Server error while updating the prospect.' },
      { status: 500 }
    );
  }
}

// DELETE /api/pro/businesses/{businessId}/prospects/{prospectId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  try {
    const { businessId: businessIdParam, prospectId: prospectIdParam } =
      await context.params;

    const userId = await getUserId(request);
    if (!userId) return unauthorized();

    const businessId = parseId(businessIdParam);
    const prospectId = parseId(prospectIdParam);
    if (!businessId || !prospectId) {
      return badRequest('businessId ou prospectId invalide.');
    }

    const membership = await requireMembership(businessId, userId);
    if (!membership) return forbidden();

    const existing = await prisma.prospect.findFirst({
      where: { id: prospectId, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 });
    }

    await prisma.prospect.delete({
      where: { id: prospectId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(
      'DELETE /api/pro/businesses/[businessId]/prospects/[prospectId] error:',
      err
    );
    return NextResponse.json(
      { error: 'Server error while deleting the prospect.' },
      { status: 500 }
    );
  }
}
