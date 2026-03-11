import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { encrypt } from '@/server/crypto/encryption';

function parseIdOpt(param: string | undefined | null): bigint | null {
  if (!param || !/^\d+$/.test(param)) return null;
  try { return BigInt(param); } catch { return null; }
}

// GET /api/pro/businesses/{businessId}/vault
// ?projectId=X → project-level items
// no projectId → business-level items (projectId IS NULL)
// ?scope=all → all items (both business + project level)
export const GET = withBusinessRoute(
  {
    minRole: 'MEMBER',
    rateLimit: { key: (ctx) => `pro:vault:list:${ctx.businessId}:${ctx.userId}`, limit: 200, windowMs: 3_600_000 },
  },
  async (ctx, req) => {
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope');
    const projectIdParam = url.searchParams.get('projectId');
    const projectId = parseIdOpt(projectIdParam);

    const where: Record<string, unknown> = { businessId: ctx.businessId };
    if (scope === 'all') {
      // Return all vault items (business + project level)
    } else if (projectId) {
      where.projectId = projectId;
    } else {
      where.projectId = null; // business-level items only
    }

    const items = await prisma.vaultItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        businessId: true,
        projectId: true,
        title: true,
        identifier: true,
        email: true,
        note: true,
        createdByUserId: true,
        createdAt: true,
        updatedAt: true,
        // Do NOT select ciphertext/iv/tag — password is only revealed via GET /vault/[itemId]
      },
    });

    return jsonb({ items }, ctx.requestId);
  }
);

// POST /api/pro/businesses/{businessId}/vault
export const POST = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:vault:create:${ctx.businessId}:${ctx.userId}`, limit: 100, windowMs: 3_600_000 },
  },
  async (ctx, req) => {
    const body = await readJson(req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return badRequest('Titre requis.');
    if (title.length > 200) return badRequest('Titre trop long (200 max).');

    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) return badRequest('Mot de passe requis.');
    if (password.length > 5000) return badRequest('Mot de passe trop long.');

    const identifier = typeof body.identifier === 'string' ? body.identifier.trim() || null : null;
    const email = typeof body.email === 'string' ? body.email.trim() || null : null;
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;
    const projectIdStr = typeof body.projectId === 'string' ? body.projectId : null;
    const projectId = parseIdOpt(projectIdStr);

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, businessId: ctx.businessId },
        select: { id: true },
      });
      if (!project) return badRequest('Projet introuvable.');
    }

    const encrypted = encrypt(password);

    const created = await prisma.vaultItem.create({
      data: {
        businessId: ctx.businessId,
        projectId,
        title,
        identifier,
        email,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        note,
        createdByUserId: ctx.userId,
      },
    });

    return jsonbCreated({
      item: {
        id: created.id,
        businessId: created.businessId,
        projectId: created.projectId,
        title: created.title,
        identifier: created.identifier,
        email: created.email,
        note: created.note,
        createdByUserId: created.createdByUserId,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    }, ctx.requestId);
  }
);
