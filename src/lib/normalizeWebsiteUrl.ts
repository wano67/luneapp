const USER_AGENT = 'luneapp-bot/1.0 (+https://lune.app)';
const FETCH_TIMEOUT_MS = 3000;

function ensureHttpsWww(url: URL): URL {
  const enforced = new URL(url.toString());
  enforced.protocol = 'https:';
  enforced.hostname = enforced.hostname.startsWith('www.') ? enforced.hostname : `www.${enforced.hostname}`;
  enforced.pathname = '/';
  enforced.search = '';
  enforced.hash = '';
  return enforced;
}

export async function normalizeWebsiteUrl(raw: unknown): Promise<{ value: string | null; error?: string }> {
  if (typeof raw !== 'string') return { value: null };
  let input = raw.trim();
  if (!input) return { value: null };
  if (input.length > 2048) return { value: null, error: 'URL trop longue (2048 max).' };

  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { value: null, error: 'URL invalide.' };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    return { value: null, error: 'Protocol non supporté.' };
  }

  // Business website URLs are always canonicalized to https://www.* to avoid logo, SEO and scraping inconsistencies.
  let canonical = ensureHttpsWww(parsed);

  // Try to resolve the canonical URL after redirects (www/non-www), but never fail hard if the fetch errors.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
      },
    });
    clearTimeout(timeout);
    const finalUrl = new URL(response.url || parsed.toString());
    canonical = ensureHttpsWww(finalUrl);
  } catch {
    // ignore network errors and keep the locally normalized URL
  }

  return { value: canonical.origin };
}
