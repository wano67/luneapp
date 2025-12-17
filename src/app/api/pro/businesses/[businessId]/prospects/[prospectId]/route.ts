import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import {
  badRequest,
  forbidden,
  getRequestId,
  isRecord,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import type { ProspectPipelineStatus, QualificationLevel, LeadSource } from '@/generated/prisma/client';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function normalizeStr(v: unknown) {
  return String(v ?? '').trim();
}

const VALID_STATUS = new Set<ProspectPipelineStatus>([
  'NEW',
  'IN_DISCUSSION',
  'OFFER_SENT',
  'FOLLOW_UP',
  'CLOSED',
]);

type ProspectLike = {
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
};

function serializeProspect(p: ProspectLike) {
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  const requestId = getRequestId(request);
  try {
    let userId: string;
    try {
      ({ userId } = await requireAuthPro(request));
    } catch {
      return withRequestId(unauthorized(), requestId);
    }

    const { businessId, prospectId } = await context.params;
    const businessIdBigInt = parseId(businessId);
    const prospectIdBigInt = parseId(prospectId);
    if (!businessIdBigInt || !prospectIdBigInt) {
      return withRequestId(badRequest('Paramètres invalides.'), requestId);
    }

    const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
    if (!business) {
      return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
    }

    const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
    if (!membership) return withRequestId(forbidden(), requestId);

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectIdBigInt, businessId: businessIdBigInt },
    });
    if (!prospect) {
      return withRequestId(NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 }), requestId);
    }

    return jsonNoStore(serializeProspect(prospect));
  } catch (err) {
    console.error({ err, route: '/api/pro/businesses/[businessId]/prospects/[prospectId]' });
    return withRequestId(NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }), requestId);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId, prospectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const prospectIdBigInt = parseId(prospectId);
  if (!businessIdBigInt || !prospectIdBigInt) {
    return withRequestId(badRequest('Paramètres invalides.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return withRequestId(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  if ('name' in body) {
    const name = normalizeStr((body as { name?: unknown }).name);
    if (!name) return withRequestId(badRequest('Le nom est requis.'), requestId);
    if (name.length > 120) return withRequestId(badRequest('Nom trop long (max 120).'), requestId);
    data.name = name;
  }

  if ('contactName' in body) {
    const contactName = normalizeStr((body as { contactName?: unknown }).contactName);
    if (contactName && contactName.length > 120) {
      return withRequestId(badRequest('Contact trop long (max 120).'), requestId);
    }
    data.contactName = contactName || null;
  }

  if ('contactEmail' in body) {
    const email = normalizeStr((body as { contactEmail?: unknown }).contactEmail);
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return withRequestId(badRequest('Email invalide.'), requestId);
    }
    data.contactEmail = email || null;
  }

  if ('contactPhone' in body) {
    const phone = normalizeStr((body as { contactPhone?: unknown }).contactPhone);
    if (phone && phone.length > 32) {
      return withRequestId(badRequest('Téléphone invalide.'), requestId);
    }
    data.contactPhone = phone || null;
  }

  if ('source' in body) {
    const source = (body as { source?: string }).source;
    data.source = source ?? null;
  }

  if ('interestNote' in body) {
    const note = normalizeStr((body as { interestNote?: unknown }).interestNote);
    data.interestNote = note || null;
  }

  if ('qualificationLevel' in body) {
    const level = (body as { qualificationLevel?: QualificationLevel | null }).qualificationLevel;
    data.qualificationLevel = level ?? null;
  }

  if ('projectIdea' in body) {
    const idea = normalizeStr((body as { projectIdea?: unknown }).projectIdea);
    data.projectIdea = idea || null;
  }

  if ('estimatedBudget' in body) {
    const budgetRaw = (body as { estimatedBudget?: unknown }).estimatedBudget;
    data.estimatedBudget =
      typeof budgetRaw === 'number' && Number.isFinite(budgetRaw) ? Math.trunc(budgetRaw) : null;
  }

  if ('firstContactAt' in body) {
    const val = (body as { firstContactAt?: unknown }).firstContactAt;
    const d = val ? new Date(String(val)) : null;
    data.firstContactAt = d && !Number.isNaN(d.getTime()) ? d : null;
  }

  if ('pipelineStatus' in body) {
    const status = (body as { pipelineStatus?: ProspectPipelineStatus | null }).pipelineStatus;
    if (status && !VALID_STATUS.has(status)) {
      return withRequestId(badRequest('Statut pipeline invalide.'), requestId);
    }
    data.pipelineStatus = status ?? undefined;
  }

  if (Object.keys(data).length === 0) {
    return withRequestId(badRequest('Aucun champ à mettre à jour.'), requestId);
  }

  const updated = await prisma.prospect.updateMany({
    where: { id: prospectIdBigInt, businessId: businessIdBigInt },
    data,
  });

  if (updated.count === 0) {
    return withRequestId(NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 }), requestId);
  }

  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectIdBigInt, businessId: businessIdBigInt },
  });

  return jsonNoStore(serializeProspect(prospect!));
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId, prospectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const prospectIdBigInt = parseId(prospectId);
  if (!businessIdBigInt || !prospectIdBigInt) {
    return withRequestId(badRequest('Paramètres invalides.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

  const deleted = await prisma.prospect.deleteMany({
    where: { id: prospectIdBigInt, businessId: businessIdBigInt },
  });

  if (deleted.count === 0) {
    return withRequestId(NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 }), requestId);
  }

  return NextResponse.json({ deleted: deleted.count });
}
