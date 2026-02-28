import { prisma } from '@/server/db/client';
import { ProspectStatus } from '@/generated/prisma';
import type { ProspectPipelineStatus, QualificationLevel } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { parseIdOpt, parseDateOpt, parseStr } from '@/server/http/parsers';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, isRecord, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { ensureDelegate } from '@/server/http/delegates';

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
  source: string | null;
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

// GET /api/pro/businesses/{businessId}/prospects/{prospectId}
export const GET = withBusinessRoute<{ businessId: string; prospectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const prospectIdBigInt = parseIdOpt(params.prospectId);
    if (!prospectIdBigInt) return withIdNoStore(badRequest('prospectId invalide.'), requestId);

    const delegateError = ensureDelegate('prospect', requestId);
    if (delegateError) return delegateError;

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectIdBigInt, businessId: businessIdBigInt },
    });
    if (!prospect) return withIdNoStore(notFound('Prospect introuvable.'), requestId);

    return jsonb({ item: serializeProspect(prospect) }, requestId);
  }
);

// PATCH /api/pro/businesses/{businessId}/prospects/{prospectId}
export const PATCH = withBusinessRoute<{ businessId: string; prospectId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const prospectIdBigInt = parseIdOpt(params.prospectId);
    if (!prospectIdBigInt) return withIdNoStore(badRequest('prospectId invalide.'), requestId);

    const delegateError = ensureDelegate('prospect', requestId);
    if (delegateError) return delegateError;

    const body = await request.json().catch(() => null);
    if (!isRecord(body)) {
      return withIdNoStore(badRequest('Payload invalide.'), requestId);
    }

    const data: Record<string, unknown> = {};

    if ('name' in body) {
      const name = parseStr((body as { name?: unknown }).name);
      if (!name) return withIdNoStore(badRequest('Le nom est requis.'), requestId);
      if (name.length > 120) return withIdNoStore(badRequest('Nom trop long (max 120).'), requestId);
      data.name = name;
    }

    if ('title' in body) {
      const title = parseStr((body as { title?: unknown }).title);
      if (title && title.length > 120) return withIdNoStore(badRequest('Titre trop long (max 120).'), requestId);
      data.title = title || null;
    }

    if ('contactName' in body) {
      const contactName = parseStr((body as { contactName?: unknown }).contactName);
      if (contactName && contactName.length > 120) {
        return withIdNoStore(badRequest('Contact trop long (max 120).'), requestId);
      }
      data.contactName = contactName || null;
    }

    if ('contactEmail' in body) {
      const email = parseStr((body as { contactEmail?: unknown }).contactEmail);
      if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return withIdNoStore(badRequest('Email invalide.'), requestId);
      }
      data.contactEmail = email || null;
    }

    if ('contactPhone' in body) {
      const phone = parseStr((body as { contactPhone?: unknown }).contactPhone);
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
      const note = parseStr((body as { interestNote?: unknown }).interestNote);
      data.interestNote = note || null;
    }

    if ('qualificationLevel' in body) {
      const level = (body as { qualificationLevel?: QualificationLevel | null }).qualificationLevel;
      data.qualificationLevel = level ?? null;
    }

    if ('projectIdea' in body) {
      const idea = parseStr((body as { projectIdea?: unknown }).projectIdea);
      data.projectIdea = idea || null;
    }

    if ('estimatedBudget' in body) {
      const budgetRaw = (body as { estimatedBudget?: unknown }).estimatedBudget;
      data.estimatedBudget =
        typeof budgetRaw === 'number' && Number.isFinite(budgetRaw) ? Math.trunc(budgetRaw) : null;
    }

    if ('firstContactAt' in body) {
      const d = parseDateOpt((body as { firstContactAt?: unknown }).firstContactAt);
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
      const parsed = parseDateOpt((body as { nextActionDate?: unknown }).nextActionDate);
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
      const origin = parseStr((body as { origin?: unknown }).origin);
      if (origin && origin.length > 120) {
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
      return withIdNoStore(notFound('Prospect introuvable.'), requestId);
    }

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectIdBigInt, businessId: businessIdBigInt },
    });

    return jsonb({ item: serializeProspect(prospect!) }, requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/prospects/{prospectId}
export const DELETE = withBusinessRoute<{ businessId: string; prospectId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const prospectIdBigInt = parseIdOpt(params.prospectId);
    if (!prospectIdBigInt) return withIdNoStore(badRequest('prospectId invalide.'), requestId);

    const delegateError = ensureDelegate('prospect', requestId);
    if (delegateError) return delegateError;

    const deleted = await prisma.prospect.deleteMany({
      where: { id: prospectIdBigInt, businessId: businessIdBigInt },
    });

    if (deleted.count === 0) {
      return withIdNoStore(notFound('Prospect introuvable.'), requestId);
    }

    return jsonbNoContent(requestId);
  }
);
