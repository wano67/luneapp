import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// PATCH /api/pro/businesses/:businessId/projects/:projectId/folders/:folderId
// Rename a folder
export const PATCH = withBusinessRoute<{ businessId: string; projectId: string; folderId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const projectId = parseId(params.projectId);
    const folderId = parseId(params.folderId);

    const folder = await prisma.documentFolder.findFirst({
      where: { id: folderId, businessId: ctx.businessId, projectId },
      select: { id: true },
    });
    if (!folder) return notFound('Dossier introuvable.');

    const body = await readJson(req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return badRequest('Le nom du dossier est requis.');
    if (name.length > 100) return badRequest('Le nom du dossier est trop long (max 100 caractères).');

    const updated = await prisma.documentFolder.update({
      where: { id: folderId },
      data: { name },
      select: {
        id: true,
        name: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { children: true, documents: true } },
      },
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/:businessId/projects/:projectId/folders/:folderId
// Delete a folder (cascades to child folders, documents get folderId=null via onDelete:SetNull)
export const DELETE = withBusinessRoute<{ businessId: string; projectId: string; folderId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:folders:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);
    const folderId = parseId(params.folderId);

    const folder = await prisma.documentFolder.findFirst({
      where: { id: folderId, businessId: ctx.businessId, projectId },
      select: { id: true },
    });
    if (!folder) return notFound('Dossier introuvable.');

    await prisma.documentFolder.delete({ where: { id: folderId } });

    return jsonbNoContent(ctx.requestId);
  }
);
