import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { LeadSource, QualificationLevel, ProspectPipelineStatus } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
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
  const requestId = getRequestId(request);
  try {
    const { businessId: businessIdParam, prospectId: prospectIdParam } = await context.params;

    let userId: string;
    try {
      ({ userId } = await requireAuthPro(request));
    } catch {
      return withRequestId(unauthorized(), requestId);
    }

    const businessId = parseId(businessIdParam);
    const prospectId = parseId(prospectIdParam);
    if (!businessId || !prospectId) {
      return withRequestId(badRequest('businessId ou prospectId invalide.'), requestId);
    }

    const membership = await requireBusinessRole(businessId, BigInt(userId), 'VIEWER');
    if (!membership) return withRequestId(forbidden(), requestId);

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, businessId },
    });

    if (!prospect) {
      return withRequestId(notFound('Prospect introuvable.'), requestId);
    }

    return jsonNoStore(serializeProspect(prospect));
  } catch (err) {
    console.error({
      requestId,
      route: '/api/pro/businesses/[businessId]/prospects/[prospectId]',
      err,
    });
    return withRequestId(
      NextResponse.json({ error: 'Server error while loading the prospect.' }, { status: 500 }),
      requestId
    );
  }
}

// PATCH /api/pro/businesses/{businessId}/prospects/{prospectId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const { businessId: businessIdParam, prospectId: prospectIdParam } = await context.params;

    let userId: string;
    try {
      ({ userId } = await requireAuthPro(request));
    } catch {
      return withRequestId(unauthorized(), requestId);
    }

    const businessId = parseId(businessIdParam);
    const prospectId = parseId(prospectIdParam);
    if (!businessId || !prospectId) {
      return withRequestId(badRequest('businessId ou prospectId invalide.'), requestId);
    }

    const membership = await requireBusinessRole(businessId, BigInt(userId), 'ADMIN');
    if (!membership) return withRequestId(forbidden(), requestId);

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
      return withRequestId(notFound('Prospect introuvable.'), requestId);
    }

    const body = await readJson(request);
    if (!isRecord(body)) {
      return withRequestId(badRequest('Corps de requête invalide.'), requestId);
    }

    const data: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      const name = normalizeStr(body.name);
      if (!name) {
        return withRequestId(badRequest("Le nom du prospect ne peut pas être vide."), requestId);
      }
      if (name.length > 120) {
        return withRequestId(badRequest('Le nom du prospect est trop long (max 120).'), requestId);
      }
      data.name = name;
    }

    if (typeof body.contactName === 'string') {
      const contactName = normalizeStr(body.contactName);
      if (contactName && contactName.length > 120) {
        return withRequestId(badRequest('Le nom du contact est trop long (max 120).'), requestId);
      }
      data.contactName = contactName || null;
    }

    if (typeof body.contactEmail === 'string') {
      const contactEmail = normalizeStr(body.contactEmail);
      if (contactEmail && (contactEmail.length > 254 || !isValidEmail(contactEmail))) {
        return withRequestId(badRequest('Email du contact invalide.'), requestId);
      }
      data.contactEmail = contactEmail || null;
    }

    if (typeof body.contactPhone === 'string') {
      const contactPhone = sanitizePhone(body.contactPhone);
      if (contactPhone && (contactPhone.length > 32 || !isValidPhone(contactPhone))) {
        return withRequestId(badRequest('Téléphone du contact invalide.'), requestId);
      }
      data.contactPhone = contactPhone || null;
    }

    if (typeof body.interestNote === 'string') {
      const interestNote = normalizeStr(body.interestNote);
      if (interestNote && interestNote.length > 2000) {
        return withRequestId(badRequest("La note d'intérêt est trop longue (max 2000)."), requestId);
      }
      data.interestNote = interestNote || null;
    }

    if (typeof body.projectIdea === 'string') {
      const projectIdea = normalizeStr(body.projectIdea);
      if (projectIdea && projectIdea.length > 2000) {
        return withRequestId(badRequest('L’idée de projet est trop longue (max 2000).'), requestId);
      }
      data.projectIdea = projectIdea || null;
    }

    if (typeof body.estimatedBudget === 'number') {
      if (!Number.isFinite(body.estimatedBudget) || body.estimatedBudget < 0) {
        return withRequestId(badRequest('Budget estimé invalide.'), requestId);
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

    if (typeof body.qualificationLevel === 'string' && body.qualificationLevel in QualificationLevel) {
      data.qualificationLevel = body.qualificationLevel as keyof typeof QualificationLevel;
    }

    if (typeof body.pipelineStatus === 'string' && body.pipelineStatus in ProspectPipelineStatus) {
      data.pipelineStatus = body.pipelineStatus as keyof typeof ProspectPipelineStatus;
    }

    if (Object.keys(data).length === 0) {
      return withRequestId(badRequest('Aucune donnée à mettre à jour.'), requestId);
    }

    const prospect = await prisma.prospect.update({
      where: { id: prospectId },
      data,
    });

    return NextResponse.json(serializeProspect(prospect));
  } catch (err) {
    console.error({
      requestId,
      route: '/api/pro/businesses/[businessId]/prospects/[prospectId]',
      err,
    });
    return withRequestId(
      NextResponse.json({ error: 'Server error while updating the prospect.' }, { status: 500 }),
      requestId
    );
  }
}

// DELETE /api/pro/businesses/{businessId}/prospects/{prospectId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const { businessId: businessIdParam, prospectId: prospectIdParam } = await context.params;

    let userId: string;
    try {
      ({ userId } = await requireAuthPro(request));
    } catch {
      return withRequestId(unauthorized(), requestId);
    }

    const businessId = parseId(businessIdParam);
    const prospectId = parseId(prospectIdParam);
    if (!businessId || !prospectId) {
      return withRequestId(badRequest('businessId ou prospectId invalide.'), requestId);
    }

    const membership = await requireBusinessRole(businessId, BigInt(userId), 'ADMIN');
    if (!membership) return withRequestId(forbidden(), requestId);

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
      return withRequestId(notFound('Prospect introuvable.'), requestId);
    }

    await prisma.prospect.delete({
      where: { id: prospectId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error({
      requestId,
      route: '/api/pro/businesses/[businessId]/prospects/[prospectId]',
      err,
    });
    return withRequestId(
      NextResponse.json({ error: 'Server error while deleting the prospect.' }, { status: 500 }),
      requestId
    );
  }
}
