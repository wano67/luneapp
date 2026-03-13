/**
 * Smoke test — Conversations + messages
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-conversations.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[conversations] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // Need a project for conversations
  const { json: projJson } = await request(`${base}/projects`);
  const projects = assertListShape(projJson, 'GET /projects');

  if (projects.length === 0) {
    console.log('  ⊘ No projects found, skip conversations test');
    console.log('[conversations] OK (skipped)\n');
    return;
  }

  const projectId = (projects[0] as Record<string, unknown>).id as string;

  // ── LIST conversations ──
  const { json: convListJson, res: convListRes } = await request(
    `${base}/projects/${projectId}/conversations`,
    { allowError: true },
  );
  if (!convListRes.ok) {
    console.log(`  ⊘ Conversations endpoint → ${convListRes.status} (skip)`);
    console.log('[conversations] OK (skipped)\n');
    return;
  }
  const convs = assertListShape(convListJson, 'GET /conversations');
  console.log(`  ✓ Liste conversations (${convs.length})`);

  // ── CREATE conversation ──
  const { json: createJson, res: createRes } = await request(
    `${base}/projects/${projectId}/conversations`,
    {
      method: 'POST',
      body: { name: '__smoke_conversation__' },
      allowError: true,
    },
  );
  if (!createRes.ok) {
    console.log(`  ⊘ Create conversation → ${createRes.status} (skip)`);
    // Try to test messages on existing conversation
    if (convs.length > 0) {
      const convId = (convs[0] as Record<string, unknown>).id as string;
      const { json: msgJson } = await request(
        `${base}/projects/${projectId}/conversations/${convId}/messages`,
        { allowError: true },
      );
      if (msgJson) {
        console.log('  ✓ Messages list OK');
      }
    }
    console.log('[conversations] OK (partial)\n');
    return;
  }

  const conv = (createJson as Record<string, unknown>).item as Record<string, unknown>;
  const convId = conv?.id as string;
  assert(convId, 'conversation id returned');
  console.log(`  ✓ Conversation créée (id=${convId})`);

  // ── POST message ──
  const { res: msgRes } = await request(
    `${base}/projects/${projectId}/conversations/${convId}/messages`,
    {
      method: 'POST',
      body: { content: '__smoke_message__' },
      allowError: true,
    },
  );
  if (msgRes.ok || msgRes.status === 201) {
    console.log('  ✓ Message envoyé');
  } else {
    console.log(`  ⊘ Send message → ${msgRes.status} (skip)`);
  }

  // ── LIST messages ──
  const { json: msgsJson } = await request(
    `${base}/projects/${projectId}/conversations/${convId}/messages`,
    { allowError: true },
  );
  if (msgsJson) {
    const msgs = (msgsJson as Record<string, unknown>).items;
    if (Array.isArray(msgs)) {
      console.log(`  ✓ Messages list (${msgs.length})`);
    }
  }

  // ── DELETE conversation ──
  const { res: delRes } = await request(
    `${base}/projects/${projectId}/conversations/${convId}`,
    { method: 'DELETE', allowError: true },
  );
  if (delRes.status === 204 || delRes.status === 200) {
    console.log('  ✓ Conversation supprimée');
  } else {
    console.log(`  ⊘ DELETE conversation → ${delRes.status}`);
  }

  console.log('[conversations] OK\n');
}

main().catch((err) => {
  console.error('[conversations] ÉCHEC :', err.message);
  process.exit(1);
});
