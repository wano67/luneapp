import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { ProcessStatus } from '@/generated/prisma';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { ensureDelegates } from '@/server/http/delegates';

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

function serializeStep(step: {
  id: bigint;
  processId: bigint;
  title: string;
  description: string | null;
  position: number;
  isDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: step.id.toString(),
    processId: step.processId.toString(),
    title: step.title,
    description: step.description,
    position: step.position,
    isDone: step.isDone,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString(),
  };
}

// POST /api/pro/businesses/{businessId}/processes/{processId}/steps
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; processId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, processId } = await context.params;

  const businessIdBigInt = parseId(businessId);
  const processIdBigInt = parseId(processId);
  if (!businessIdBigInt || !processIdBigInt) {
    return withIdNoStore(badRequest('businessId ou processId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureDelegates(['process', 'processStep'], requestId);
  if (delegateError) return delegateError;

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:processes:steps:create:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const process = await prisma.process.findFirst({
    where: { id: processIdBigInt, businessId: businessIdBigInt },
    select: { id: true, status: true },
  });
  if (!process) return withIdNoStore(notFound('Process introuvable.'), requestId);
  if (process.status === ProcessStatus.ARCHIVED) {
    return withIdNoStore(badRequest('Process archivé : déverrouillez-le avant modification.'), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const { title, description, position, isDone } = body as {
    title?: unknown;
    description?: unknown;
    position?: unknown;
    isDone?: unknown;
  };

  if (typeof title !== 'string') {
    return withIdNoStore(badRequest('title requis.'), requestId);
  }
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return withIdNoStore(badRequest('title ne peut pas être vide.'), requestId);
  }
  if (trimmedTitle.length > 200) {
    return withIdNoStore(badRequest('title trop long (200 max).'), requestId);
  }

  let descriptionValue: string | null | undefined;
  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return withIdNoStore(badRequest('description invalide.'), requestId);
    }
    descriptionValue =
      description === null
        ? null
        : typeof description === 'string'
          ? description.trim()
          : undefined;
    if (descriptionValue && descriptionValue.length > 2000) {
      return withIdNoStore(badRequest('description trop longue (2000 max).'), requestId);
    }
  }

  let positionValue: number | null = null;
  if (position !== undefined) {
    if (typeof position !== 'number' || !Number.isInteger(position)) {
      return withIdNoStore(badRequest('position doit être un entier.'), requestId);
    }
    if (position < 0 || position > 10000) {
      return withIdNoStore(badRequest('position hors bornes (0-10000).'), requestId);
    }
    positionValue = position;
  }

  if (isDone !== undefined && typeof isDone !== 'boolean') {
    return withIdNoStore(badRequest('isDone doit être un booléen.'), requestId);
  }

  let nextPosition = positionValue;
  if (nextPosition === null) {
    const last = await prisma.processStep.findFirst({
      where: { processId: processIdBigInt },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    nextPosition = (last?.position ?? 0) + 1;
  }

  const step = await prisma.processStep.create({
    data: {
      processId: processIdBigInt,
      title: trimmedTitle,
      description: descriptionValue ?? undefined,
      position: nextPosition,
      ...(typeof isDone === 'boolean' ? { isDone } : {}),
    },
  });

  return withIdNoStore(jsonNoStore({ item: serializeStep(step) }, { status: 201 }), requestId);
}
