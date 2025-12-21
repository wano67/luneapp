/**
 * Smoke test: Processes MVP (DB + API + UI contracts).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:processes
 * Fallback envs: ADMIN_EMAIL/ADMIN_PASSWORD if TEST_* absent.
 *
 * Flow:
 *  - Login
 *  - Pick first business (admin/owner)
 *  - Create a process
 *  - Add 2 steps
 *  - Fetch detail and assert steps order
 *  - Toggle isDone on first step
 *  - Archive then delete the process (cleanup)
 *  - Ping dashboard to ensure no regression
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
  console.log('Login…');
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status}) ref=${getLastRequestId()}`);
  const businessEntry = (bizJson as { items?: Array<{ business?: { id?: string }; role?: string }> })
    ?.items?.find((item) => item.role === 'OWNER' || item.role === 'ADMIN');
  const businessId = businessEntry?.business?.id;
  if (!businessId) throw new Error('No admin business found.');
  console.log(`Business ${businessId} (${businessEntry?.role})`);

  let processId: string | null = null;
  let step1Id: string | null = null;
  try {
    console.log('Create process…');
    const processName = `Smoke Process ${Date.now()}`;
    const { res: createRes, json: createJson } = await request(
      `/api/pro/businesses/${businessId}/processes`,
      {
        method: 'POST',
        body: { name: processName, description: 'Smoke process auto' },
      }
    );
    if (!createRes.ok) throw new Error(`Create process failed (${createRes.status}) ref=${getLastRequestId()}`);
    processId = (createJson as { item?: { id?: string } })?.item?.id ?? null;
    if (!processId) throw new Error('Process ID missing after creation.');

    console.log('Add step 1…');
    const step1 = await request(
      `/api/pro/businesses/${businessId}/processes/${processId}/steps`,
      {
        method: 'POST',
        body: { title: 'Étape A', position: 1 },
      }
    );
    if (!step1.res.ok) throw new Error(`Step1 failed (${step1.res.status}) ref=${getLastRequestId()}`);
    step1Id = (step1.json as { item?: { id?: string } })?.item?.id ?? null;

    console.log('Add step 2…');
    const step2 = await request(
      `/api/pro/businesses/${businessId}/processes/${processId}/steps`,
      {
        method: 'POST',
        body: { title: 'Étape B', position: 2 },
      }
    );
    if (!step2.res.ok) throw new Error(`Step2 failed (${step2.res.status}) ref=${getLastRequestId()}`);

    console.log('Fetch detail…');
    const { res: detailRes, json: detailJson } = await request(
      `/api/pro/businesses/${businessId}/processes/${processId}`
    );
    if (!detailRes.ok) throw new Error(`Detail failed (${detailRes.status}) ref=${getLastRequestId()}`);
    const steps = (detailJson as { item?: { steps?: Array<{ position?: number; id?: string }> } })?.item?.steps;
    if (!steps || steps.length < 2) throw new Error('Steps missing in detail.');
    const ordered = [...steps].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    if (ordered[0].id !== steps[0].id) throw new Error('Steps order incorrect.');

    if (step1Id) {
      console.log('Toggle isDone on step 1…');
      const { res: toggleRes } = await request(
        `/api/pro/businesses/${businessId}/processes/${processId}/steps/${step1Id}`,
        {
          method: 'PATCH',
          body: { isDone: true },
        }
      );
      if (!toggleRes.ok) throw new Error(`Toggle step failed (${toggleRes.status}) ref=${getLastRequestId()}`);
    }

    console.log('Archive process…');
    const { res: archiveRes } = await request(
      `/api/pro/businesses/${businessId}/processes/${processId}`,
      { method: 'PATCH', body: { archived: true } }
    );
    if (!archiveRes.ok) throw new Error(`Archive failed (${archiveRes.status}) ref=${getLastRequestId()}`);

    console.log('Delete process (cleanup)…');
    const { res: delRes } = await request(
      `/api/pro/businesses/${businessId}/processes/${processId}`,
      { method: 'DELETE' }
    );
    if (!delRes.ok) throw new Error(`Delete failed (${delRes.status}) ref=${getLastRequestId()}`);
    processId = null;

    console.log('Dashboard ping…');
    const { res: dashRes } = await request(`/api/pro/businesses/${businessId}/dashboard`);
    if (!dashRes.ok) throw new Error(`Dashboard failed (${dashRes.status}) ref=${getLastRequestId()}`);

    console.log('Smoke processes OK.');
  } finally {
    if (processId) {
      console.log('Cleanup leftover process…');
      await request(`/api/pro/businesses/${businessId}/processes/${processId}`, {
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
