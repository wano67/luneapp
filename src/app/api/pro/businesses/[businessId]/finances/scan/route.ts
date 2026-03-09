import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { extractFromDocument, isAllowedMediaType } from '@/server/services/ocr';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// POST /api/pro/businesses/{businessId}/finances/scan
export const POST = withBusinessRoute<{ businessId: string }>(
  { minRole: 'MEMBER', rateLimit: { key: (ctx) => `finance-scan:${ctx.businessId}`, limit: 30, windowMs: 3_600_000 } },
  async (ctx, request) => {
    const { requestId } = ctx;

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return badRequest('Fichier requis.');
    }

    if (file.size > MAX_FILE_BYTES) {
      return badRequest('Fichier trop volumineux (max 10 Mo).');
    }

    const mime = file.type;
    if (!isAllowedMediaType(mime)) {
      return badRequest('Type de fichier non supporté. Formats acceptés : PDF, PNG, JPEG, WEBP, GIF.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractFromDocument(buffer, mime);

    if (!extracted) {
      return badRequest('Impossible d\'extraire les données du document. Vérifiez que le fichier est lisible.');
    }

    return jsonb({ extracted }, requestId);
  }
);
