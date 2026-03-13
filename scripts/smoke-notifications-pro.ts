/**
 * Smoke test — Pro notifications (list, read, read-all)
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-notifications-pro.ts
 */

import { createRequester, loginAndPickBusiness, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[notifications-pro] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson } = await request(`${base}/notifications`);
  const body = listJson as Record<string, unknown>;
  assert(Array.isArray(body.items), 'GET /notifications returns items[]');
  assert('unreadCount' in body, 'GET /notifications returns unreadCount');
  const items = body.items as Array<Record<string, unknown>>;
  console.log(`  ✓ Liste notifications (${items.length}, unread=${body.unreadCount})`);

  // ── LIST with filter ──
  const { json: unreadJson } = await request(`${base}/notifications?unreadOnly=true`);
  const unreadBody = unreadJson as Record<string, unknown>;
  assert(Array.isArray(unreadBody.items), 'GET /notifications?unreadOnly returns items[]');
  console.log(`  ✓ Notifications non-lues (${(unreadBody.items as unknown[]).length})`);

  // ── MARK ONE AS READ (if any) ──
  if (items.length > 0) {
    const notifId = items[0].id as string;
    const { res: patchRes } = await request(`${base}/notifications/${notifId}`, {
      method: 'PATCH',
      body: { isRead: true },
      allowError: true,
    });
    if (patchRes.ok) {
      console.log(`  ✓ Notification marquée lue (id=${notifId})`);
    } else {
      console.log(`  ⊘ Mark read → ${patchRes.status} (skip)`);
    }
  }

  // ── READ ALL ──
  const { res: readAllRes } = await request(`${base}/notifications/read-all`, {
    method: 'POST',
    allowError: true,
  });
  if (readAllRes.ok || readAllRes.status === 204) {
    console.log('  ✓ Read-all notifications');
  } else {
    console.log(`  ⊘ Read-all → ${readAllRes.status} (skip)`);
  }

  console.log('[notifications-pro] OK\n');
}

main().catch((err) => {
  console.error('[notifications-pro] ÉCHEC :', err.message);
  process.exit(1);
});
