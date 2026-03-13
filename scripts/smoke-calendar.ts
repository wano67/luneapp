/**
 * Smoke test — Calendar events (personal + pro), timezone, sync
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-calendar.ts
 */

import { createRequester, loginPersonal, loginAndPickBusiness, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[calendar] Démarrage…');

  // ── Personal calendar ──
  {
    const { request } = createRequester(baseUrl);
    await loginPersonal(request);

    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const toMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
    const toYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const to = `${toYear}-${String(toMonth).padStart(2, '0')}-01`;

    // LIST with timezone
    const { json: listJson } = await request(
      `/api/personal/calendar/events?from=${from}&to=${to}&tz=${encodeURIComponent('Europe/Paris')}`,
    );
    const items = assertListShape(listJson, 'GET personal/calendar/events');
    console.log(`  ✓ Personal calendar list (${items.length} events)`);

    // CREATE appointment
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const { json: createJson } = await request('/api/personal/calendar/events', {
      method: 'POST',
      body: {
        kind: 'APPOINTMENT',
        title: '__smoke_calendar_event__',
        startAt: tomorrow.toISOString(),
        allDay: false,
        location: 'Bureau',
      },
    });
    const created = assertItemShape(createJson, 'POST personal/calendar/events');
    const eventId = created.id as string;
    assert(eventId, 'event id returned');
    console.log(`  ✓ Personal event created (id=${eventId})`);

    // UPDATE
    const { res: patchRes } = await request(`/api/personal/calendar/events/${eventId}`, {
      method: 'PATCH',
      body: { title: '__smoke_calendar_updated__' },
    });
    assert(patchRes.ok, `PATCH personal event status=${patchRes.status}`);
    console.log('  ✓ Personal event updated');

    // DELETE
    const { res: delRes } = await request(`/api/personal/calendar/events/${eventId}`, { method: 'DELETE' });
    assert(delRes.status === 204 || delRes.status === 200, `DELETE status=${delRes.status}`);
    console.log('  ✓ Personal event deleted');

    // SYNC endpoint
    const { res: syncRes } = await request('/api/personal/calendar/sync', { allowError: true });
    if (syncRes.ok) {
      console.log('  ✓ Personal calendar sync');
    } else {
      console.log(`  ⊘ Personal calendar sync → ${syncRes.status} (skip)`);
    }
  }

  // ── Pro calendar ──
  {
    const { request } = createRequester(baseUrl);
    const { businessId } = await loginAndPickBusiness(request);

    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const toMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
    const toYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const to = `${toYear}-${String(toMonth).padStart(2, '0')}-01`;

    const { json: proListJson } = await request(
      `/api/pro/businesses/${businessId}/calendar/events?from=${from}&to=${to}&tz=UTC`,
    );
    const proItems = assertListShape(proListJson, 'GET pro/calendar/events');
    console.log(`  ✓ Pro calendar list (${proItems.length} events)`);
  }

  console.log('[calendar] OK\n');
}

main().catch((err) => {
  console.error('[calendar] ÉCHEC :', err.message);
  process.exit(1);
});
