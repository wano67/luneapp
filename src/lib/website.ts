export function normalizeWebsiteUrl(raw: unknown): { value: string | null; error?: string } {
  if (typeof raw !== 'string') return { value: null };
  let input = raw.trim();
  if (!input) return { value: null };
  if (input.length > 2048) return { value: null, error: 'URL trop longue (2048 max).' };

  // prepend https if missing scheme
  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { value: null, error: 'URL invalide.' };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    return { value: null, error: 'Protocol non supporté.' };
  }

  return { value: url.toString() };
}

export function getFaviconUrl(websiteUrl: string | null | undefined): string | null {
  if (!websiteUrl) return null;
  try {
    const normalized = normalizeWebsiteUrl(websiteUrl).value;
    if (!normalized) return null;
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(normalized)}`;
  } catch {
    return null;
  }
}
