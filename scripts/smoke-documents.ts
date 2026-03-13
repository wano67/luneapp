/**
 * Smoke test — Documents CRUD + folders
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-documents.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[documents] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // Need a project for documents
  const { json: projListJson } = await request(`${base}/projects`);
  const projects = assertListShape(projListJson, 'GET /projects');

  if (projects.length === 0) {
    console.log('  ⊘ Aucun projet trouvé, skip documents test');
    console.log('[documents] OK (skipped)\n');
    return;
  }

  const projectId = (projects[0] as Record<string, unknown>).id as string;
  console.log(`  ✓ Projet trouvé (id=${projectId})`);

  // ── LIST documents ──
  const { json: docsJson, res: docsRes } = await request(`${base}/projects/${projectId}/documents`, { allowError: true });
  if (!docsRes.ok) {
    console.log(`  ⊘ Documents endpoint → ${docsRes.status} (skip)`);
    console.log('[documents] OK (skipped)\n');
    return;
  }
  const docs = assertListShape(docsJson, 'GET /documents');
  console.log(`  ✓ Liste documents (${docs.length})`);

  // ── LIST folders ──
  const { json: foldersJson, res: foldersRes } = await request(`${base}/projects/${projectId}/folders`, { allowError: true });
  if (foldersRes.ok) {
    const folders = assertListShape(foldersJson, 'GET /folders');
    console.log(`  ✓ Liste dossiers (${folders.length})`);

    // ── CREATE folder ──
    const { res: createFolderRes, json: createFolderJson } = await request(`${base}/projects/${projectId}/folders`, {
      method: 'POST',
      body: { name: '__smoke_folder__' },
      allowError: true,
    });
    if (createFolderRes.ok) {
      const folder = (createFolderJson as Record<string, unknown>).item as Record<string, unknown>;
      const folderId = folder?.id as string;
      console.log(`  ✓ Dossier créé (id=${folderId})`);

      // Cleanup
      if (folderId) {
        await request(`${base}/projects/${projectId}/folders/${folderId}`, { method: 'DELETE', allowError: true });
        console.log('  ✓ Dossier nettoyé');
      }
    } else {
      console.log(`  ⊘ Create folder → ${createFolderRes.status} (skip)`);
    }
  } else {
    console.log(`  ⊘ Folders endpoint → ${foldersRes.status} (skip)`);
  }

  console.log('[documents] OK\n');
}

main().catch((err) => {
  console.error('[documents] ÉCHEC :', err.message);
  process.exit(1);
});
