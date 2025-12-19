/**
 * Minimal wiring smoke test (UI ↔ API).
 * Usage:
 *   TEST_EMAIL=... TEST_PASSWORD=... [TEST_BASE_URL=http://localhost:3000] pnpm smoke:wiring
 */

type FetchOpts = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

const baseUrl = process.env.TEST_BASE_URL?.trim() || 'http://localhost:3000';
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!email || !password) {
  console.error('TEST_EMAIL and TEST_PASSWORD are required.');
  process.exit(1);
}

let cookie: string | null = null;

async function request(path: string, opts: FetchOpts = {}) {
  const headers: Record<string, string> = {
    Origin: baseUrl,
    ...(opts.headers ?? {}),
  };
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie && setCookie.includes('auth_token=')) {
    // keep only auth_token for simplicity
    cookie = setCookie.split(',').map((c) => c.trim()).find((c) => c.startsWith('auth_token=')) || cookie;
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const ref = res.headers.get('x-request-id');
    const msg = JSON.stringify(json) || res.statusText;
    throw new Error(`HTTP ${res.status} on ${path}${ref ? ` (ref ${ref})` : ''}: ${msg}`);
  }

  return json as Record<string, unknown>;
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);

  console.log('Login...');
  await request('/api/auth/login', { method: 'POST', body: { email, password } });
  if (!cookie) throw new Error('No auth cookie received after login.');

  console.log('Businesses...');
  const businesses = (await request('/api/pro/businesses')) as { items?: Array<{ business: { id: string } }> };
  const businessId = businesses.items?.[0]?.business.id;
  if (!businessId) throw new Error('No business found.');

  console.log(`Dashboard for business ${businessId}...`);
  await request(`/api/pro/businesses/${businessId}/dashboard`);

  console.log('Clients list...');
  const clients = (await request(`/api/pro/businesses/${businessId}/clients`)) as {
    items?: Array<{ id: string }>;
  };
  const clientId = clients.items?.[0]?.id;
  if (clientId) {
    console.log(`Client detail ${clientId}...`);
    await request(`/api/pro/businesses/${businessId}/clients/${clientId}`);
  } else {
    console.warn('No client found to test detail.');
  }

  console.log('Tasks list...');
  const tasks = (await request(`/api/pro/businesses/${businessId}/tasks`)) as { items?: Array<{ id: string }> };
  const taskId = tasks.items?.[0]?.id;
  if (taskId) {
    console.log(`Task detail ${taskId}...`);
    await request(`/api/pro/businesses/${businessId}/tasks/${taskId}`);
  } else {
    console.warn('No task found to test detail.');
  }

  console.log('Interactions list (limit 5)...');
  await request(`/api/pro/businesses/${businessId}/interactions?limit=5`);

  console.log('Smoke wiring OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
