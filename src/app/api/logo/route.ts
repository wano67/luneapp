import { NextRequest, NextResponse } from 'next/server';
import { withNoStore, assertSameOrigin } from '@/server/security/csrf';
import { getRequestId, withRequestId, badRequest } from '@/server/http/apiUtils';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36';
const PER_REQUEST_TIMEOUT = 2000;
const MAX_CANDIDATES = 4;
const POSITIVE_MAX_AGE = 60 * 60 * 24; // 1 day
const NEGATIVE_MAX_AGE = 60 * 30; // 30 min

type LogoResult = { buffer: Buffer; contentType: string };

const inFlight = new Map<string, Promise<LogoResult | null>>();
const memoryCache = new Map<
  string,
  { ok: boolean; contentType?: string; buffer?: Buffer; expiresAt: number }
>();

function normalizeUrl(raw?: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(prefixed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (isPrivateHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function isPrivateHost(hostname: string) {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower.endsWith('.local')
  ) {
    return true;
  }
  // Private IP ranges
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(lower)) return true;
  if (/^(fc00:|fd00:)/.test(lower)) return true;
  return false;
}

async function fetchWithTimeout(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT);
  const merged = signal
    ? new AbortSignalAny([signal, controller.signal])
    : controller.signal;
  try {
    return await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA },
      signal: merged,
    });
  } finally {
    clearTimeout(id);
  }
}

class AbortSignalAny implements AbortSignal {
  readonly aborted: boolean;
  onabort: ((this: AbortSignal, ev: Event) => void) | null = null;
  readonly reason: unknown;
  readonly throwIfAborted: () => void;
  constructor(signals: AbortSignal[]) {
    let aborted = false;
    let reason: unknown;
    const controller = new AbortController();
    signals.forEach((s) =>
      s.addEventListener(
        'abort',
        () => {
          if (!aborted) {
            aborted = true;
            reason = s.reason;
            controller.abort(reason);
          }
        },
        { once: true }
      )
    );
    this.aborted = controller.signal.aborted;
    this.reason = controller.signal.reason;
    this.throwIfAborted = () => controller.signal.throwIfAborted();
    controller.signal.addEventListener('abort', (ev) => this.onabort?.(ev));
  }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent(): boolean {
    return false;
  }
}

async function resolveUrl(base: URL, path: string) {
  try {
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

async function parseHtmlForCandidates(base: URL, signal?: AbortSignal) {
  try {
    const res = await fetchWithTimeout(base.toString(), signal);
    if (!res.ok || !res.headers.get('content-type')?.includes('text/html')) return [];
    const text = await res.text();
    const candidates: string[] = [];
    const linkRegex =
      /<link[^>]+(rel=["'][^"']*(icon|apple-touch-icon|shortcut icon)[^"']*["'])[^>]+href=["']([^"']+)["']/gi;
    const metaOg = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
    const manifestRe = /<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/i;
    let m;
    while ((m = linkRegex.exec(text))) {
      const u = await resolveUrl(base, m[3]);
      if (u) candidates.push(u);
      if (candidates.length >= MAX_CANDIDATES) break;
    }
    while (candidates.length < MAX_CANDIDATES && (m = metaOg.exec(text))) {
      const u = await resolveUrl(base, m[1]);
      if (u) candidates.push(u);
    }
    const manifestMatch = manifestRe.exec(text);
    if (candidates.length < MAX_CANDIDATES && manifestMatch?.[1]) {
      const manifestUrl = await resolveUrl(base, manifestMatch[1]);
      if (manifestUrl) {
        const manifestRes = await fetchWithTimeout(manifestUrl, signal);
        if (manifestRes.ok && manifestRes.headers.get('content-type')?.includes('json')) {
          const json = await manifestRes.json();
          if (Array.isArray(json?.icons)) {
            for (const icon of json.icons) {
              const src = icon?.src;
              const u = await resolveUrl(new URL(manifestUrl), src);
              if (u) candidates.push(u);
              if (candidates.length >= MAX_CANDIDATES) break;
            }
          }
        }
      }
    }
    return candidates.slice(0, MAX_CANDIDATES);
  } catch {
    return [];
  }
}

async function validateImage(url: string, signal?: AbortSignal): Promise<LogoResult | null> {
  try {
    const res = await fetchWithTimeout(url, signal);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    if (!buf.byteLength) return null;
    return { buffer: buf, contentType: ct };
  } catch {
    return null;
  }
}

async function findLogo(url: URL, signal?: AbortSignal): Promise<LogoResult | null> {
  const cacheEntry = memoryCache.get(url.origin);
  if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
    if (!cacheEntry.ok) return null;
    if (cacheEntry.buffer && cacheEntry.contentType) {
      return { buffer: cacheEntry.buffer, contentType: cacheEntry.contentType };
    }
  }

  const inflightKey = url.origin;
  if (inFlight.has(inflightKey)) {
    return inFlight.get(inflightKey)!;
  }

  const promise = (async () => {
    const candidates: string[] = [];
    const logoSvg = await resolveUrl(url, '/logo.svg');
    if (logoSvg) candidates.push(logoSvg);
    const htmlCandidates = await parseHtmlForCandidates(url, signal);
    candidates.push(...htmlCandidates);
    const favicon = await resolveUrl(url, '/favicon.ico');
    if (favicon) candidates.push(favicon);
    const filtered = candidates.filter(Boolean).slice(0, MAX_CANDIDATES);

    for (const candidate of filtered) {
      if (!candidate) continue;
      const res = await validateImage(candidate, signal);
      if (res) {
        memoryCache.set(url.origin, {
          ok: true,
          buffer: res.buffer,
          contentType: res.contentType,
          expiresAt: Date.now() + POSITIVE_MAX_AGE * 1000,
        });
        return res;
      }
    }

    memoryCache.set(url.origin, { ok: false, expiresAt: Date.now() + NEGATIVE_MAX_AGE * 1000 });
    return null;
  })().finally(() => {
    inFlight.delete(inflightKey);
  });

  inFlight.set(inflightKey, promise);
  return promise;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withNoStore(withRequestId(csrf, requestId));

  const urlParam = new URL(request.url).searchParams.get('url');
  const normalized = normalizeUrl(urlParam);
  if (!normalized) {
    return withNoStore(withRequestId(badRequest('URL invalide'), requestId));
  }

  const result = await findLogo(normalized);
  if (!result) {
    const res = new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': `public, max-age=${NEGATIVE_MAX_AGE}`,
      },
    });
    return withNoStore(withRequestId(res, requestId));
  }

  const res = new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': `public, max-age=${POSITIVE_MAX_AGE}, stale-while-revalidate=${POSITIVE_MAX_AGE}`,
    },
  });
  return withNoStore(withRequestId(res, requestId));
}
