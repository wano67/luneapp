const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TIMEOUT_MS = 4000;
const MAX_BYTES = 2 * 1024 * 1024;

type ValidationResult =
  | { ok: true; finalUrl: string; contentType: string; buffer: Buffer }
  | { ok: false };

function withTimeout(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isLikelyImage(contentType: string, url: string) {
  if (!contentType) return false;
  if (contentType.startsWith('image/')) return true;
  if (contentType === 'application/octet-stream') {
    return /\.(svg|png|jpe?g|gif|webp|ico)$/i.test(url);
  }
  if (contentType.includes('svg')) return true;
  return false;
}

function hasImageExtension(url: string) {
  return /\.(svg|png|jpe?g|gif|webp|ico)$/i.test(url);
}

async function readLimitedBody(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) return null;
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export async function validateLogoUrl(url: string): Promise<ValidationResult> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false };
  } catch {
    return { ok: false };
  }

  let res: Response | null = null;
  try {
    res = await withTimeout(
      url,
      {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': UA,
          Accept: 'image/*,*/*;q=0.8',
        },
      },
      TIMEOUT_MS
    );
  } catch {
    // ignore head failures
  }

  if (res && res.ok) {
    const cl = res.headers.get('content-length');
    const ct = res.headers.get('content-type') ?? '';
    if (cl && Number(cl) > MAX_BYTES) return { ok: false };
    const maybeImage = isLikelyImage(ct, url) || (!ct && hasImageExtension(url));
    if (!maybeImage) {
      res = null; // fallback to get to inspect body content-type
    }
  }

  if (!res || !res.ok) {
    try {
      res = await withTimeout(
        url,
        {
          method: 'GET',
          redirect: 'follow',
          headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
        },
        TIMEOUT_MS
      );
    } catch {
      return { ok: false };
    }
  }

  if (!res || !res.ok) return { ok: false };

  const contentTypeHeader = res.headers.get('content-type') ?? '';
  const finalUrl = res.url || url;
  const buffer = await readLimitedBody(res);
  if (!buffer || buffer.length === 0) {
    // try GET if HEAD returned empty
    try {
      const retry = await withTimeout(
        finalUrl,
        {
          method: 'GET',
          redirect: 'follow',
          headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
        },
        TIMEOUT_MS
      );
      if (!retry.ok) return { ok: false };
      const retryCt = retry.headers.get('content-type') ?? contentTypeHeader;
      const retryBuf = await readLimitedBody(retry);
      if (!retryBuf || retryBuf.length === 0) return { ok: false };
      const retryIsImage = isLikelyImage(retryCt, finalUrl) || (!retryCt && hasImageExtension(finalUrl));
      if (!retryIsImage) return { ok: false };
      const inferredRetryCt =
        retryCt.startsWith('image/') || retryCt.includes('svg')
          ? retryCt
          : finalUrl.endsWith('.svg')
            ? 'image/svg+xml'
            : retryCt || 'image/*';
      return { ok: true, finalUrl, contentType: inferredRetryCt, buffer: retryBuf };
    } catch {
      return { ok: false };
    }
  }

  const isImage = isLikelyImage(contentTypeHeader, finalUrl) || (!contentTypeHeader && hasImageExtension(finalUrl));
  if (!isImage) return { ok: false };

  const inferredCt =
    contentTypeHeader.startsWith('image/') || contentTypeHeader.includes('svg')
      ? contentTypeHeader
      : finalUrl.endsWith('.svg')
        ? 'image/svg+xml'
        : contentTypeHeader || 'image/*';

  return { ok: true, finalUrl, contentType: inferredCt, buffer };
}
