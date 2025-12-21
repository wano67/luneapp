import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { ProcessStatus } from '@/generated/prisma/client';
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
  steps?: SerializableStep[];
  stepsCount?: number;
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
  steps?: Array<{
    id: bigint;
    processId: bigint;
    title: string;
    description: string | null;
    position: number;
    isDone: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  _count?: { steps: number };
}): SerializableProcess {
  const base: SerializableProcess = {
    id: process.id.toString(),
    businessId: process.businessId.toString(),
    name: process.name,
    description: process.description,
    status: process.status,
    createdAt: process.createdAt.toISOString(),
    updatedAt: process.updatedAt.toISOString(),
  };

  if (process.steps) {
    base.steps = process.steps.map(serializeStep);
  }
  if (process._count) {
    base.stepsCount = process._count.steps;
  }
  return base;
}

// GET /api/pro/businesses/{businessId}/processes
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureProcessDelegate(requestId);
  if (delegateError) return delegateError;

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) return withIdNoStore(notFound('Entreprise introuvable.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const { searchParams } = new URL(request.url);
  const includeArchived =
    searchParams.get('archived') === '1' ||
    searchParams.get('archived') === 'true' ||
    searchParams.get('archived') === 'yes';

  const processes = await prisma.process.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(includeArchived ? {} : { status: ProcessStatus.ACTIVE }),
    },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      _count: { select: { steps: true } },
    },
  });

  return withIdNoStore(jsonNoStore({ items: processes.map(serializeProcess) }), requestId);
}

// POST /api/pro/businesses/{businessId}/processes
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureProcessDelegate(requestId);
  if (delegateError) return delegateError;

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) return withIdNoStore(notFound('Entreprise introuvable.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:processes:create:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const { name, description, steps } = body as {
    name?: unknown;
    description?: unknown;
    steps?: unknown;
  };

  if (typeof name !== 'string') {
    return withIdNoStore(badRequest('name requis.'), requestId);
  }
  const trimmedName = name.trim();
  if (!trimmedName) return withIdNoStore(badRequest('name ne peut pas être vide.'), requestId);
  if (trimmedName.length > 200) {
    return withIdNoStore(badRequest('name trop long (200 max).'), requestId);
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

  let stepsData: Array<{
    title: string;
    description?: string | null;
    position: number;
    isDone?: boolean;
  }> = [];
  if (steps !== undefined) {
    if (!Array.isArray(steps)) {
      return withIdNoStore(badRequest('steps doit être un tableau.'), requestId);
    }
    if (steps.length > 100) {
      return withIdNoStore(badRequest('steps trop nombreux (100 max).'), requestId);
    }
    try {
      stepsData = steps.map((raw, idx) => {
        if (!raw || typeof raw !== 'object') {
          throw new Error(`step #${idx + 1} invalide`);
        }
        const step = raw as { title?: unknown; description?: unknown; position?: unknown; isDone?: unknown };
        if (typeof step.title !== 'string') {
          throw new Error(`title requis pour l’étape #${idx + 1}`);
        }
        const title = step.title.trim();
        if (!title) throw new Error(`title ne peut pas être vide (étape #${idx + 1})`);
        if (title.length > 200) throw new Error(`title trop long (200 max) (étape #${idx + 1})`);

        let descriptionStep: string | null | undefined;
        if (step.description !== undefined) {
          if (step.description !== null && typeof step.description !== 'string') {
            throw new Error(`description invalide (étape #${idx + 1})`);
          }
          descriptionStep =
            step.description === null
              ? null
              : typeof step.description === 'string'
                ? step.description.trim()
                : undefined;
          if (descriptionStep && descriptionStep.length > 2000) {
            throw new Error(`description trop longue (2000 max) (étape #${idx + 1})`);
          }
        }

        let position = idx + 1;
        if (step.position !== undefined) {
          if (typeof step.position !== 'number' || !Number.isInteger(step.position)) {
            throw new Error(`position doit être un entier (étape #${idx + 1})`);
          }
          if (step.position < 0 || step.position > 10000) {
            throw new Error(`position hors bornes (0-10000) (étape #${idx + 1})`);
          }
          position = step.position;
        }

        let isDone: boolean | undefined;
        if (step.isDone !== undefined) {
          if (typeof step.isDone !== 'boolean') {
            throw new Error(`isDone doit être un booléen (étape #${idx + 1})`);
          }
          isDone = step.isDone;
        }

        return {
          title,
          description: descriptionStep ?? undefined,
          position,
          ...(isDone !== undefined ? { isDone } : {}),
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'steps invalides.';
      return withIdNoStore(badRequest(message), requestId);
    }
  }

  let createdProcess;
  try {
    createdProcess = await prisma.process.create({
      data: {
        businessId: businessIdBigInt,
        name: trimmedName,
        description: descriptionValue ?? undefined,
        status: ProcessStatus.ACTIVE,
        ...(stepsData.length ? { steps: { create: stepsData } } : {}),
      },
      include: {
        steps: { orderBy: { position: 'asc' } },
        _count: { select: { steps: true } },
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur création process.';
    return withIdNoStore(badRequest(message), requestId);
  }

  return withIdNoStore(
    jsonNoStore({ item: serializeProcess(createdProcess) }, { status: 201 }),
    requestId
  );
}
