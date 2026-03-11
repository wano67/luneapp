import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { readLocalFile } from '@/server/storage/local';

// GET /api/pro/businesses/:businessId/attachments/:attachmentId/download
export const GET = withBusinessRoute<{ businessId: string; attachmentId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const attachmentId = parseId(params.attachmentId);

    const att = await prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            conversation: { select: { businessId: true } },
          },
        },
      },
    });
    if (!att) return notFound('Pièce jointe introuvable.');

    // Verify the attachment belongs to a conversation in this business
    if (att.message.conversation.businessId !== ctx.businessId) {
      return notFound('Pièce jointe introuvable.');
    }

    try {
      const fileBuffer = await readLocalFile(att.storageKey);
      const res = new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': att.mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename)}"`,
          'Content-Length': att.sizeBytes.toString(),
        },
      });
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    } catch {
      return notFound('Fichier introuvable.');
    }
  }
);
