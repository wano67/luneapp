import { NextRequest, NextResponse } from 'next/server';
import { getRequestId, withIdNoStore } from '@/server/http/apiUtils';

type Bucket = {
  tokens: number;
  updatedAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  code?: string;
};

const buckets = new Map<string, Bucket>();

// Periodic cleanup: evict buckets older than 2× their window (at most every 60s)
const CLEANUP_INTERVAL = 60_000;
const BUCKET_MAX_AGE = 30 * 60_000; // 30 min default max age
let lastCleanup = Date.now();

function cleanupStale() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > BUCKET_MAX_AGE) {
      buckets.delete(key);
    }
  }
}

function getIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const reqAny = req as unknown as { ip?: unknown };
  if (typeof reqAny.ip === 'string') return reqAny.ip;
  return 'unknown';
}

function errorResponse(limit: number, windowMs: number, retryAfterSeconds: number, requestId: string) {
  const headers = new Headers();
  headers.set('Retry-After', String(retryAfterSeconds));
  headers.set('X-RateLimit-Limit', String(limit));
  headers.set('X-RateLimit-Remaining', '0');
  headers.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000 + retryAfterSeconds)));

  const res = NextResponse.json(
    { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please retry later.' } },
    { status: 429, headers }
  );

  return withIdNoStore(res, requestId);
}

export function rateLimit(req: NextRequest, opts: RateLimitOptions): NextResponse | null {
  cleanupStale();

  const requestId = getRequestId(req);
  const now = Date.now();
  const baseKey = `${opts.key}`;
  const ip = getIp(req);
  const key = ip === 'unknown' ? `${baseKey}:unknown` : baseKey;
  const effectiveLimit = ip === 'unknown' ? Math.min(opts.limit, 5) : opts.limit;
  const bucket = buckets.get(key) ?? { tokens: effectiveLimit, updatedAt: now };

  // Refill tokens
  const elapsed = now - bucket.updatedAt;
  if (elapsed > 0) {
    const refill = (elapsed / opts.windowMs) * opts.limit;
    bucket.tokens = Math.min(effectiveLimit, bucket.tokens + refill);
    bucket.updatedAt = now;
  }

  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((opts.windowMs / effectiveLimit) / 1000);
    buckets.set(key, bucket);
    return errorResponse(effectiveLimit, opts.windowMs, retryAfter, requestId);
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);

  return null;
}

export function makeIpKey(req: NextRequest, scope: string) {
  return `${scope}:${getIp(req)}`;
}
