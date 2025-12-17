import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { badRequest, forbidden, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> }
) {
  const requestId = getRequestId(request);
  try {
    let userId: string;
    try {
      ({ userId } = await requireAuthPro(request));
    } catch {
      return withRequestId(unauthorized(), requestId);
    }

    const { businessId, clientId } = await context.params;
    const businessIdBigInt = parseId(businessId);
    const clientIdBigInt = parseId(clientId);
    if (!businessIdBigInt || !clientIdBigInt) {
      return withRequestId(badRequest('Paramètres invalides.'), requestId);
    }

    const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
    if (!business) {
      return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
    }

    const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
    if (!membership) return withRequestId(forbidden(), requestId);

    const client = await prisma.client.findFirst({
      where: { id: clientIdBigInt, businessId: businessIdBigInt },
    });
    if (!client) {
      return withRequestId(NextResponse.json({ error: 'Client introuvable.' }, { status: 404 }), requestId);
    }

    return jsonNoStore({
      id: client.id.toString(),
      businessId: client.businessId.toString(),
      name: client.name,
      email: client.email,
      phone: client.phone,
      notes: client.notes,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error({ err, route: '/api/pro/businesses/[businessId]/clients/[clientId]' });
    return withRequestId(NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }), requestId);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> }
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

  const { businessId, clientId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const clientIdBigInt = parseId(clientId);
  if (!businessIdBigInt || !clientIdBigInt) {
    return withRequestId(badRequest('Paramètres invalides.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withRequestId(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  if ('name' in body) {
    const name = normalizeStr((body as { name?: unknown }).name);
    if (!name) return withRequestId(badRequest('Le nom est requis.'), requestId);
    if (name.length > 120) {
      return withRequestId(badRequest('Le nom est trop long (max 120).'), requestId);
    }
    data.name = name;
  }

  if ('email' in body) {
    const emailRaw = normalizeStr((body as { email?: unknown }).email);
    if (emailRaw && (emailRaw.length > 254 || !isValidEmail(emailRaw))) {
      return withRequestId(badRequest('Email invalide.'), requestId);
    }
    data.email = emailRaw || null;
  }

  if ('phone' in body) {
    const phoneRaw = sanitizePhone((body as { phone?: unknown }).phone);
    if (phoneRaw && (phoneRaw.length > 32 || !isValidPhone(phoneRaw))) {
      return withRequestId(badRequest('Téléphone invalide.'), requestId);
    }
    data.phone = phoneRaw || null;
  }

  if ('notes' in body) {
    const notesRaw = normalizeStr((body as { notes?: unknown }).notes);
    if (notesRaw && notesRaw.length > 2000) {
      return withRequestId(badRequest('Notes trop longues (max 2000).'), requestId);
    }
    data.notes = notesRaw || null;
  }

  if (Object.keys(data).length === 0) {
    return withRequestId(badRequest('Aucun champ à mettre à jour.'), requestId);
  }

  const updated = await prisma.client.updateMany({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
    data,
  });

  if (updated.count === 0) {
    return withRequestId(NextResponse.json({ error: 'Client introuvable.' }, { status: 404 }), requestId);
  }

  const client = await prisma.client.findFirst({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
  });

  return jsonNoStore({
    id: client!.id.toString(),
    businessId: client!.businessId.toString(),
    name: client!.name,
    email: client!.email,
    phone: client!.phone,
    notes: client!.notes,
    createdAt: client!.createdAt.toISOString(),
    updatedAt: client!.updatedAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> }
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

  const { businessId, clientId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const clientIdBigInt = parseId(clientId);
  if (!businessIdBigInt || !clientIdBigInt) {
    return withRequestId(badRequest('Paramètres invalides.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

  const deleted = await prisma.client.deleteMany({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
  });

  if (deleted.count === 0) {
    return withRequestId(NextResponse.json({ error: 'Client introuvable.' }, { status: 404 }), requestId);
  }

  return NextResponse.json({ deleted: deleted.count });
}
