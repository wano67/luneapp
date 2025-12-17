import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) {
    return null;
  }
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function normalizeStr(v: unknown) {
  return String(v ?? '').trim();
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function sanitizePhone(s: unknown) {
  return normalizeStr(s).replace(/\s+/g, ' ');
}

function isValidPhone(s: string) {
  if (!s) return false;
  if (!/^[\d+\-().\s]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

// GET /api/pro/businesses/{businessId}/clients
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withRequestId(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return forbidden();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim();

  const clients = await prisma.client.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(search
        ? {
            name: { contains: search, mode: 'insensitive' },
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  });

  return jsonNoStore({
    items: clients.map((c) => ({
      id: c.id.toString(),
      businessId: c.businessId.toString(),
      name: c.name,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

// POST /api/pro/businesses/{businessId}/clients
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withRequestId(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const limited = rateLimit(request, {
    key: `pro:clients:create:${businessIdBigInt}:${userId.toString()}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.name !== 'string') {
    return withRequestId(badRequest('Le nom du client est requis.'), requestId);
  }

  const name = normalizeStr(body.name);
  if (!name) return withRequestId(badRequest('Le nom du client ne peut pas être vide.'), requestId);
  if (name.length > 120) {
    return withRequestId(badRequest('Le nom du client est trop long (max 120).'), requestId);
  }

  const emailRaw = normalizeStr(typeof body.email === 'string' ? body.email : '');
  const email = emailRaw ? emailRaw : undefined;
  if (email && (email.length > 254 || !isValidEmail(email))) {
    return withRequestId(badRequest('Email invalide.'), requestId);
  }

  const phoneRaw = sanitizePhone(typeof body.phone === 'string' ? body.phone : '');
  const phone = phoneRaw ? phoneRaw : undefined;
  if (phone && (phone.length > 32 || !isValidPhone(phone))) {
    return withRequestId(badRequest('Téléphone invalide.'), requestId);
  }

  const notesRaw = normalizeStr(typeof body.notes === 'string' ? body.notes : '');
  const notes = notesRaw ? notesRaw : undefined;
  if (notes && notes.length > 2000) {
    return withRequestId(badRequest('Notes trop longues (max 2000).'), requestId);
  }

  const client = await prisma.client.create({
    data: {
      businessId: businessIdBigInt,
      name,
      email,
      phone,
      notes,
    },
  });

  return NextResponse.json(
    {
      id: client.id.toString(),
      businessId: client.businessId.toString(),
      name: client.name,
      email: client.email,
      phone: client.phone,
      notes: client.notes,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
