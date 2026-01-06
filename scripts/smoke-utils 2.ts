type FetchOpts = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  allowError?: boolean;
  redirect?: RequestRedirect;
};

export type SmokeCreds = {
  email: string;
  password: string;
  label: string;
};

function pickEnv(key: string) {
  const value = process.env[key];
  return value && value.trim().length ? value.trim() : null;
}

export function getSmokeCreds(opts?: { preferAdmin?: boolean }): SmokeCreds {
  const mode = pickEnv('SMOKE_CREDS');
  const preferAdmin = mode === 'admin' || opts?.preferAdmin;
  const preferTest = mode === 'test';

  const adminEmail = pickEnv('ADMIN_EMAIL');
  const adminPassword = pickEnv('ADMIN_PASSWORD');
  const testEmail = pickEnv('TEST_EMAIL');
  const testPassword = pickEnv('TEST_PASSWORD');

  const adminAvailable = Boolean(adminEmail && adminPassword);

  let useAdmin = false;
  if (preferAdmin) {
    useAdmin = true;
  } else if (preferTest) {
    useAdmin = false;
  } else if (adminAvailable) {
    useAdmin = true;
  } else {
    useAdmin = false;
  }

  const email = useAdmin ? adminEmail : testEmail;
  const password = useAdmin ? adminPassword : testPassword;
  const label = useAdmin ? 'admin' : 'test';

  if (!email || !password) {
    throw new Error(
      `Missing credentials for smoke tests. Needed ${
        useAdmin ? 'ADMIN_EMAIL/ADMIN_PASSWORD' : 'TEST_EMAIL/TEST_PASSWORD'
      }. Set SMOKE_CREDS=admin|test to force selection.`
    );
  }

  return { email, password, label };
}

export function getOrigin(baseUrl: string): string {
  if (pickEnv('SMOKE_ORIGIN')) return pickEnv('SMOKE_ORIGIN') as string;
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return baseUrl;
  }
}

export function createRequester(baseUrl: string) {
  const origin = getOrigin(baseUrl);
  let cookie: string | null = null;
  let lastRequestId: string | null = null;

  function extractCookie(setCookie: string | null) {
    if (!setCookie) return;
    const auth = setCookie.split(',').find((c) => c.trim().startsWith('auth_token='));
    if (auth) cookie = auth;
  }

  function trackRequestId(res: Response) {
    const rid = res.headers.get('x-request-id')?.trim() || null;
    if (rid) lastRequestId = rid;
    return rid;
  }

  async function request(path: string, opts: FetchOpts = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      redirect: opts.redirect,
      headers: {
        accept: 'application/json',
        Origin: origin,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(opts.headers ?? {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    extractCookie(res.headers.get('set-cookie'));
    const rid = trackRequestId(res);
    const contentType = res.headers.get('content-type') || '';
    let json: unknown = null;
    let text: string | null = null;
    if (contentType.includes('application/json')) {
      try {
        json = await res.json();
      } catch {
        // ignore
      }
    } else {
      try {
        text = await res.text();
      } catch {
        text = null;
      }
    }
    if (!res.ok && !opts.allowError) {
      const bodyStr = json ? JSON.stringify(json) : text ?? '';
      throw new Error(`HTTP ${res.status} for ${path} rid=${rid ?? 'n/a'} body=${bodyStr || '<empty>'}`);
    }
    return { res, json: json ?? text, requestId: lastRequestId };
  }

  async function requestBinary(path: string, opts: FetchOpts = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        accept: 'application/json',
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(opts.headers ?? {}),
      },
    });
    extractCookie(res.headers.get('set-cookie'));
    const rid = trackRequestId(res);
    if (!res.ok && !opts.allowError) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} for ${path} rid=${rid ?? 'n/a'} body=${body || '<empty>'}`);
    }
    const buf = await res.arrayBuffer();
    return { res, buf, requestId: lastRequestId };
  }

  return { request, requestBinary, getLastRequestId: () => lastRequestId };
}

export function handleMissingCreds(message: string) {
  if (process.env.SMOKE_STRICT === '1') {
    throw new Error(message);
  }
  console.log(message);
  process.exit(0);
}
