import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { ProspectStatus } from '@/generated/prisma';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import {
  badRequest,
  forbidden,
  getRequestId,
  isRecord,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import type { ProspectPipelineStatus, QualificationLevel, LeadSource } from '@/generated/prisma';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
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

function normalizeStr(v: unknown) {
  return String(v ?? '').trim();
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  title: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: LeadSource | null;
  interestNote: string | null;
  qualificationLevel: QualificationLevel | null;
  projectIdea: string | null;
  estimatedBudget: number | null;
  origin: string | null;
  probability: number;
  nextActionDate: Date | null;
  firstContactAt: Date | null;
  pipelineStatus: ProspectPipelineStatus;
  status: ProspectStatus;
  createdAt: Date;
  updatedAt: Date;
};

function serializeProspect(p: ProspectLike) {
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
      return withIdNoStore(unauthorized(), requestId);
    }

    const delegateError = ensureProspectDelegate(requestId);
    if (delegateError) return delegateError;

    const { businessId, prospectId } = await context.params;
    const businessIdBigInt = parseId(businessId);
    const prospectIdBigInt = parseId(prospectId);
    if (!businessIdBigInt || !prospectIdBigInt) {
      return withIdNoStore(badRequest('Paramètres invalides.'), requestId);
    }

    const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
    if (!business) {
      return withIdNoStore(
        NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }),
        requestId
      );
    }

    const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
    if (!membership) return withIdNoStore(forbidden(), requestId);

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectIdBigInt, businessId: businessIdBigInt },
    });
    if (!prospect) {
      return withIdNoStore(
        NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 }),
        requestId
      );
    }

    return withIdNoStore(jsonNoStore(serializeProspect(prospect)), requestId);
  } catch (err) {
    console.error({ err, route: '/api/pro/businesses/[businessId]/prospects/[prospectId]' });
    return withIdNoStore(NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }), requestId);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureProspectDelegate(requestId);
  if (delegateError) return delegateError;

  const { businessId, prospectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const prospectIdBigInt = parseId(prospectId);
  if (!businessIdBigInt || !prospectIdBigInt) {
    return withIdNoStore(badRequest('Paramètres invalides.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withIdNoStore(
      NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }),
      requestId
    );
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  if ('name' in body) {
    const name = normalizeStr((body as { name?: unknown }).name);
    if (!name) return withIdNoStore(badRequest('Le nom est requis.'), requestId);
    if (name.length > 120) return withIdNoStore(badRequest('Nom trop long (max 120).'), requestId);
    data.name = name;
  }

  if ('title' in body) {
    const title = normalizeStr((body as { title?: unknown }).title);
    if (title.length > 120) return withIdNoStore(badRequest('Titre trop long (max 120).'), requestId);
    data.title = title || null;
  }

  if ('contactName' in body) {
    const contactName = normalizeStr((body as { contactName?: unknown }).contactName);
    if (contactName && contactName.length > 120) {
      return withIdNoStore(badRequest('Contact trop long (max 120).'), requestId);
    }
    data.contactName = contactName || null;
  }

  if ('contactEmail' in body) {
    const email = normalizeStr((body as { contactEmail?: unknown }).contactEmail);
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return withIdNoStore(badRequest('Email invalide.'), requestId);
    }
    data.contactEmail = email || null;
  }

  if ('contactPhone' in body) {
    const phone = normalizeStr((body as { contactPhone?: unknown }).contactPhone);
    if (phone && phone.length > 32) {
      return withIdNoStore(badRequest('Téléphone invalide.'), requestId);
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
    const d = parseDate((body as { firstContactAt?: unknown }).firstContactAt);
    data.firstContactAt = d;
  }

  if ('pipelineStatus' in body) {
    const status = (body as { pipelineStatus?: ProspectPipelineStatus | null }).pipelineStatus;
    if (status && !VALID_STATUS.has(status)) {
      return withIdNoStore(badRequest('Statut pipeline invalide.'), requestId);
    }
    data.pipelineStatus = status ?? undefined;
  }

  if ('probability' in body) {
    const probRaw = (body as { probability?: unknown }).probability;
    if (typeof probRaw !== 'number' || !Number.isFinite(probRaw)) {
      return withIdNoStore(badRequest('Probabilité invalide.'), requestId);
    }
    data.probability = Math.min(100, Math.max(0, Math.trunc(probRaw)));
  }

  if ('nextActionDate' in body) {
    const parsed = parseDate((body as { nextActionDate?: unknown }).nextActionDate);
    if ((body as { nextActionDate?: unknown }).nextActionDate && !parsed) {
      return withIdNoStore(badRequest('Prochaine action invalide.'), requestId);
    }
    data.nextActionDate = parsed;
  }

  if ('status' in body) {
    const st = (body as { status?: unknown }).status;
    if (typeof st !== 'string' || !Object.values(ProspectStatus).includes(st as ProspectStatus)) {
      return withIdNoStore(badRequest('Statut invalide.'), requestId);
    }
    data.status = st as ProspectStatus;
  }

  if ('origin' in body) {
    const origin = normalizeStr((body as { origin?: unknown }).origin);
    if (origin.length > 120) {
      return withIdNoStore(badRequest('Origine trop longue (max 120).'), requestId);
    }
    data.origin = origin || null;
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucun champ à mettre à jour.'), requestId);
  }

  const updated = await prisma.prospect.updateMany({
    where: { id: prospectIdBigInt, businessId: businessIdBigInt },
    data,
  });

  if (updated.count === 0) {
    return withIdNoStore(
      NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 }),
      requestId
    );
  }

  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectIdBigInt, businessId: businessIdBigInt },
  });

  return withIdNoStore(jsonNoStore(serializeProspect(prospect!)), requestId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureProspectDelegate(requestId);
  if (delegateError) return delegateError;

  const { businessId, prospectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const prospectIdBigInt = parseId(prospectId);
  if (!businessIdBigInt || !prospectIdBigInt) {
    return withIdNoStore(badRequest('Paramètres invalides.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withIdNoStore(
      NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }),
      requestId
    );
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const deleted = await prisma.prospect.deleteMany({
    where: { id: prospectIdBigInt, businessId: businessIdBigInt },
  });

  if (deleted.count === 0) {
    return withIdNoStore(
      NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 }),
      requestId
    );
  }

  return withIdNoStore(jsonNoStore({ deleted: deleted.count }), requestId);
}
