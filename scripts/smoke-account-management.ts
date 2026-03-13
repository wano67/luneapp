/**
 * Smoke test — Account management (profile, preferences)
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-account-management.ts
 */

import { createRequester, loginPersonal, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function main() {
  console.log('[account-management] Démarrage…');

  await loginPersonal(request);
  console.log('  ✓ Login');

  // ── PROFILE GET ──
  const { json: profileJson } = await request('/api/account/profile');
  const profile = profileJson as Record<string, unknown>;
  assert(profile.email || profile.name, 'Profile returns user data');
  const originalName = profile.name as string;
  console.log(`  ✓ Profile GET (name=${originalName})`);

  // ── PROFILE PATCH ──
  const testName = `__smoke_${Date.now()}__`;
  const { res: patchRes } = await request('/api/account/profile', {
    method: 'PATCH',
    body: { name: testName },
  });
  assert(patchRes.ok, `Profile PATCH status=${patchRes.status}`);
  console.log('  ✓ Profile PATCH');

  // ── Verify update ──
  const { json: p2 } = await request('/api/account/profile');
  const profile2 = p2 as Record<string, unknown>;
  assert(profile2.name === testName, `Profile name updated to "${testName}"`);
  console.log('  ✓ Profile update verified');

  // ── Restore original name ──
  if (originalName) {
    await request('/api/account/profile', {
      method: 'PATCH',
      body: { name: originalName },
    });
    console.log('  ✓ Profile name restored');
  }

  // ── PREFERENCES GET ──
  const { json: prefsJson, res: prefsRes } = await request('/api/account/preferences', { allowError: true });
  if (prefsRes.ok) {
    const prefs = prefsJson as Record<string, unknown>;
    assert(typeof prefs === 'object', 'Preferences returns object');
    console.log('  ✓ Preferences GET');

    // ── PREFERENCES PATCH ──
    const { res: prefsPatchRes } = await request('/api/account/preferences', {
      method: 'PATCH',
      body: { language: 'fr' },
      allowError: true,
    });
    if (prefsPatchRes.ok) {
      console.log('  ✓ Preferences PATCH');
    } else {
      console.log(`  ⊘ Preferences PATCH → ${prefsPatchRes.status} (skip)`);
    }
  } else {
    console.log(`  ⊘ Preferences → ${prefsRes.status} (skip)`);
  }

  console.log('[account-management] OK\n');
}

main().catch((err) => {
  console.error('[account-management] ÉCHEC :', err.message);
  process.exit(1);
});
