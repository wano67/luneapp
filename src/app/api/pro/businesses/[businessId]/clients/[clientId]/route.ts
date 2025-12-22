import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { BusinessReferenceType, ClientStatus, LeadSource } from '@/generated/prisma/client';
import { normalizeWebsiteUrl } from '@/lib/website';

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

function normalizeStr(v: unknown) {
  return String(v ?? '').trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function sanitizePhone(s: unknown) {
  return normalizeStr(s).replace(/\s+/g, ' ');
}

function isValidPhone(s: string) {
  if (!s) return false;
  if (!/^[\d+\-().\s]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

async function validateCategoryAndTags(
  businessId: bigint,
  categoryReferenceId: bigint | null,
  tagReferenceIds?: bigint[]
): Promise<{ categoryId: bigint | null; tagIds: bigint[] } | { error: string }> {
  if (categoryReferenceId) {
    const category = await prisma.businessReference.findFirst({
      where: {
        id: categoryReferenceId,
        businessId,
        type: BusinessReferenceType.CATEGORY,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!category) return { error: 'categoryReferenceId invalide pour ce business.' };
  }

  let tagIds: bigint[] = [];
  if (tagReferenceIds && tagReferenceIds.length) {
    const tags = await prisma.businessReference.findMany({
      where: {
        id: { in: tagReferenceIds },
        businessId,
        type: BusinessReferenceType.TAG,
        isArchived: false,
      },
      select: { id: true },
    });
    if (tags.length !== tagReferenceIds.length) {
      return { error: 'tagReferenceIds invalides pour ce business.' };
    }
    tagIds = tags.map((t) => t.id);
  }

  return { categoryId: categoryReferenceId, tagIds };
}

function serializeClient(client: {
  id: bigint;
  businessId: bigint;
  name: string;
  email: string | null;
  websiteUrl: string | null;
  phone: string | null;
  notes: string | null;
  sector: string | null;
  status: ClientStatus;
  leadSource: LeadSource | null;
  archivedAt: Date | null;
  categoryReferenceId?: bigint | null;
  categoryReference?: { id: bigint; name: string | null } | null;
  tags?: Array<{ referenceId: bigint; reference: { id: bigint; name: string } }>;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: client.id.toString(),
    businessId: client.businessId.toString(),
    categoryReferenceId: client.categoryReferenceId ? client.categoryReferenceId.toString() : null,
    categoryReferenceName: client.categoryReference?.name ?? null,
    tagReferences: client.tags
      ? client.tags.map((tag) => ({
          id: tag.reference.id.toString(),
          name: tag.reference.name,
        }))
      : [],
    name: client.name,
    email: client.email,
    websiteUrl: client.websiteUrl,
    phone: client.phone,
    notes: client.notes,
    sector: client.sector,
    status: client.status,
    leadSource: client.leadSource,
    archivedAt: client.archivedAt ? client.archivedAt.toISOString() : null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

const STATUS_VALUES = new Set<ClientStatus>(['ACTIVE', 'PAUSED', 'FORMER']);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withNoStore(withRequestId(unauthorized(), requestId));
  }

  const { businessId, clientId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const clientIdBigInt = parseId(clientId);
  if (!businessIdBigInt || !clientIdBigInt) {
    return withNoStore(withRequestId(badRequest('Identifiants invalides.'), requestId));
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withNoStore(withRequestId(notFound('Entreprise introuvable.'), requestId));
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withNoStore(withRequestId(forbidden(), requestId));

  const client = await prisma.client.findFirst({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
    include: {
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  if (!client) {
    return withNoStore(withRequestId(notFound('Client introuvable.'), requestId));
  }

  return withNoStore(
    withRequestId(
      jsonNoStore({
        item: serializeClient(client),
      }),
      requestId
    )
  );
}

// PATCH /api/pro/businesses/{businessId}/clients/{clientId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withNoStore(withRequestId(csrf, requestId));

  const { businessId, clientId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const clientIdBigInt = parseId(clientId);
  if (!businessIdBigInt || !clientIdBigInt) {
    return withNoStore(withRequestId(badRequest('Identifiants invalides.'), requestId));
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withNoStore(withRequestId(unauthorized(), requestId));
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withNoStore(withRequestId(forbidden(), requestId));

  const limited = rateLimit(request, {
    key: `pro:clients:update:${businessIdBigInt}:${clientIdBigInt}`,
    limit: 200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withNoStore(withRequestId(limited, requestId));

  const existing = await prisma.client.findFirst({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
    include: {
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });
  if (!existing) {
    return withNoStore(withRequestId(notFound('Client introuvable.'), requestId));
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return withNoStore(withRequestId(badRequest('Payload invalide.'), requestId));
  }

  const data: Record<string, unknown> = {};

  if ('name' in body) {
    if (typeof body.name !== 'string') return withNoStore(withRequestId(badRequest('Nom invalide.'), requestId));
    const name = normalizeStr(body.name);
    if (!name) return withNoStore(withRequestId(badRequest('Nom requis.'), requestId));
    if (name.length > 120) return withNoStore(withRequestId(badRequest('Nom trop long (max 120).'), requestId));
    data.name = name;
  }

  if ('email' in body) {
    if (body.email == null || body.email === '') {
      data.email = null;
    } else if (typeof body.email === 'string') {
      const email = normalizeStr(body.email);
      if (email && (email.length > 254 || !isValidEmail(email))) {
        return withNoStore(withRequestId(badRequest('Email invalide.'), requestId));
      }
      data.email = email || null;
    } else {
      return withNoStore(withRequestId(badRequest('Email invalide.'), requestId));
    }
  }

  if ('phone' in body) {
    if (body.phone == null || body.phone === '') {
      data.phone = null;
    } else if (typeof body.phone === 'string') {
      const phone = sanitizePhone(body.phone);
      if (phone && (phone.length > 32 || !isValidPhone(phone))) {
        return withNoStore(withRequestId(badRequest('Téléphone invalide.'), requestId));
      }
      data.phone = phone || null;
    } else {
      return withNoStore(withRequestId(badRequest('Téléphone invalide.'), requestId));
    }
  }

  if ('websiteUrl' in body) {
    const normalized = normalizeWebsiteUrl((body as Record<string, unknown>).websiteUrl);
    if (normalized.error) {
      return withNoStore(withRequestId(badRequest(normalized.error), requestId));
    }
    data.websiteUrl = normalized.value;
  }

  if ('notes' in body) {
    if (body.notes == null || body.notes === '') {
      data.notes = null;
    } else if (typeof body.notes === 'string') {
      const notes = normalizeStr(body.notes);
      if (notes && notes.length > 2000) {
        return withNoStore(withRequestId(badRequest('Notes trop longues (max 2000).'), requestId));
      }
      data.notes = notes || null;
    } else {
      return withNoStore(withRequestId(badRequest('Notes invalides.'), requestId));
    }
  }

  if ('status' in body) {
    if (body.status === null || body.status === undefined || body.status === '') {
      data.status = ClientStatus.ACTIVE;
    } else if (typeof body.status === 'string' && STATUS_VALUES.has(body.status as ClientStatus)) {
      data.status = body.status as ClientStatus;
    } else {
      return withNoStore(withRequestId(badRequest('Statut invalide.'), requestId));
    }
  }

  if ('leadSource' in body) {
    if (body.leadSource === null || body.leadSource === undefined || body.leadSource === '') {
      data.leadSource = null;
    } else if (typeof body.leadSource === 'string' && Object.values(LeadSource).includes(body.leadSource as LeadSource)) {
      data.leadSource = body.leadSource as LeadSource;
    } else {
      return withNoStore(withRequestId(badRequest('leadSource invalide.'), requestId));
    }
  }

  const categoryProvided = Object.prototype.hasOwnProperty.call(body, 'categoryReferenceId');
  const categoryReferenceId =
    categoryProvided && typeof body.categoryReferenceId === 'string' && /^\d+$/.test(body.categoryReferenceId)
      ? BigInt(body.categoryReferenceId)
      : categoryProvided
        ? null
        : undefined;

  const tagProvided = Object.prototype.hasOwnProperty.call(body, 'tagReferenceIds');
  const tagReferenceIds: bigint[] | undefined = tagProvided
    ? Array.from(
        new Set(
          ((Array.isArray(body.tagReferenceIds) ? body.tagReferenceIds : []) as unknown[])
            .filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
            .map((id) => BigInt(id))
        )
      )
    : undefined;

  let tagsInstruction:
    | {
        deleteMany: { clientId: bigint };
        create: Array<{ referenceId: bigint }>;
      }
    | undefined;

  if (categoryProvided || tagProvided) {
    const validated = await validateCategoryAndTags(
      businessIdBigInt,
      categoryProvided ? categoryReferenceId ?? null : existing.categoryReferenceId ?? null,
      tagProvided ? tagReferenceIds : existing.tags?.map((t) => t.referenceId)
    );
    if ('error' in validated) {
      return withNoStore(withRequestId(badRequest(validated.error), requestId));
    }
    if (categoryProvided) {
      data.categoryReferenceId = validated.categoryId;
    }
    if (tagProvided) {
      tagsInstruction = {
        deleteMany: { clientId: clientIdBigInt },
        create: validated.tagIds.map((id) => ({ referenceId: id })),
      };
    }
  }

  if (!tagsInstruction && Object.keys(data).length === 0) {
    return withNoStore(withRequestId(badRequest('Aucune modification.'), requestId));
  }

  if ('archive' in body) {
    if (typeof body.archive !== 'boolean') {
      return withNoStore(withRequestId(badRequest('archive doit être un booléen.'), requestId));
    }
    data.archivedAt = body.archive ? new Date() : null;
  }

  if ('archivedAt' in body) {
    if (body.archivedAt === null || body.archivedAt === '') {
      data.archivedAt = null;
    } else if (typeof body.archivedAt === 'string') {
      const parsed = new Date(body.archivedAt);
      if (Number.isNaN(parsed.getTime())) {
        return withNoStore(withRequestId(badRequest('archivedAt invalide.'), requestId));
      }
      data.archivedAt = parsed;
    } else {
      return withNoStore(withRequestId(badRequest('archivedAt invalide.'), requestId));
    }
  }

  const updated = await prisma.client.update({
    where: { id: clientIdBigInt },
    data: {
      ...data,
      ...(tagsInstruction ? { tags: tagsInstruction } : {}),
    },
    include: {
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  return withNoStore(withRequestId(jsonNoStore({ item: serializeClient(updated) }), requestId));
}
