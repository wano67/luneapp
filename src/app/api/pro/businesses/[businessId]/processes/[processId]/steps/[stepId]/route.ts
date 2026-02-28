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

// PATCH /api/pro/businesses/{businessId}/processes/{processId}/steps/{stepId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; processId: string; stepId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, processId, stepId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const processIdBigInt = parseId(processId);
  const stepIdBigInt = parseId(stepId);
  if (!businessIdBigInt || !processIdBigInt || !stepIdBigInt) {
    return withIdNoStore(badRequest('businessId, processId ou stepId invalide.'), requestId);
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
    key: `pro:processes:steps:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const existing = await prisma.processStep.findFirst({
    where: {
      id: stepIdBigInt,
      processId: processIdBigInt,
      process: { businessId: businessIdBigInt },
    },
    include: {
      process: { select: { status: true } },
    },
  });
  if (!existing) return withIdNoStore(notFound('Étape introuvable.'), requestId);
  if (existing.process.status === ProcessStatus.ARCHIVED) {
    return withIdNoStore(
      badRequest('Process archivé : déverrouillez-le avant modification.'),
      requestId
    );
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

  const data: Record<string, unknown> = {};

  if (title !== undefined) {
    if (typeof title !== 'string') {
      return withIdNoStore(badRequest('title invalide.'), requestId);
    }
    const trimmed = title.trim();
    if (!trimmed) return withIdNoStore(badRequest('title ne peut pas être vide.'), requestId);
    if (trimmed.length > 200) {
      return withIdNoStore(badRequest('title trop long (200 max).'), requestId);
    }
    data.title = trimmed;
  }

  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return withIdNoStore(badRequest('description invalide.'), requestId);
    }
    const value =
      description === null ? null : typeof description === 'string' ? description.trim() : undefined;
    if (value && value.length > 2000) {
      return withIdNoStore(badRequest('description trop longue (2000 max).'), requestId);
    }
    data.description = value ?? null;
  }

  if (position !== undefined) {
    if (typeof position !== 'number' || !Number.isInteger(position)) {
      return withIdNoStore(badRequest('position doit être un entier.'), requestId);
    }
    if (position < 0 || position > 10000) {
      return withIdNoStore(badRequest('position hors bornes (0-10000).'), requestId);
    }
    data.position = position;
  }

  if (isDone !== undefined) {
    if (typeof isDone !== 'boolean') {
      return withIdNoStore(badRequest('isDone doit être un booléen.'), requestId);
    }
    data.isDone = isDone;
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucune modification.'), requestId);
  }

  const updated = await prisma.processStep.update({
    where: { id: stepIdBigInt },
    data,
  });

  return withIdNoStore(jsonNoStore({ item: serializeStep(updated) }), requestId);
}

// DELETE /api/pro/businesses/{businessId}/processes/{processId}/steps/{stepId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; processId: string; stepId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, processId, stepId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const processIdBigInt = parseId(processId);
  const stepIdBigInt = parseId(stepId);
  if (!businessIdBigInt || !processIdBigInt || !stepIdBigInt) {
    return withIdNoStore(badRequest('businessId, processId ou stepId invalide.'), requestId);
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
    key: `pro:processes:steps:delete:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const existing = await prisma.processStep.findFirst({
    where: {
      id: stepIdBigInt,
      processId: processIdBigInt,
      process: { businessId: businessIdBigInt },
    },
    include: {
      process: { select: { status: true } },
    },
  });
  if (!existing) return withIdNoStore(notFound('Étape introuvable.'), requestId);
  if (existing.process.status === ProcessStatus.ARCHIVED) {
    return withIdNoStore(
      badRequest('Process archivé : déverrouillez-le avant modification.'),
      requestId
    );
  }

  await prisma.processStep.delete({ where: { id: stepIdBigInt } });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
