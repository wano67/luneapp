import { normalizeWebsiteUrl } from './website';

type LogoHit = { buf: Buffer; contentType: string };

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MAX_CACHE_ENTRIES = 200;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const REQUEST_TIMEOUT_MS = 3000;
const MAX_ICON_BYTES = 500_000;

type CacheEntry = LogoHit & { expires: number };
const memoryCache = new Map<string, CacheEntry>();

function setCache(key: string, value: LogoHit) {
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const first = memoryCache.keys().next().value;
    if (first) memoryCache.delete(first);
  }
  memoryCache.set(key, { ...value, expires: Date.now() + CACHE_TTL_MS });
}

function getCache(key: string): LogoHit | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return hit;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchImage(url: string): Promise<LogoHit | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        redirect: 'follow',
        headers: {
          'User-Agent': UA,
          Accept: 'image/*,*/*;q=0.8',
        },
      },
      REQUEST_TIMEOUT_MS
    );
    if (!res || !res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_ICON_BYTES) return null;
    return { buf, contentType };
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        redirect: 'follow',
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,*/*;q=0.8',
        },
      },
      REQUEST_TIMEOUT_MS
    );
    if (!res || !res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 1_000_000) return null;
    return buf.toString('utf-8');
  } catch {
    return null;
  }
}

function resolveUrl(href: string, base: URL) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractFromHtml(html: string, base: URL): string[] {
  const candidates: string[] = [];
  const linkRe = /<link\s+[^>]*rel=["']([^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  const apple: string[] = [];
  const icons: string[] = [];
  while ((m = linkRe.exec(html)) !== null) {
    const rel = m[1]?.toLowerCase() || '';
    const href = m[2];
    if (!href) continue;
    if (rel.includes('apple-touch-icon')) {
      const resolved = resolveUrl(href, base);
      if (resolved) apple.push(resolved);
    } else if (rel.includes('icon')) {
      const resolved = resolveUrl(href, base);
      if (resolved) icons.push(resolved);
    }
  }

  // og:image
  const ogRe = /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i;
  const ogMatch = ogRe.exec(html);
  const ogUrl = ogMatch ? resolveUrl(ogMatch[1], base) : null;

  candidates.push(...apple, ...icons);
  if (ogUrl) candidates.push(ogUrl);
  return candidates;
}

function domainFromUrl(url: string): { origin: string; host: string } | null {
  try {
    const u = new URL(url);
    return { origin: u.origin, host: u.hostname };
  } catch {
    return null;
  }
}

export async function fetchLogoFromUrl(rawUrl: string): Promise<LogoHit | null> {
  const normalized = normalizeWebsiteUrl(rawUrl).value;
  if (!normalized) return null;

  const domainInfo = domainFromUrl(normalized);
  if (!domainInfo) return null;

  const cacheKey = domainInfo.host;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const homepage = `${domainInfo.origin}/`;
  // Strategy 1: parse homepage links
  const html = await fetchHtml(homepage);
  if (html) {
    const base = new URL(homepage);
    const htmlCandidates = extractFromHtml(html, base);
    for (const candidate of htmlCandidates) {
      const hit = await fetchImage(candidate);
      if (hit) {
        setCache(cacheKey, hit);
        return hit;
      }
    }
  }

  // Strategy 2: Google S2 (256 then 128)
  const s2Candidates = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainInfo.host)}&sz=256`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainInfo.host)}&sz=128`,
  ];
  for (const candidate of s2Candidates) {
    const hit = await fetchImage(candidate);
    if (hit) {
      setCache(cacheKey, hit);
      return hit;
    }
  }

  // Strategy 3: Clearbit
  const clearbit = await fetchImage(`https://logo.clearbit.com/${domainInfo.host}`);
  if (clearbit) {
    setCache(cacheKey, clearbit);
    return clearbit;
  }

  // Strategy 4: direct favicon
  const direct = await fetchImage(`${domainInfo.origin}/favicon.ico`);
  if (direct) {
    setCache(cacheKey, direct);
    return direct;
  }

  return null;
}
