/**
 * Smoke test for invites flow.
 * Requirements:
 *  - ADMIN_EMAIL / ADMIN_PASSWORD: admin of business 1
 *  - INVITEE_EMAIL / INVITEE_PASSWORD: user that matches the invite email
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... INVITEE_EMAIL=... INVITEE_PASSWORD=... pnpm smoke:invites
 */

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const inviteeEmail = process.env.INVITEE_EMAIL;
const inviteePassword = process.env.INVITEE_PASSWORD;

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cookie?: string;
};

async function fetchJson(path: string, opts: FetchOptions = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  let authCookie: string | null = null;
  if (setCookie) {
    authCookie = setCookie.split(',').find((c) => c.trim().startsWith('auth_token=')) ?? null;
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  return { res, json, authCookie };
}

async function login(email: string, password: string) {
  const { res, authCookie } = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  if (!authCookie) throw new Error('No auth_token cookie received after login.');
  return authCookie;
}

async function main() {
  if (!adminEmail || !adminPassword || !inviteeEmail || !inviteePassword) {
    throw new Error('ADMIN_EMAIL/ADMIN_PASSWORD/INVITEE_EMAIL/INVITEE_PASSWORD are required.');
  }

  console.log(`Base URL: ${baseUrl}`);

  console.log('Admin login…');
  const adminCookie = await login(adminEmail, adminPassword);

  console.log('Pick business…');
  const { res: bizRes, json: bizJson } = await fetchJson('/api/pro/businesses', { cookie: adminCookie });
  if (!bizRes.ok) {
    throw new Error(`/api/pro/businesses failed (${bizRes.status})`);
  }
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id ?? '1';

  console.log('Create invite…');
  const { res: inviteRes, json: inviteJson } = await fetchJson(`/api/pro/businesses/${businessId}/invites`, {
    method: 'POST',
    cookie: adminCookie,
    body: { email: inviteeEmail, role: 'MEMBER' },
  });
  if (!inviteRes.ok || !(inviteJson as { inviteLink?: string })?.inviteLink) {
    throw new Error(`Invite creation failed (${inviteRes.status}): ${JSON.stringify(inviteJson)}`);
  }
  const inviteLink = (inviteJson as { inviteLink?: string }).inviteLink as string;
  const token = new URL(inviteLink).searchParams.get('token');
  if (!token) throw new Error('No token returned in inviteLink');

  console.log('Invitee login…');
  const inviteeCookie = await login(inviteeEmail, inviteePassword);

  console.log('Accept invite…');
  const { res: acceptRes, json: acceptJson } = await fetchJson('/api/pro/businesses/invites/accept', {
    method: 'POST',
    cookie: inviteeCookie,
    body: { token },
  });
  if (!acceptRes.ok) {
    throw new Error(`Accept failed (${acceptRes.status}): ${JSON.stringify(acceptJson)}`);
  }

  console.log('Membership check (admin)…');
  const { res: membersRes, json: membersJson } = await fetchJson(
    `/api/pro/businesses/${businessId}/members`,
    { cookie: adminCookie }
  );
  if (!membersRes.ok) {
    throw new Error(`Members fetch failed (${membersRes.status})`);
  }
  const found = (membersJson as { items?: Array<{ email?: string }> })?.items?.some(
    (m) => m.email?.toLowerCase() === inviteeEmail.toLowerCase()
  );
  if (!found) {
    throw new Error('Membership not found after accept.');
  }

  console.log('Second accept (should fail)…');
  const { res: second } = await fetchJson('/api/pro/businesses/invites/accept', {
    method: 'POST',
    cookie: inviteeCookie,
    body: { token },
  });
  if (second.ok) throw new Error('Second accept unexpectedly succeeded');
  console.log('Invites smoke OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
