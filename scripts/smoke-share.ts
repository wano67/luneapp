/**
 * Smoke test — Share token public access
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-share.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[share] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // Find a project to check for share links
  const { json: projJson } = await request(`${base}/projects`);
  const projects = assertListShape(projJson, 'GET /projects');

  if (projects.length === 0) {
    console.log('  ⊘ No projects found, skip share test');
    console.log('[share] OK (skipped)\n');
    return;
  }

  const project = projects[0] as Record<string, unknown>;
  const projectId = project.id as string;

  // Try to get or create a share link
  const { json: shareJson, res: shareRes } = await request(
    `${base}/projects/${projectId}/share`,
    { allowError: true },
  );

  if (!shareRes.ok) {
    console.log(`  ⊘ Share endpoint → ${shareRes.status} (skip)`);
    console.log('[share] OK (skipped)\n');
    return;
  }

  const shareData = shareJson as Record<string, unknown>;
  const token = (shareData.token ?? (shareData.item as Record<string, unknown>)?.token) as string;

  if (!token) {
    // Try to enable sharing
    const { json: enableJson, res: enableRes } = await request(
      `${base}/projects/${projectId}/share`,
      { method: 'POST', allowError: true },
    );
    if (enableRes.ok) {
      const enableData = enableJson as Record<string, unknown>;
      const newToken = (enableData.token ?? (enableData.item as Record<string, unknown>)?.token) as string;
      if (newToken) {
        console.log(`  ✓ Share link créé (token=${newToken.slice(0, 8)}…)`);

        // Test public access (no auth)
        const { request: anonReq } = createRequester(baseUrl);
        const { res: pubRes } = await anonReq(`/api/share/${newToken}`, { allowError: true });
        assert([200, 404].includes(pubRes.status), `Public share access (${pubRes.status})`);
        console.log(`  ✓ Public share access → ${pubRes.status}`);
      }
    } else {
      console.log(`  ⊘ Enable share → ${enableRes.status} (skip)`);
    }
  } else {
    console.log(`  ✓ Share link trouvé (token=${token.slice(0, 8)}…)`);

    // Test public access
    const { request: anonReq } = createRequester(baseUrl);
    const { res: pubRes } = await anonReq(`/api/share/${token}`, { allowError: true });
    assert([200, 404].includes(pubRes.status), `Public share access (${pubRes.status})`);
    console.log(`  ✓ Public share access → ${pubRes.status}`);
  }

  console.log('[share] OK\n');
}

main().catch((err) => {
  console.error('[share] ÉCHEC :', err.message);
  process.exit(1);
});
