/**
 * Smoke test to ensure auth endpoints always return no-store + x-request-id,
 * including CSRF (missing Origin) and rate-limit/invalid credential paths.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 pnpm smoke:auth
 */

import { createRequester, getOrigin } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const origin = getOrigin(baseUrl);
const { request } = createRequester(baseUrl);

function assertHeaders(label: string, res: Response) {
  const cc = res.headers.get('cache-control')?.toLowerCase() || '';
  const rid = res.headers.get('x-request-id');
  if (!cc.includes('no-store')) {
    throw new Error(`${label}: missing no-store header (got "${cc}")`);
  }
  if (!rid) {
    throw new Error(`${label}: missing x-request-id header`);
  }
  return rid;
}

async function registerWithOrigin() {
  const email = `smoke-auth-${Date.now()}@example.com`;
  const payload = { email, password: 'Testpass123!', name: 'Smoke Auth' };

  const { res } = await request('/api/auth/register', {
    method: 'POST',
    body: payload,
    allowError: true,
  });

  if (![200, 201].includes(res.status)) {
    const body = await res.text();
    throw new Error(`registerWithOrigin failed: ${res.status} body=${body}`);
  }

  assertHeaders('register with origin', res);
  console.log(`register with origin -> ${res.status}`);
}

async function registerWithoutOrigin() {
  const payload = { email: `smoke-auth-no-origin-${Date.now()}@example.com`, password: 'Testpass123!' };
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  assertHeaders('register without origin', res);
  if (res.status !== 403) {
    const body = await res.text();
    throw new Error(`registerWithoutOrigin expected 403, got ${res.status} body=${body}`);
  }
  console.log(`register without origin -> ${res.status}`);
}

async function loginWithoutOrigin() {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ email: 'dummy@example.com', password: 'badpass' }),
  });

  assertHeaders('login without origin', res);
  if (res.status !== 403) {
    const body = await res.text();
    throw new Error(`loginWithoutOrigin expected 403, got ${res.status} body=${body}`);
  }
  console.log(`login without origin -> ${res.status}`);
}

async function loginWrongPassword() {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ email: 'admin@example.com', password: 'wrong-password' }),
  });

  assertHeaders('login wrong password', res);
  if (![400, 401].includes(res.status)) {
    const body = await res.text();
    throw new Error(`loginWrongPassword expected 400/401, got ${res.status} body=${body}`);
  }
  console.log(`login wrong password -> ${res.status}`);
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  await registerWithOrigin();
  await registerWithoutOrigin();
  await loginWithoutOrigin();
  await loginWrongPassword();
  console.log('smoke-auth OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
