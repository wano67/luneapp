/**
 * Smoke test: references wiring consumption (services + clients with category + tags).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:references-consumption
 * Fallback: ADMIN_EMAIL/ADMIN_PASSWORD if TEST_* absent.
 */

import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request, getLastRequestId } = createRequester(baseUrl);

async function login(): Promise<void> {
  let creds;
  try {
    creds = getSmokeCreds({ preferAdmin: true });
  } catch (err) {
    handleMissingCreds((err as Error).message);
    return;
  }
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password },
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}) ${JSON.stringify(json)}`);
  }
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status}) ref=${getLastRequestId()}`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found.');
  console.log(`Business ${businessId}`);

  let serviceId: string | null = null;
  let clientId: string | null = null;
  let categoryId: string | null = null;
  let tagId: string | null = null;
  try {
    const uniq = `Smoke-${Date.now()}`;
    console.log('Create category…');
    const { res: catRes, json: catJson } = await request(
      `/api/pro/businesses/${businessId}/references`,
      { method: 'POST', body: { type: 'CATEGORY', name: `${uniq}-cat` } }
    );
    if (!catRes.ok) throw new Error(`Create category failed (${catRes.status}) ref=${getLastRequestId()}`);
    categoryId = (catJson as { item?: { id?: string } })?.item?.id ?? null;

    console.log('Create tag…');
    const { res: tagRes, json: tagJson } = await request(
      `/api/pro/businesses/${businessId}/references`,
      { method: 'POST', body: { type: 'TAG', name: `${uniq}-tag` } }
    );
    if (!tagRes.ok) throw new Error(`Create tag failed (${tagRes.status}) ref=${getLastRequestId()}`);
    tagId = (tagJson as { item?: { id?: string } })?.item?.id ?? null;

    console.log('Create service…');
    const code = `SER-${uniq}`;
    const { res: serviceRes, json: serviceJson } = await request(
      `/api/pro/businesses/${businessId}/services`,
      {
        method: 'POST',
        body: {
          code,
          name: `Service ${uniq}`,
          categoryReferenceId: categoryId,
          tagReferenceIds: tagId ? [tagId] : [],
        },
      }
    );
    if (!serviceRes.ok) throw new Error(`Create service failed (${serviceRes.status}) ref=${getLastRequestId()}`);
    serviceId = (serviceJson as { id?: string; item?: { id?: string } })?.item?.id ?? null;
    if (!serviceId) serviceId = (serviceJson as { id?: string })?.id ?? null;
    if (!serviceId) throw new Error('Service created but no id.');

    console.log('Patch service references…');
    const { res: patchRes } = await request(
      `/api/pro/businesses/${businessId}/services/${serviceId}`,
      {
        method: 'PATCH',
        body: {
          code,
          name: `Service ${uniq}`,
          categoryReferenceId: categoryId,
          tagReferenceIds: tagId ? [tagId] : [],
        },
      }
    );
    if (!patchRes.ok) throw new Error(`Patch service failed (${patchRes.status}) ref=${getLastRequestId()}`);

    console.log('Get service detail…');
    const { res: detailRes, json: detailJson } = await request(
      `/api/pro/businesses/${businessId}/services/${serviceId}`
    );
    if (!detailRes.ok) throw new Error(`Detail failed (${detailRes.status}) ref=${getLastRequestId()}`);
    const detail = detailJson as {
      categoryReferenceId?: string | null;
      tagReferences?: Array<{ id?: string }>;
    };
    if ((categoryId && detail.categoryReferenceId !== categoryId) || !detail.tagReferences?.find((t) => t.id === tagId)) {
      throw new Error('References not persisted on service detail.');
    }

    console.log('Filter services by tag…');
    const { res: listRes, json: listJson } = await request(
      `/api/pro/businesses/${businessId}/services?tagReferenceId=${tagId}`
    );
    if (!listRes.ok) throw new Error(`List filter failed (${listRes.status}) ref=${getLastRequestId()}`);
    const found = (listJson as { items?: Array<{ id?: string }> })?.items?.find((s) => s.id === serviceId);
    if (!found) throw new Error('Filtered services did not return the created service.');

    console.log('Create client…');
    const { res: clientRes, json: clientJson } = await request(
      `/api/pro/businesses/${businessId}/clients`,
      {
        method: 'POST',
        body: {
          name: `Client ${uniq}`,
          categoryReferenceId: categoryId,
          tagReferenceIds: tagId ? [tagId] : [],
        },
      }
    );
    if (!clientRes.ok) throw new Error(`Create client failed (${clientRes.status}) ref=${getLastRequestId()}`);
    clientId =
      (clientJson as { id?: string; item?: { id?: string } })?.item?.id ??
      (clientJson as { id?: string })?.id ??
      null;
    if (!clientId) throw new Error('Client created but no id.');

    console.log('Patch client references…');
    const { res: clientPatchRes } = await request(
      `/api/pro/businesses/${businessId}/clients/${clientId}`,
      {
        method: 'PATCH',
        body: {
          categoryReferenceId: categoryId,
          tagReferenceIds: tagId ? [tagId] : [],
        },
      }
    );
    if (!clientPatchRes.ok) throw new Error(`Patch client failed (${clientPatchRes.status}) ref=${getLastRequestId()}`);

    console.log('Get client detail…');
    const { res: clientDetailRes, json: clientDetailJson } = await request(
      `/api/pro/businesses/${businessId}/clients/${clientId}`
    );
    if (!clientDetailRes.ok) throw new Error(`Client detail failed (${clientDetailRes.status}) ref=${getLastRequestId()}`);
    const clientDetail =
      (clientDetailJson as { item?: { categoryReferenceId?: string | null; tagReferences?: Array<{ id?: string }> } }).item ??
      (clientDetailJson as { categoryReferenceId?: string | null; tagReferences?: Array<{ id?: string }> });
    if (!clientDetail) throw new Error('Client detail missing payload.');
    if ((categoryId && clientDetail.categoryReferenceId !== categoryId) || !clientDetail.tagReferences?.find((t) => t.id === tagId)) {
      throw new Error('References not persisted on client detail.');
    }

    console.log('Filter clients by tag…');
    const { res: clientListRes, json: clientListJson } = await request(
      `/api/pro/businesses/${businessId}/clients?tagReferenceId=${tagId}`
    );
    if (!clientListRes.ok) throw new Error(`Client list filter failed (${clientListRes.status}) ref=${getLastRequestId()}`);
    const clientFound = (clientListJson as { items?: Array<{ id?: string }> })?.items?.find((c) => c.id === clientId);
    if (!clientFound) throw new Error('Filtered clients did not return the created client.');

    console.log('Smoke references consumption OK.');
  } finally {
    if (serviceId) {
      await request(`/api/pro/businesses/${businessId}/services/${serviceId}`, {
        method: 'DELETE',
        allowError: true,
      });
    }
    if (categoryId) {
      await request(`/api/pro/businesses/${businessId}/references/${categoryId}`, {
        method: 'DELETE',
        allowError: true,
      });
    }
    if (tagId) {
      await request(`/api/pro/businesses/${businessId}/references/${tagId}`, {
        method: 'DELETE',
        allowError: true,
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  const rid = getLastRequestId();
  if (rid) console.error(`Last request id: ${rid}`);
  process.exit(1);
});
