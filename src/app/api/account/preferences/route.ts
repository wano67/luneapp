import { NextRequest } from 'next/server';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

type Prefs = {
  language: 'fr' | 'en';
  theme: 'light' | 'dark' | 'system';
};

function readPrefs(req: NextRequest): Prefs {
  const lang = req.cookies.get('pref_language')?.value === 'en' ? 'en' : 'fr';
  const themeCookie = req.cookies.get('pref_theme')?.value;
  const theme: Prefs['theme'] =
    themeCookie === 'dark' || themeCookie === 'light' || themeCookie === 'system'
      ? themeCookie
      : 'system';
  return { language: lang, theme };
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const { userId } = await requireAuthAsync(req).catch(() => ({ userId: null }));
  if (!userId) return withRequestId(unauthorized(), requestId);
  return withRequestId(jsonNoStore(readPrefs(req)), requestId);
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { userId } = await requireAuthAsync(req).catch(() => ({ userId: null }));
  if (!userId) return withRequestId(unauthorized(), requestId);

  const limited = rateLimit(req, {
    key: `account:prefs:${userId}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body: Partial<Prefs> = await req.json().catch(() => ({}));
  const language = body.language === 'en' ? 'en' : 'fr';
  const theme =
    body.theme === 'dark' || body.theme === 'light' || body.theme === 'system'
      ? body.theme
      : 'system';

  const prefs: Prefs = { language, theme };
  const res = withRequestId(jsonNoStore(prefs), requestId);

  res.cookies.set('pref_language', language, { sameSite: 'lax', path: '/' });
  res.cookies.set('pref_theme', theme, { sameSite: 'lax', path: '/' });

  return res;
}
