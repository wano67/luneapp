import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// PATCH /api/pro/businesses/:businessId/projects/:projectId/documents/:documentId/move
// Move a document to a folder (or to root if folderId is null)
export const PATCH = withBusinessRoute<{ businessId: string; projectId: string; documentId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const projectId = parseId(params.projectId);
    const documentId = parseId(params.documentId);

    const doc = await prisma.businessDocument.findFirst({
      where: { id: documentId, businessId: ctx.businessId, projectId },
      select: { id: true },
    });
    if (!doc) return notFound('Document introuvable.');

    const body = await readJson(req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    if (!Object.prototype.hasOwnProperty.call(body, 'folderId')) {
      return badRequest('folderId est requis.');
    }

    let folderId: bigint | null = null;

    if (body.folderId !== null) {
      const folderIdRaw = typeof body.folderId === 'string' ? body.folderId : String(body.folderId);
      folderId = parseId(folderIdRaw);

      const folder = await prisma.documentFolder.findFirst({
        where: { id: folderId, businessId: ctx.businessId, projectId },
        select: { id: true },
      });
      if (!folder) return badRequest('Dossier introuvable.');
    }

    const updated = await prisma.businessDocument.update({
      where: { id: documentId },
      data: { folderId },
      select: {
        id: true,
        title: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        kind: true,
        folderId: true,
        createdAt: true,
      },
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);
