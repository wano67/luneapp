import { NextRequest, NextResponse } from 'next/server';
import { getRequestId } from '@/server/http/apiUtils';
import { normalizeWebsiteUrl } from '@/lib/website';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function buildJson(body: unknown, status: number, requestId: string) {
  const res = NextResponse.json(body, { status });
  res.headers.set('x-request-id', requestId);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

async function fetchBuffer(url: string, accept: string) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      Accept: accept,
    },
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return { res, buf };
}

async function fetchFavicon(url: string) {
  const hit = await fetchBuffer(url, 'image/*,*/*;q=0.8');
  if (!hit) return null;
  const contentType = hit.res.headers.get('content-type') ?? 'image/x-icon';
  if (!contentType.startsWith('image/') && !contentType.includes('svg')) return null;
  return { buf: hit.buf, contentType };
}

function resolveUrl(href: string, base: URL) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractIconLinks(html: string, base: URL) {
  const links: string[] = [];
  const linkRe = /<link\s+[^>]*rel=["']([^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const rel = match[1]?.toLowerCase() || '';
    const href = match[2];
    if (!href) continue;
    if (rel.includes('icon')) {
      const resolved = resolveUrl(href, base);
      if (resolved) links.push(resolved);
    }
  }
  return links;
}

async function extractManifestIcons(html: string, base: URL) {
  const manifestRe = /<link\s+[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["'][^>]*>/i;
  const match = manifestRe.exec(html);
  if (!match) return [];
  const href = match[1];
  const manifestUrl = resolveUrl(href, base);
  if (!manifestUrl) return [];
  try {
    const manifestHit = await fetchBuffer(manifestUrl, 'application/manifest+json,application/json;q=0.9,*/*;q=0.8');
    if (!manifestHit) return [];
    const text = Buffer.from(manifestHit.buf).toString('utf-8');
    const json = JSON.parse(text) as { icons?: Array<{ src?: string; sizes?: string; type?: string }> };
    const icons = json.icons ?? [];
    const sorted = icons
      .map((i) => ({ ...i, src: i.src ? resolveUrl(i.src, new URL(manifestUrl)) : null }))
      .filter((i) => i.src)
      .sort((a, b) => {
        const sizeA = a.sizes?.split(/\s+/)[0]?.split('x')[0];
        const sizeB = b.sizes?.split(/\s+/)[0]?.split('x')[0];
        const nA = sizeA ? parseInt(sizeA, 10) || 0 : 0;
        const nB = sizeB ? parseInt(sizeB, 10) || 0 : 0;
        return nB - nA;
      });
    return sorted.map((i) => i.src!) as string[];
  } catch {
    return [];
  }
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
  let baseUrl: URL;
  try {
    baseUrl = new URL(target);
    host = baseUrl.host;
  } catch {
    return buildJson({ error: 'url invalide' }, 400, requestId);
  }

  const candidates = new Set<string>([
    `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`,
    `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(target)}`,
    `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(target)}&size=64`,
    `https://${host}/favicon.ico`,
    `http://${host}/favicon.ico`,
  ]);

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

  // Try to inspect HTML for <link rel="icon"> or manifest icons
  try {
    const pageHit =
      (await fetchBuffer(baseUrl.toString(), 'text/html,*/*;q=0.8')) ??
      (await fetchBuffer(`http://${host}`, 'text/html,*/*;q=0.8'));
    if (pageHit) {
      const html = Buffer.from(pageHit.buf).toString('utf-8');
      const baseForPage = new URL(pageHit.res.url ?? baseUrl.toString());
      for (const linkHref of extractIconLinks(html, baseForPage)) {
        const hit = await fetchFavicon(linkHref);
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
      }

      const manifestIcons = await extractManifestIcons(html, baseForPage);
      for (const iconUrl of manifestIcons) {
        const hit = await fetchFavicon(iconUrl);
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
      }
    }
  } catch {
    // ignore parsing errors
  }

  const empty = new NextResponse(null, { status: 204 });
  empty.headers.set('Cache-Control', 'no-store');
  empty.headers.set('Pragma', 'no-cache');
  empty.headers.set('Expires', '0');
  empty.headers.set('x-request-id', requestId);
  return empty;
}
