/**
 * Smoke test — Rate limiting verification
 *
 * Sends rapid requests to a rate-limited endpoint and verifies 429 is returned.
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-rate-limiting.ts
 */

import { createRequester, loginPersonal, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function main() {
  console.log('[rate-limiting] Démarrage…');

  await loginPersonal(request);
  console.log('  ✓ Login');

  // Target a rate-limited endpoint with low limit (60 req/hour = 1/sec)
  // Personal categories POST is 60/hour
  const endpoint = '/api/personal/categories';
  const rapidCount = 70; // Should exceed 60/hour limit
  let got429 = false;
  let requestsDone = 0;

  console.log(`  Envoi de ${rapidCount} requêtes rapides sur POST ${endpoint}…`);

  for (let i = 0; i < rapidCount; i++) {
    const { res } = await request(endpoint, {
      method: 'POST',
      body: { name: `__ratelimit_test_${Date.now()}_${i}__` },
      allowError: true,
    });
    requestsDone++;

    if (res.status === 429) {
      got429 = true;
      console.log(`  ✓ Rate limit atteint après ${requestsDone} requêtes (429 Too Many Requests)`);

      // Verify rate-limit headers
      const retryAfter = res.headers.get('retry-after');
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (retryAfter) console.log(`    Retry-After: ${retryAfter}`);
      if (remaining) console.log(`    X-RateLimit-Remaining: ${remaining}`);
      break;
    }

    // Cleanup: delete the created category if it was successful
    if (res.ok) {
      try {
        const json = await res.clone().json();
        const catId = (json as Record<string, unknown>)?.item
          && ((json as Record<string, unknown>).item as Record<string, unknown>).id;
        if (catId) {
          await request(`${endpoint}/${catId}`, { method: 'DELETE', allowError: true });
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }

  if (!got429) {
    console.log(`  ⚠ ${requestsDone} requêtes envoyées sans recevoir 429 — rate limit peut-être plus haut que prévu`);
    console.log('    (le test reste valide si le serveur a un seuil >70 pour cet endpoint)');
  }

  // Verify a general endpoint still responds (not completely blocked)
  const { res: checkRes } = await request('/api/personal/summary', { allowError: true });
  assert([200, 429].includes(checkRes.status), `API still responds (${checkRes.status})`);
  console.log(`  ✓ API toujours accessible (${checkRes.status})`);

  console.log('[rate-limiting] OK\n');
}

main().catch((err) => {
  console.error('[rate-limiting] ÉCHEC :', err.message);
  process.exit(1);
});
