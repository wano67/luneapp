import { prisma } from '@/server/db/client';
import { AccountantAccessLevel } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

function serialize(a: {
  id: bigint; businessId: bigint; accountantUserId: bigint; token: string;
  accessLevel: string; expiresAt: Date | null; revokedAt: Date | null;
  lastAccessAt: Date | null; createdAt: Date;
  accountant?: { firstName: string | null; lastName: string | null; email: string } | null;
}) {
  return {
    id: a.id.toString(),
    accountantUserId: a.accountantUserId.toString(),
    token: a.token,
    accessLevel: a.accessLevel,
    accountantName: a.accountant ? `${a.accountant.firstName ?? ''} ${a.accountant.lastName ?? ''}`.trim() || a.accountant.email : null,
    accountantEmail: a.accountant?.email ?? null,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    revokedAt: a.revokedAt?.toISOString() ?? null,
    lastAccessAt: a.lastAccessAt?.toISOString() ?? null,
    portalUrl: `/accountant/${a.token}`,
    createdAt: a.createdAt.toISOString(),
  };
}

const include = {
  accountant: { select: { firstName: true, lastName: true, email: true } },
} as const;

const VALID_LEVELS = Object.values(AccountantAccessLevel);

// GET /api/pro/businesses/{businessId}/accountant-access
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'OWNER' },
  async (ctx) => {
    const items = await prisma.accountantAccess.findMany({
      where: { businessId: ctx.businessId },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/accountant-access
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'OWNER',
    rateLimit: {
      key: (ctx) => `pro:accountant:create:${ctx.businessId}:${ctx.userId}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const { accountantUserId, accessLevel, expiresAt } = body as Record<string, unknown>;

    const uid = parseIdOpt(accountantUserId as string);
    if (!uid) return badRequest('accountantUserId requis.');

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
    if (!user) return badRequest('Utilisateur introuvable.');

    const level = VALID_LEVELS.includes(accessLevel as AccountantAccessLevel)
      ? (accessLevel as AccountantAccessLevel)
      : AccountantAccessLevel.READ_ONLY;

    // Check unique constraint
    const existing = await prisma.accountantAccess.findUnique({
      where: { businessId_accountantUserId: { businessId: ctx.businessId, accountantUserId: uid } },
    });
    if (existing) return badRequest('Cet expert-comptable a déjà un accès.');

    const item = await prisma.accountantAccess.create({
      data: {
        businessId: ctx.businessId,
        accountantUserId: uid,
        accessLevel: level,
        expiresAt: typeof expiresAt === 'string' ? new Date(expiresAt) : null,
      },
      include,
    });

    return jsonbCreated({ item: serialize(item) }, ctx.requestId);
  },
);
