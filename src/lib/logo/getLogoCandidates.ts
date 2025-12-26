import { normalizeWebsiteUrl } from '@/lib/website';

const FETCH_TIMEOUT_MS = 4000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function withTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function resolveUrl(href: string, base: URL) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function pickBaseHref(html: string, baseUrl: URL) {
  const baseMatch = html.match(/<base\s+[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (!baseMatch) return baseUrl;
  const resolved = resolveUrl(baseMatch[1], baseUrl);
  if (!resolved) return baseUrl;
  try {
    return new URL(resolved);
  } catch {
    return baseUrl;
  }
}

function extractLinkIcons(html: string, base: URL) {
  const out: string[] = [];
  const linkRe = /<link\s+([^>]*?)>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const attrs = match[1];
    const relMatch = attrs.match(/\brel=["']([^"']+)["']/i);
    if (!relMatch) continue;
    const rel = relMatch[1].toLowerCase();
    if (!/icon|apple-touch-icon|mask-icon/.test(rel)) continue;
    const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    const resolved = resolveUrl(href, base);
    if (resolved) out.push(resolved);
  }
  return out;
}

function extractOgImage(html: string, base: URL) {
  const ogMatch = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (!ogMatch) return null;
  return resolveUrl(ogMatch[1], base);
}

async function extractManifestIcons(html: string, base: URL) {
  const manifestMatch = html.match(/<link\s+[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (!manifestMatch) return [];
  const href = resolveUrl(manifestMatch[1], base);
  if (!href) return [];
  try {
    const res = await withTimeout(
      href,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'application/manifest+json,application/json;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      },
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) return [];
    const text = await res.text();
    const json = JSON.parse(text) as { icons?: Array<{ src?: string; sizes?: string; type?: string }> };
    const icons = json.icons ?? [];
    const sorted = icons
      .map((icon) => ({
        ...icon,
        src: icon.src ? resolveUrl(icon.src, new URL(href)) : null,
        size: icon.sizes?.split(/\s+/)[0],
      }))
      .filter((i) => i.src)
      .sort((a, b) => {
        const sizeA = Number.parseInt(a.size?.split('x')[0] ?? '0', 10) || 0;
        const sizeB = Number.parseInt(b.size?.split('x')[0] ?? '0', 10) || 0;
        return sizeB - sizeA;
      });
    return sorted.map((i) => i.src!) as string[];
  } catch {
    return [];
  }
}

export async function getLogoCandidates(rawUrl: string): Promise<string[]> {
  const normalized = normalizeWebsiteUrl(rawUrl).value;
  if (!normalized) return [];

  let baseUrl: URL;
  try {
    baseUrl = new URL(normalized);
  } catch {
    return [];
  }

  const homepage = `${baseUrl.origin}/`;
  const candidates: string[] = [];
  let html: string | null = null;
  try {
    const res = await withTimeout(
      homepage,
      {
        headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8' },
        redirect: 'follow',
      },
      FETCH_TIMEOUT_MS
    );
    if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) {
      html = await res.text();
      const baseForPage = pickBaseHref(html, new URL(res.url || homepage));
      candidates.push(...extractLinkIcons(html, baseForPage));
      const og = extractOgImage(html, baseForPage);
      if (og) candidates.push(og);
      const manifestIcons = await extractManifestIcons(html, baseForPage);
      candidates.push(...manifestIcons);
    }
  } catch {
    // ignore html fetch errors
  }

  const commonPaths = [
    '/assets/logo.svg',
    '/assets/fief-logo.svg',
    '/logo.svg',
    '/logo.png',
    '/favicon.svg',
    '/favicon.ico',
  ];
  for (const path of commonPaths) {
    candidates.push(new URL(path, homepage).toString());
  }

  const unique = Array.from(new Set(candidates));
  return unique;
}
