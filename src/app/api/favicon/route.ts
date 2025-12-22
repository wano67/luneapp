import { NextRequest, NextResponse } from 'next/server';
import { getRequestId } from '@/server/http/apiUtils';
import { normalizeWebsiteUrl } from '@/lib/website';

function buildJson(body: unknown, status: number, requestId: string) {
  const res = NextResponse.json(body, { status });
  res.headers.set('x-request-id', requestId);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

async function fetchFavicon(url: string) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') ?? 'image/x-icon';
  const buf = await res.arrayBuffer();
  return { buf, contentType, headers: res.headers };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const urlParam = request.nextUrl.searchParams.get('url');
  const normalized = normalizeWebsiteUrl(urlParam);
  const target = normalized.value;

  if (!target) {
    return buildJson({ error: 'url requis' }, 400, requestId);
  }

  let host: string;
  try {
    host = new URL(target).host;
  } catch {
    return buildJson({ error: 'url invalide' }, 400, requestId);
  }

  const candidates = [
    `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`,
    `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(target)}`,
    `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(target)}&size=64`,
    `https://${host}/favicon.ico`,
  ];

  for (const candidate of candidates) {
    try {
      const hit = await fetchFavicon(candidate);
      if (hit) {
        const res = new NextResponse(Buffer.from(hit.buf), {
          status: 200,
          headers: {
            'Content-Type': hit.contentType,
            'Cache-Control': 'public, max-age=86400',
            'x-request-id': requestId,
          },
        });
        return res;
      }
    } catch {
      // continue to next candidate
    }
  }

  const empty = new NextResponse(null, { status: 204 });
  empty.headers.set('Cache-Control', 'public, max-age=3600');
  empty.headers.set('x-request-id', requestId);
  return empty;
}
