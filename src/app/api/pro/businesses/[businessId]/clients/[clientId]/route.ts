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
import { BusinessReferenceType, ClientStatus, LeadSource } from '@/generated/prisma';
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
  companyName?: string | null;
  mainContactName?: string | null;
  billingCompanyName?: string | null;
  billingContactName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingVatNumber?: string | null;
  billingReference?: string | null;
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  billingCountryCode?: string | null;
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
    company: client.companyName ?? null,
    companyName: client.companyName ?? null,
    mainContactName: client.mainContactName ?? null,
    billingCompanyName: client.billingCompanyName ?? null,
    billingContactName: client.billingContactName ?? null,
    billingEmail: client.billingEmail ?? null,
    billingPhone: client.billingPhone ?? null,
    billingVatNumber: client.billingVatNumber ?? null,
    billingReference: client.billingReference ?? null,
    billingAddressLine1: client.billingAddressLine1 ?? null,
    billingAddressLine2: client.billingAddressLine2 ?? null,
    billingPostalCode: client.billingPostalCode ?? null,
    billingCity: client.billingCity ?? null,
    billingCountryCode: client.billingCountryCode ?? null,
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

  if ('companyName' in body || 'company' in body) {
    const raw =
      'companyName' in body
        ? (body as Record<string, unknown>).companyName
        : (body as Record<string, unknown>).company;
    if (raw == null || raw === '') {
      data.companyName = null;
    } else if (typeof raw === 'string') {
      const companyName = normalizeStr(raw);
      if (companyName && companyName.length > 160) {
        return withNoStore(withRequestId(badRequest('Nom de société trop long (max 160).'), requestId));
      }
      data.companyName = companyName || null;
    } else {
      return withNoStore(withRequestId(badRequest('Nom de société invalide.'), requestId));
    }
  }

  if ('mainContactName' in body) {
    if (body.mainContactName == null || body.mainContactName === '') {
      data.mainContactName = null;
    } else if (typeof body.mainContactName === 'string') {
      const mainContactName = normalizeStr(body.mainContactName);
      if (mainContactName && mainContactName.length > 160) {
        return withNoStore(withRequestId(badRequest('Contact principal trop long (max 160).'), requestId));
      }
      data.mainContactName = mainContactName || null;
    } else {
      return withNoStore(withRequestId(badRequest('Contact principal invalide.'), requestId));
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

  if ('billingCompanyName' in body) {
    if (body.billingCompanyName == null || body.billingCompanyName === '') {
      data.billingCompanyName = null;
    } else if (typeof body.billingCompanyName === 'string') {
      const billingCompanyName = normalizeStr(body.billingCompanyName);
      if (billingCompanyName && billingCompanyName.length > 160) {
        return withNoStore(withRequestId(badRequest('Société facturation trop longue (max 160).'), requestId));
      }
      data.billingCompanyName = billingCompanyName || null;
    } else {
      return withNoStore(withRequestId(badRequest('Société facturation invalide.'), requestId));
    }
  }

  if ('billingContactName' in body) {
    if (body.billingContactName == null || body.billingContactName === '') {
      data.billingContactName = null;
    } else if (typeof body.billingContactName === 'string') {
      const billingContactName = normalizeStr(body.billingContactName);
      if (billingContactName && billingContactName.length > 160) {
        return withNoStore(withRequestId(badRequest('Contact facturation trop long (max 160).'), requestId));
      }
      data.billingContactName = billingContactName || null;
    } else {
      return withNoStore(withRequestId(badRequest('Contact facturation invalide.'), requestId));
    }
  }

  if ('billingEmail' in body) {
    if (body.billingEmail == null || body.billingEmail === '') {
      data.billingEmail = null;
    } else if (typeof body.billingEmail === 'string') {
      const billingEmail = normalizeStr(body.billingEmail);
      if (billingEmail && (billingEmail.length > 254 || !isValidEmail(billingEmail))) {
        return withNoStore(withRequestId(badRequest('Email facturation invalide.'), requestId));
      }
      data.billingEmail = billingEmail || null;
    } else {
      return withNoStore(withRequestId(badRequest('Email facturation invalide.'), requestId));
    }
  }

  if ('billingPhone' in body) {
    if (body.billingPhone == null || body.billingPhone === '') {
      data.billingPhone = null;
    } else if (typeof body.billingPhone === 'string') {
      const billingPhone = sanitizePhone(body.billingPhone);
      if (billingPhone && (billingPhone.length > 32 || !isValidPhone(billingPhone))) {
        return withNoStore(withRequestId(badRequest('Téléphone facturation invalide.'), requestId));
      }
      data.billingPhone = billingPhone || null;
    } else {
      return withNoStore(withRequestId(badRequest('Téléphone facturation invalide.'), requestId));
    }
  }

  if ('billingVatNumber' in body) {
    if (body.billingVatNumber == null || body.billingVatNumber === '') {
      data.billingVatNumber = null;
    } else if (typeof body.billingVatNumber === 'string') {
      const billingVatNumber = normalizeStr(body.billingVatNumber);
      if (billingVatNumber && billingVatNumber.length > 40) {
        return withNoStore(withRequestId(badRequest('Numéro TVA trop long (40 max).'), requestId));
      }
      data.billingVatNumber = billingVatNumber || null;
    } else {
      return withNoStore(withRequestId(badRequest('Numéro TVA invalide.'), requestId));
    }
  }

  if ('billingReference' in body) {
    if (body.billingReference == null || body.billingReference === '') {
      data.billingReference = null;
    } else if (typeof body.billingReference === 'string') {
      const billingReference = normalizeStr(body.billingReference);
      if (billingReference && billingReference.length > 120) {
        return withNoStore(withRequestId(badRequest('Référence client trop longue (120 max).'), requestId));
      }
      data.billingReference = billingReference || null;
    } else {
      return withNoStore(withRequestId(badRequest('Référence client invalide.'), requestId));
    }
  }

  if ('billingAddressLine1' in body) {
    if (body.billingAddressLine1 == null || body.billingAddressLine1 === '') {
      data.billingAddressLine1 = null;
    } else if (typeof body.billingAddressLine1 === 'string') {
      const billingAddressLine1 = normalizeStr(body.billingAddressLine1);
      if (billingAddressLine1 && billingAddressLine1.length > 200) {
        return withNoStore(withRequestId(badRequest('Adresse facturation trop longue (200 max).'), requestId));
      }
      data.billingAddressLine1 = billingAddressLine1 || null;
    } else {
      return withNoStore(withRequestId(badRequest('Adresse facturation invalide.'), requestId));
    }
  }

  if ('billingAddressLine2' in body) {
    if (body.billingAddressLine2 == null || body.billingAddressLine2 === '') {
      data.billingAddressLine2 = null;
    } else if (typeof body.billingAddressLine2 === 'string') {
      const billingAddressLine2 = normalizeStr(body.billingAddressLine2);
      if (billingAddressLine2 && billingAddressLine2.length > 200) {
        return withNoStore(withRequestId(badRequest('Complément adresse facturation trop long (200 max).'), requestId));
      }
      data.billingAddressLine2 = billingAddressLine2 || null;
    } else {
      return withNoStore(withRequestId(badRequest('Complément adresse facturation invalide.'), requestId));
    }
  }

  if ('billingPostalCode' in body) {
    if (body.billingPostalCode == null || body.billingPostalCode === '') {
      data.billingPostalCode = null;
    } else if (typeof body.billingPostalCode === 'string') {
      const billingPostalCode = normalizeStr(body.billingPostalCode);
      if (billingPostalCode && billingPostalCode.length > 20) {
        return withNoStore(withRequestId(badRequest('Code postal facturation trop long (20 max).'), requestId));
      }
      data.billingPostalCode = billingPostalCode || null;
    } else {
      return withNoStore(withRequestId(badRequest('Code postal facturation invalide.'), requestId));
    }
  }

  if ('billingCity' in body) {
    if (body.billingCity == null || body.billingCity === '') {
      data.billingCity = null;
    } else if (typeof body.billingCity === 'string') {
      const billingCity = normalizeStr(body.billingCity);
      if (billingCity && billingCity.length > 100) {
        return withNoStore(withRequestId(badRequest('Ville facturation trop longue (100 max).'), requestId));
      }
      data.billingCity = billingCity || null;
    } else {
      return withNoStore(withRequestId(badRequest('Ville facturation invalide.'), requestId));
    }
  }

  if ('billingCountryCode' in body) {
    if (body.billingCountryCode == null || body.billingCountryCode === '') {
      data.billingCountryCode = null;
    } else if (typeof body.billingCountryCode === 'string') {
      const billingCountryCode = normalizeStr(body.billingCountryCode);
      if (billingCountryCode && billingCountryCode.length !== 2) {
        return withNoStore(withRequestId(badRequest('Pays facturation invalide (ISO 2 lettres).'), requestId));
      }
      data.billingCountryCode = billingCountryCode ? billingCountryCode.toUpperCase() : null;
    } else {
      return withNoStore(withRequestId(badRequest('Pays facturation invalide.'), requestId));
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
