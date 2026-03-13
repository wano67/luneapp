/**
 * Smoke test — Auth lifecycle: register → login → profile → change password → logout → re-login
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-auth-lifecycle.ts
 */

import { createRequester, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[auth-lifecycle] Démarrage…');

  const email = `smoke-lifecycle-${Date.now()}@test.com`;
  const password = 'SmokeTest123!';
  const newPassword = 'SmokeNew456!';

  // ── REGISTER ──
  const { request: req1 } = createRequester(baseUrl);
  const { res: regRes } = await req1('/api/auth/register', {
    method: 'POST',
    body: { email, password, name: 'Smoke Lifecycle' },
    allowError: true,
  });
  assert([200, 201].includes(regRes.status), `Register status=${regRes.status}`);
  console.log('  ✓ Register');

  // ── LOGIN ──
  const { request } = createRequester(baseUrl);
  const { res: loginRes, json: loginJson } = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert(loginRes.ok, `Login status=${loginRes.status}`);
  const loginBody = loginJson as Record<string, unknown>;
  assert(loginBody.user || loginBody.token || loginRes.headers.get('set-cookie'), 'Login returns auth data');
  console.log('  ✓ Login');

  // ── PROFILE ──
  const { json: profileJson } = await request('/api/account/profile');
  const profile = profileJson as Record<string, unknown>;
  assert(profile.name || profile.email, 'Profile returns user data');
  console.log('  ✓ Profile GET');

  // ── CHANGE PASSWORD ──
  const { res: pwRes } = await request('/api/account/password', {
    method: 'POST',
    body: { currentPassword: password, newPassword },
    allowError: true,
  });
  assert([200, 204].includes(pwRes.status), `Change password status=${pwRes.status}`);
  console.log('  ✓ Change password');

  // ── LOGOUT ──
  const { res: logoutRes } = await request('/api/auth/logout', {
    method: 'POST',
    allowError: true,
  });
  assert([200, 204].includes(logoutRes.status), `Logout status=${logoutRes.status}`);
  console.log('  ✓ Logout');

  // ── LOGIN WITH NEW PASSWORD ──
  const { request: req2 } = createRequester(baseUrl);
  const { res: reLoginRes } = await req2('/api/auth/login', {
    method: 'POST',
    body: { email, password: newPassword },
  });
  assert(reLoginRes.ok, `Re-login status=${reLoginRes.status}`);
  console.log('  ✓ Re-login with new password');

  // ── OLD PASSWORD REJECTED ──
  const { request: req3 } = createRequester(baseUrl);
  const { res: oldPwRes } = await req3('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    allowError: true,
  });
  assert([400, 401].includes(oldPwRes.status), `Old password rejected (${oldPwRes.status})`);
  console.log('  ✓ Old password rejected');

  console.log('[auth-lifecycle] OK\n');
}

main().catch((err) => {
  console.error('[auth-lifecycle] ÉCHEC :', err.message);
  process.exit(1);
});
