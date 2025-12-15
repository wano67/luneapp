import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import {
  LeadSource,
  QualificationLevel,
  ProspectPipelineStatus,
} from '@/generated/prisma/client';
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

function serializeProspect(p: {
  id: bigint;
  businessId: bigint;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: LeadSource | null;
  interestNote: string | null;
  qualificationLevel: QualificationLevel | null;
  projectIdea: string | null;
  estimatedBudget: number | null;
  firstContactAt: Date | null;
  pipelineStatus: ProspectPipelineStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
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

    const membership = await requireBusinessRole(businessId, userId, 'VIEWER');
    if (!membership) return forbidden();

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, businessId },
    });

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 });
    }

    return jsonNoStore(serializeProspect(prospect));
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
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

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

    const membership = await requireBusinessRole(businessId, userId, 'ADMIN');
    if (!membership) return forbidden();

    const limited = rateLimit(request, {
      key: `pro:prospects:update:${businessId.toString()}:${userId.toString()}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const existing = await prisma.prospect.findFirst({
      where: { id: prospectId, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!isRecord(body)) {
      return badRequest('Corps de requête invalide.');
    }

    const data: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      const name = normalizeStr(body.name);
      if (!name) {
        return badRequest("Le nom du prospect ne peut pas être vide.");
      }
      if (name.length > 120) {
        return badRequest('Le nom du prospect est trop long (max 120).');
      }
      data.name = name;
    }

    if (typeof body.contactName === 'string') {
      const contactName = normalizeStr(body.contactName);
      if (contactName && contactName.length > 120) {
        return badRequest('Le nom du contact est trop long (max 120).');
      }
      data.contactName = contactName || null;
    }

    if (typeof body.contactEmail === 'string') {
      const contactEmail = normalizeStr(body.contactEmail);
      if (contactEmail && (contactEmail.length > 254 || !isValidEmail(contactEmail))) {
        return badRequest('Email du contact invalide.');
      }
      data.contactEmail = contactEmail || null;
    }

    if (typeof body.contactPhone === 'string') {
      const contactPhone = sanitizePhone(body.contactPhone);
      if (contactPhone && (contactPhone.length > 32 || !isValidPhone(contactPhone))) {
        return badRequest('Téléphone du contact invalide.');
      }
      data.contactPhone = contactPhone || null;
    }

    if (typeof body.interestNote === 'string') {
      const interestNote = normalizeStr(body.interestNote);
      if (interestNote && interestNote.length > 2000) {
        return badRequest("La note d'intérêt est trop longue (max 2000).");
      }
      data.interestNote = interestNote || null;
    }

    if (typeof body.projectIdea === 'string') {
      const projectIdea = normalizeStr(body.projectIdea);
      if (projectIdea && projectIdea.length > 2000) {
        return badRequest('L’idée de projet est trop longue (max 2000).');
      }
      data.projectIdea = projectIdea || null;
    }

    if (typeof body.estimatedBudget === 'number') {
      if (!Number.isFinite(body.estimatedBudget) || body.estimatedBudget < 0) {
        return badRequest('Budget estimé invalide.');
      }
      data.estimatedBudget = Math.round(body.estimatedBudget);
    } else if (body && 'estimatedBudget' in body && body.estimatedBudget === null) {
      data.estimatedBudget = null;
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
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

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

    const membership = await requireBusinessRole(businessId, userId, 'ADMIN');
    if (!membership) return forbidden();

    const limited = rateLimit(request, {
      key: `pro:prospects:delete:${businessId.toString()}:${userId.toString()}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

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
