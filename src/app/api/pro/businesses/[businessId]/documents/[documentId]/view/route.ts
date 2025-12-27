import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { withNoStore } from '@/server/security/csrf';
import { readLocalFile } from '@/server/storage/local';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

// GET /api/pro/businesses/:businessId/documents/:documentId/view
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; documentId: string }> },
) {
  const requestId = getRequestId(request);
  const { businessId, documentId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const documentIdBigInt = parseId(documentId);
  if (!businessIdBigInt || !documentIdBigInt) return withIdNoStore(badRequest('Paramètres invalides.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const doc = await prisma.businessDocument.findFirst({
    where: { id: documentIdBigInt, businessId: businessIdBigInt },
  });
  if (!doc) return withIdNoStore(notFound('Document introuvable.'), requestId);

  try {
    const fileBuffer = await readLocalFile(doc.storageKey);
    return withIdNoStore(
      new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': doc.mimeType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(doc.filename)}"`,
        },
      }),
      requestId,
    );
  } catch {
    return withIdNoStore(notFound('Fichier introuvable.'), requestId);
  }
}
