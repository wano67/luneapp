import { isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestId } from '@/server/http/apiUtils';
import { normalizeWebsiteUrl } from '@/lib/website';
import { getLogoCandidates } from '@/lib/logo/getLogoCandidates';
import { validateLogoUrl } from '@/lib/logo/validateLogoUrl';

function buildJson(body: unknown, status: number, requestId: string) {
  const res = NextResponse.json(body, { status });
  res.headers.set('x-request-id', requestId);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local')
  ) {
    return true;
  }

  const ipType = isIP(host);
  if (ipType === 4) {
    if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('169.254.')) return true;
    const parts = host.split('.').map((p) => Number.parseInt(p, 10));
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  if (ipType === 6) {
    if (host === '::1' || host === '::' || host.startsWith('fd') || host.startsWith('fc') || host.startsWith('fe80:')) {
      return true;
    }
  }
  return false;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const urlParam = request.nextUrl.searchParams.get('url');
  const normalized = normalizeWebsiteUrl(urlParam);
  const target = normalized.value;

  if (!target) {
    return buildJson({ error: 'url requis' }, 400, requestId);
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(target);
  } catch {
    return buildJson({ error: 'url invalide' }, 400, requestId);
  }

  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    return buildJson({ error: 'Protocol non supporté' }, 400, requestId);
  }

  if (baseUrl.port && baseUrl.port !== '80' && baseUrl.port !== '443') {
    return buildJson({ error: 'Port non autorisé' }, 403, requestId);
  }

  const host = baseUrl.hostname;
  if (isBlockedHost(host)) {
    return buildJson({ error: 'Host non autorisé' }, 403, requestId);
  }

  const scoreMime = (url: string, contentType: string) => {
    const ct = contentType.toLowerCase();
    const u = url.toLowerCase();
    const isSvg = ct.includes('svg') || u.endsWith('.svg');
    const isPng = ct.includes('png') || u.endsWith('.png');
    const isWebp = ct.includes('webp') || u.endsWith('.webp');
    const isJpg = ct.includes('jpeg') || ct.includes('jpg') || u.endsWith('.jpg') || u.endsWith('.jpeg');
    const isGif = ct.includes('gif') || u.endsWith('.gif');
    const isIco = ct.includes('ico') || u.endsWith('.ico');
    if (isSvg) return 6;
    if (isPng) return 5;
    if (isWebp) return 4;
    if (isJpg) return 3;
    if (isGif) return 2;
    if (isIco) return 1;
    return 0;
  };

  const candidates = await getLogoCandidates(target);
  const fallbacks = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`,
    `https://logo.clearbit.com/${encodeURIComponent(host)}`,
  ];

  const sources = [...candidates, ...fallbacks];
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[favicon] candidates', sources);
  }

  let best: { buffer: Uint8Array; contentType: string; score: number; url: string } | null = null;

  for (const candidate of sources) {
    const hit = await validateLogoUrl(candidate);
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[favicon] candidate', candidate, hit.ok ? 'ok' : 'fail', hit.ok ? hit.contentType : '');
    }
    if (hit.ok) {
      const score = scoreMime(candidate, hit.contentType || '');
      if (!best || score > best.score) {
        best = { buffer: new Uint8Array(hit.buffer), contentType: hit.contentType || 'image/*', score, url: candidate };
        // Early exit if top score
        if (score === 6) break;
      }
    }
  }

  if (best) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[favicon] picked', best.url, 'ct=', best.contentType, 'score=', best.score);
    }
    return new NextResponse(best.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': best.contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=604800',
        'x-request-id': requestId,
      },
    });
  }

  const empty = new NextResponse(null, { status: 204 });
  empty.headers.set('Cache-Control', 'no-store');
  empty.headers.set('Pragma', 'no-cache');
  empty.headers.set('Expires', '0');
  empty.headers.set('x-request-id', requestId);
  return empty;
}
