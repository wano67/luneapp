import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { badRequest, getRequestId, unauthorized, withIdNoStore, withRequestId } from '@/server/http/apiUtils';
import { BusinessReferenceType, ClientStatus, LeadSource } from '@/generated/prisma/client';
import { normalizeWebsiteUrl } from '@/lib/website';

function forbidden(requestId: string) {
  return withIdNoStore(NextResponse.json({ error: 'Forbidden' }, { status: 403 }), requestId);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
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

function normalizeStr(v: unknown) {
  return String(v ?? '').trim();
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

const STATUS_VALUES = new Set<ClientStatus>(['ACTIVE', 'PAUSED', 'FORMER']);

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
  anonymizedAt: Date | null;
  anonymizationReason: string | null;
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
    anonymizedAt: client.anonymizedAt ? client.anonymizedAt.toISOString() : null,
    anonymizationReason: client.anonymizationReason,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

// GET /api/pro/businesses/{businessId}/clients
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withRequestId(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return forbidden(requestId);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('q')?.trim() ?? searchParams.get('search')?.trim();
  const status = searchParams.get('status') as ClientStatus | null;
  const sector = searchParams.get('sector')?.trim();
  const origin = searchParams.get('origin')?.trim();
  const categoryReferenceIdParam = searchParams.get('categoryReferenceId');
  const tagReferenceIdParam = searchParams.get('tagReferenceId');
  const archivedParam = searchParams.get('archived');
  const sortByParam = searchParams.get('sortBy') ?? 'name';
  const sortDirParam = searchParams.get('sortDir') ?? 'asc';
  const categoryReferenceId = categoryReferenceIdParam ? parseId(categoryReferenceIdParam) : null;
  if (categoryReferenceIdParam && !categoryReferenceId) {
    return withRequestId(badRequest('categoryReferenceId invalide.'), requestId);
  }
  const tagReferenceId = tagReferenceIdParam ? parseId(tagReferenceIdParam) : null;
  if (tagReferenceIdParam && !tagReferenceId) {
    return withRequestId(badRequest('tagReferenceId invalide.'), requestId);
  }

  const showArchived = archivedParam === '1' || archivedParam === 'true';
  const sortBy =
    sortByParam === 'createdAt' || sortByParam === 'updatedAt' || sortByParam === 'name'
      ? sortByParam
      : 'name';
  const sortDir = sortDirParam === 'desc' ? 'desc' : 'asc';

  const clients = await prisma.client.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(showArchived ? {} : { archivedAt: null }),
      ...(search
        ? {
            name: { contains: search, mode: 'insensitive' },
          }
        : {}),
      ...(status && STATUS_VALUES.has(status) ? { status } : {}),
      ...(sector ? { sector: { contains: sector, mode: 'insensitive' } } : {}),
      ...(origin ? { leadSource: origin as LeadSource } : {}),
      ...(categoryReferenceId ? { categoryReferenceId } : {}),
      ...(tagReferenceId ? { tags: { some: { referenceId: tagReferenceId } } } : {}),
    },
    orderBy: { [sortBy]: sortDir },
    include: {
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  return withRequestId(
    jsonNoStore({
      items: clients.map((c) => serializeClient(c)),
    }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/clients
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
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

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withRequestId(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const limited = rateLimit(request, {
    key: `pro:clients:create:${businessIdBigInt}:${userId.toString()}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withRequestId(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.name !== 'string') {
    return withRequestId(badRequest('Le nom du client est requis.'), requestId);
  }

  const name = normalizeStr(body.name);
  if (!name) return withRequestId(badRequest('Le nom du client ne peut pas être vide.'), requestId);
  if (name.length > 120) {
    return withRequestId(badRequest('Le nom du client est trop long (max 120).'), requestId);
  }

  const emailRaw = normalizeStr(typeof body.email === 'string' ? body.email : '');
  const email = emailRaw ? emailRaw : undefined;
  if (email && (email.length > 254 || !isValidEmail(email))) {
    return withRequestId(badRequest('Email invalide.'), requestId);
  }

  const phoneRaw = sanitizePhone(typeof body.phone === 'string' ? body.phone : '');
  const phone = phoneRaw ? phoneRaw : undefined;
  if (phone && (phone.length > 32 || !isValidPhone(phone))) {
    return withRequestId(badRequest('Téléphone invalide.'), requestId);
  }

  const notesRaw = normalizeStr(typeof body.notes === 'string' ? body.notes : '');
  const notes = notesRaw ? notesRaw : undefined;
  if (notes && notes.length > 2000) {
    return withRequestId(badRequest('Notes trop longues (max 2000).'), requestId);
  }

  const websiteNormalized = normalizeWebsiteUrl((body as Record<string, unknown>).websiteUrl);
  if (websiteNormalized.error) {
    return withRequestId(badRequest(websiteNormalized.error), requestId);
  }

  const sector = normalizeStr(body.sector);
  const status =
    typeof body.status === 'string' && STATUS_VALUES.has(body.status as ClientStatus)
      ? (body.status as ClientStatus)
      : undefined;
  const leadSourceRaw = normalizeStr(body.leadSource);
  const leadSource =
    leadSourceRaw && Object.values(LeadSource).includes(leadSourceRaw as LeadSource)
      ? (leadSourceRaw as LeadSource)
      : undefined;
  if (leadSourceRaw && !leadSource) {
    return withRequestId(badRequest('leadSource invalide.'), requestId);
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

  const validated = await validateCategoryAndTags(
    businessIdBigInt,
    categoryReferenceId ?? null,
    tagReferenceIds
  );
  if ('error' in validated) {
    return withRequestId(badRequest(validated.error), requestId);
  }

  const client = await prisma.client.create({
    data: {
      businessId: businessIdBigInt,
      name,
      email,
      phone,
      notes,
      websiteUrl: websiteNormalized.value ?? undefined,
      sector: sector || undefined,
      status: status ?? undefined,
      leadSource,
      categoryReferenceId: validated.categoryId ?? undefined,
      tags:
        validated.tagIds.length > 0
          ? {
              create: validated.tagIds.map((id) => ({ referenceId: id })),
            }
          : undefined,
    },
    include: {
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  return withRequestId(jsonNoStore(serializeClient(client), { status: 201 }), requestId);
}
