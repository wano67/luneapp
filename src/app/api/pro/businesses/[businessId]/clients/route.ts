import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { parseIdOpt, parseStr } from '@/server/http/parsers';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { ClientStatus, LeadSource } from '@/generated/prisma';
import { validateCategoryAndTags } from '@/server/http/validators';
import { normalizeWebsiteUrl } from '@/lib/website';

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function sanitizePhone(s: unknown) {
  return (parseStr(s) ?? '').replace(/\s+/g, ' ');
}

function isValidPhone(s: string) {
  if (!s) return false;
  if (!/^[\d+\-().\s]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

const STATUS_VALUES = new Set<ClientStatus>(['ACTIVE', 'PAUSED', 'FORMER']);

function flattenClient(client: { categoryReference?: { name: string | null } | null; tags?: Array<{ reference: { id: bigint; name: string } }> }) {
  return {
    ...client,
    categoryReferenceName: client.categoryReference?.name ?? null,
    tagReferences: client.tags
      ? client.tags.map((tag) => tag.reference)
      : [],
  };
}

// ---------------------------------------------------------------------------
// GET /api/pro/businesses/{businessId}/clients
// ---------------------------------------------------------------------------

export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, req) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q')?.trim() ?? searchParams.get('search')?.trim();
  const status = searchParams.get('status') as ClientStatus | null;
  const sector = searchParams.get('sector')?.trim();
  const origin = searchParams.get('origin')?.trim();
  const archivedParam = searchParams.get('archived');
  const sortByParam = searchParams.get('sortBy') ?? 'name';
  const sortDirParam = searchParams.get('sortDir') ?? 'asc';

  // parseIdOpt lance RouteParseError (→ 400) si présent mais invalide
  const categoryReferenceId = parseIdOpt(searchParams.get('categoryReferenceId'));
  const tagReferenceId = parseIdOpt(searchParams.get('tagReferenceId'));

  const showArchived = archivedParam === '1' || archivedParam === 'true';
  const sortBy =
    sortByParam === 'createdAt' || sortByParam === 'updatedAt' || sortByParam === 'name'
      ? sortByParam
      : 'name';
  const sortDir = sortDirParam === 'desc' ? 'desc' : 'asc';

  const clients = await prisma.client.findMany({
    where: {
      businessId: ctx.businessId,
      ...(showArchived ? {} : { archivedAt: null }),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
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

  return jsonb({ items: clients.map(flattenClient) }, ctx.requestId);
});

// ---------------------------------------------------------------------------
// POST /api/pro/businesses/{businessId}/clients
// ---------------------------------------------------------------------------

export const POST = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:clients:create:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), ctx.requestId);
    }

    const b = body as Record<string, unknown>;

    if (typeof b.name !== 'string') {
      return withIdNoStore(badRequest('Le nom du client est requis.'), ctx.requestId);
    }

    const name = parseStr(b.name) ?? '';
    if (!name)
      return withIdNoStore(badRequest('Le nom du client ne peut pas être vide.'), ctx.requestId);
    if (name.length > 120)
      return withIdNoStore(badRequest('Le nom du client est trop long (max 120).'), ctx.requestId);

    const emailRaw = parseStr(typeof b.email === 'string' ? b.email : '') ?? '';
    const email = emailRaw || undefined;
    if (email && (email.length > 254 || !isValidEmail(email)))
      return withIdNoStore(badRequest('Email invalide.'), ctx.requestId);

    const phoneRaw = sanitizePhone(typeof b.phone === 'string' ? b.phone : '');
    const phone = phoneRaw || undefined;
    if (phone && (phone.length > 32 || !isValidPhone(phone)))
      return withIdNoStore(badRequest('Téléphone invalide.'), ctx.requestId);

    const notesRaw = parseStr(typeof b.notes === 'string' ? b.notes : '') ?? '';
    const notes = notesRaw || undefined;
    if (notes && notes.length > 2000)
      return withIdNoStore(badRequest('Notes trop longues (max 2000).'), ctx.requestId);

    const websiteNormalized = normalizeWebsiteUrl(b.websiteUrl);
    if (websiteNormalized.error)
      return withIdNoStore(badRequest(websiteNormalized.error), ctx.requestId);

    const sector = parseStr(b.sector) ?? '';
    const status =
      typeof b.status === 'string' && STATUS_VALUES.has(b.status as ClientStatus)
        ? (b.status as ClientStatus)
        : undefined;

    const leadSourceRaw = parseStr(b.leadSource) ?? '';
    const leadSource =
      leadSourceRaw && Object.values(LeadSource).includes(leadSourceRaw as LeadSource)
        ? (leadSourceRaw as LeadSource)
        : undefined;
    if (leadSourceRaw && !leadSource)
      return withIdNoStore(badRequest('leadSource invalide.'), ctx.requestId);

    const categoryProvided = Object.prototype.hasOwnProperty.call(b, 'categoryReferenceId');
    const categoryReferenceId =
      categoryProvided && typeof b.categoryReferenceId === 'string' && /^\d+$/.test(b.categoryReferenceId)
        ? BigInt(b.categoryReferenceId)
        : categoryProvided
          ? null
          : undefined;

    const tagProvided = Object.prototype.hasOwnProperty.call(b, 'tagReferenceIds');
    const tagReferenceIds: bigint[] | undefined = tagProvided
      ? Array.from(
          new Set(
            ((Array.isArray(b.tagReferenceIds) ? b.tagReferenceIds : []) as unknown[])
              .filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
              .map((id) => BigInt(id))
          )
        )
      : undefined;

    const validated = await validateCategoryAndTags(
      ctx.businessId,
      categoryReferenceId ?? null,
      tagReferenceIds
    );
    if ('error' in validated) {
      return withIdNoStore(badRequest(validated.error), ctx.requestId);
    }

    const client = await prisma.client.create({
      data: {
        businessId: ctx.businessId,
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
            ? { create: validated.tagIds.map((id) => ({ referenceId: id })) }
            : undefined,
      },
      include: {
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
      },
    });

    return jsonbCreated({ item: flattenClient(client) }, ctx.requestId);
  }
);
