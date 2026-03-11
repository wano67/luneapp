import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { encrypt, decrypt } from '@/server/crypto/encryption';

function parseIdOpt(param: string | undefined | null): bigint | null {
  if (!param || !/^\d+$/.test(param)) return null;
  try { return BigInt(param); } catch { return null; }
}

// GET /api/pro/businesses/{businessId}/vault/{itemId}
// Returns decrypted password (reveal)
export const GET = withBusinessRoute<{ businessId: string; itemId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: { key: (ctx) => `pro:vault:reveal:${ctx.businessId}:${ctx.userId}`, limit: 200, windowMs: 3_600_000 },
  },
  async (ctx, _req, params) => {
    const itemId = parseIdOpt(params?.itemId);
    if (!itemId) return badRequest('itemId invalide.');

    const item = await prisma.vaultItem.findFirst({
      where: { id: itemId, businessId: ctx.businessId },
    });
    if (!item) return notFound('Entrée introuvable.');

    let password: string;
    try {
      password = decrypt(item.ciphertext, item.iv, item.tag);
    } catch {
      password = '';
    }

    return jsonb({
      item: {
        id: item.id,
        businessId: item.businessId,
        projectId: item.projectId,
        title: item.title,
        identifier: item.identifier,
        email: item.email,
        password,
        note: item.note,
        createdByUserId: item.createdByUserId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    }, ctx.requestId);
  }
);

// PATCH /api/pro/businesses/{businessId}/vault/{itemId}
export const PATCH = withBusinessRoute<{ businessId: string; itemId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:vault:update:${ctx.businessId}:${ctx.userId}`, limit: 100, windowMs: 3_600_000 },
  },
  async (ctx, req, params) => {
    const itemId = parseIdOpt(params?.itemId);
    if (!itemId) return badRequest('itemId invalide.');

    const existing = await prisma.vaultItem.findFirst({
      where: { id: itemId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!existing) return notFound('Entrée introuvable.');

    const body = await readJson(req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const data: Record<string, unknown> = {};

    if ('title' in body) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return badRequest('Titre requis.');
      if (title.length > 200) return badRequest('Titre trop long (200 max).');
      data.title = title;
    }
    if ('identifier' in body) {
      data.identifier = typeof body.identifier === 'string' ? body.identifier.trim() || null : null;
    }
    if ('email' in body) {
      data.email = typeof body.email === 'string' ? body.email.trim() || null : null;
    }
    if ('note' in body) {
      data.note = typeof body.note === 'string' ? body.note.trim() || null : null;
    }
    if ('password' in body) {
      const password = typeof body.password === 'string' ? body.password : '';
      if (!password) return badRequest('Mot de passe requis.');
      if (password.length > 5000) return badRequest('Mot de passe trop long.');
      const encrypted = encrypt(password);
      data.ciphertext = encrypted.ciphertext;
      data.iv = encrypted.iv;
      data.tag = encrypted.tag;
    }

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.vaultItem.update({
      where: { id: itemId },
      data,
    });

    return jsonb({
      item: {
        id: updated.id,
        businessId: updated.businessId,
        projectId: updated.projectId,
        title: updated.title,
        identifier: updated.identifier,
        email: updated.email,
        note: updated.note,
        createdByUserId: updated.createdByUserId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/vault/{itemId}
export const DELETE = withBusinessRoute<{ businessId: string; itemId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:vault:delete:${ctx.businessId}:${ctx.userId}`, limit: 50, windowMs: 3_600_000 },
  },
  async (ctx, _req, params) => {
    const itemId = parseIdOpt(params?.itemId);
    if (!itemId) return badRequest('itemId invalide.');

    const existing = await prisma.vaultItem.findFirst({
      where: { id: itemId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!existing) return notFound('Entrée introuvable.');

    await prisma.vaultItem.delete({ where: { id: itemId } });

    return jsonbNoContent(ctx.requestId);
  }
);
