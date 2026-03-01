import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbNoContent } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { readLocalFile, deleteLocalFile } from '@/server/storage/local';

// GET /api/pro/businesses/:businessId/projects/:projectId/documents/:documentId
// Stream the file content for download
export const GET = withBusinessRoute<{ businessId: string; projectId: string; documentId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);
    const documentId = parseId(params.documentId);

    const doc = await prisma.businessDocument.findFirst({
      where: { id: documentId, businessId: ctx.businessId, projectId },
    });
    if (!doc) return notFound('Document introuvable.');

    const buffer = await readLocalFile(doc.storageKey);
    const res = new NextResponse(buffer, { status: 200 });
    res.headers.set('Content-Type', doc.mimeType);
    res.headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`);
    res.headers.set('Content-Length', String(buffer.length));
    res.headers.set('x-request-id', ctx.requestId);
    return res;
  }
);

// DELETE /api/pro/businesses/:businessId/projects/:projectId/documents/:documentId
export const DELETE = withBusinessRoute<{ businessId: string; projectId: string; documentId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:project-docs:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);
    const documentId = parseId(params.documentId);

    const doc = await prisma.businessDocument.findFirst({
      where: { id: documentId, businessId: ctx.businessId, projectId },
    });
    if (!doc) return notFound('Document introuvable.');

    await deleteLocalFile(doc.storageKey);
    await prisma.businessDocument.delete({ where: { id: documentId } });

    return jsonbNoContent(ctx.requestId);
  }
);
