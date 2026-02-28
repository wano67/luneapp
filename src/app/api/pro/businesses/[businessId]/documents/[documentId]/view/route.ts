import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { readLocalFile } from '@/server/storage/local';

// GET /api/pro/businesses/:businessId/documents/:documentId/view
export const GET = withBusinessRoute<{ businessId: string; documentId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const documentId = parseId(params.documentId);

    const doc = await prisma.businessDocument.findFirst({
      where: { id: documentId, businessId: ctx.businessId },
    });
    if (!doc) return notFound('Document introuvable.');

    try {
      const fileBuffer = await readLocalFile(doc.storageKey);
      const res = new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': doc.mimeType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(doc.filename)}"`,
        },
      });
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    } catch {
      return notFound('Fichier introuvable.');
    }
  }
);
