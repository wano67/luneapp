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

type SerializableStep = {
  id: string;
  processId: string;
  title: string;
  description: string | null;
  position: number;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
};

type SerializableProcess = {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  status: ProcessStatus;
  createdAt: string;
  updatedAt: string;
  steps: SerializableStep[];
};

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

function ensureProcessDelegate(requestId: string) {
  if (!(prisma as { process?: unknown }).process) {
    return withIdNoStore(
      NextResponse.json(
        { error: 'Prisma client not generated / wrong import (process delegate absent).' },
        { status: 500 }
      ),
      requestId
    );
  }
  return null;
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
}): SerializableStep {
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

function serializeProcess(process: {
  id: bigint;
  businessId: bigint;
  name: string;
  description: string | null;
  status: ProcessStatus;
  createdAt: Date;
  updatedAt: Date;
  steps: Array<{
    id: bigint;
    processId: bigint;
    title: string;
    description: string | null;
    position: number;
    isDone: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): SerializableProcess {
  return {
    id: process.id.toString(),
    businessId: process.businessId.toString(),
    name: process.name,
    description: process.description,
    status: process.status,
    createdAt: process.createdAt.toISOString(),
    updatedAt: process.updatedAt.toISOString(),
    steps: process.steps.map(serializeStep),
  };
}

async function fetchProcessWithSteps(processId: bigint, businessId: bigint) {
  return prisma.process.findFirst({
    where: { id: processId, businessId },
    include: {
      steps: { orderBy: { position: 'asc' } },
    },
  });
}

// GET /api/pro/businesses/{businessId}/processes/{processId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; processId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, processId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureProcessDelegate(requestId);
  if (delegateError) return delegateError;

  const businessIdBigInt = parseId(businessId);
  const processIdBigInt = parseId(processId);
  if (!businessIdBigInt || !processIdBigInt) {
    return withIdNoStore(badRequest('businessId ou processId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const process = await fetchProcessWithSteps(processIdBigInt, businessIdBigInt);
  if (!process) return withIdNoStore(notFound('Process introuvable.'), requestId);

  return withIdNoStore(jsonNoStore({ item: serializeProcess(process) }), requestId);
}

// PATCH /api/pro/businesses/{businessId}/processes/{processId}
export async function PATCH(
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

  const delegateError = ensureProcessDelegate(requestId);
  if (delegateError) return delegateError;

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:processes:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const existing = await fetchProcessWithSteps(processIdBigInt, businessIdBigInt);
  if (!existing) return withIdNoStore(notFound('Process introuvable.'), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const { name, description, status, archived } = body as {
    name?: unknown;
    description?: unknown;
    status?: unknown;
    archived?: unknown;
  };

  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== 'string') {
      return withIdNoStore(badRequest('name invalide.'), requestId);
    }
    const trimmed = name.trim();
    if (!trimmed) return withIdNoStore(badRequest('name ne peut pas être vide.'), requestId);
    if (trimmed.length > 200) {
      return withIdNoStore(badRequest('name trop long (200 max).'), requestId);
    }
    data.name = trimmed;
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

  let statusFromFlag: ProcessStatus | null = null;
  if (archived !== undefined) {
    if (typeof archived !== 'boolean') {
      return withIdNoStore(badRequest('archived doit être un booléen.'), requestId);
    }
    statusFromFlag = archived ? ProcessStatus.ARCHIVED : ProcessStatus.ACTIVE;
  }

  let statusValue: ProcessStatus | null = null;
  if (status !== undefined) {
    if (status === ProcessStatus.ACTIVE || status === 'ACTIVE') {
      statusValue = ProcessStatus.ACTIVE;
    } else if (status === ProcessStatus.ARCHIVED || status === 'ARCHIVED') {
      statusValue = ProcessStatus.ARCHIVED;
    } else {
      return withIdNoStore(badRequest('status invalide.'), requestId);
    }
    if (statusFromFlag && statusValue && statusFromFlag !== statusValue) {
      return withIdNoStore(badRequest('archived et status incohérents.'), requestId);
    }
    data.status = statusValue;
  } else if (statusFromFlag) {
    data.status = statusFromFlag;
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucune modification.'), requestId);
  }

  const updated = await prisma.process.update({
    where: { id: processIdBigInt },
    data,
    include: {
      steps: { orderBy: { position: 'asc' } },
    },
  });

  return withIdNoStore(jsonNoStore({ item: serializeProcess(updated) }), requestId);
}

// DELETE /api/pro/businesses/{businessId}/processes/{processId}
export async function DELETE(
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

  const delegateError = ensureProcessDelegate(requestId);
  if (delegateError) return delegateError;

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:processes:delete:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const process = await prisma.process.findFirst({
    where: { id: processIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!process) return withIdNoStore(notFound('Process introuvable.'), requestId);

  await prisma.process.delete({ where: { id: processIdBigInt } });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
