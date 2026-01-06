import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function login() {
  let creds;
  try {
    creds = getSmokeCreds({ preferAdmin: true });
  } catch (err) {
    handleMissingCreds((err as Error).message);
    return false;
  }
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password },
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${JSON.stringify(json)}`);
  return true;
}

async function getFirstBusinessId() {
  const { res, json } = await request('/api/pro/businesses');
  if (!res.ok) throw new Error(`Businesses failed ${res.status}`);
  return (json as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
}

async function ensureService(businessId: string) {
  const list = await request(`/api/pro/businesses/${businessId}/services`);
  if (!list.res.ok) throw new Error(`Services list failed ${list.res.status}`);
  const existing = (list.json as { items?: Array<{ id?: string }> }).items ?? [];
  if (existing.length) return existing[0].id as string;
  const code = `SMK-SVC-${Date.now()}`;
  const created = await request(`/api/pro/businesses/${businessId}/services`, {
    method: 'POST',
    body: { code, name: `Smoke service ${code}` },
  });
  if (!created.res.ok) throw new Error(`Create service failed ${created.res.status} ${JSON.stringify(created.json)}`);
  return (created.json as { id?: string }).id as string;
}

async function ensureProject(businessId: string, forceNew = false) {
  const list = await request(`/api/pro/businesses/${businessId}/projects`);
  if (!list.res.ok) throw new Error(`Projects list failed ${list.res.status}`);
  const existing = (list.json as { items?: Array<{ id?: string }> }).items ?? [];
  if (!forceNew && existing.length) return existing[0].id as string;
  const name = `Smoke project ${Date.now()}${forceNew ? '-b' : ''}`;
  const created = await request(`/api/pro/businesses/${businessId}/projects`, {
    method: 'POST',
    body: { name },
  });
  if (!created.res.ok) throw new Error(`Create project failed ${created.res.status} ${JSON.stringify(created.json)}`);
  return (created.json as { id?: string }).id as string;
}

async function createProjectService(businessId: string, projectId: string, serviceId: string) {
  const res = await request(`/api/pro/businesses/${businessId}/projects/${projectId}/services`, {
    method: 'POST',
    body: { serviceId, quantity: 1 },
  });
  if (!res.res.ok) throw new Error(`Create project service failed ${res.res.status} ${JSON.stringify(res.json)}`);
  return (res.json as { id?: string }).id as string;
}

async function createTask(businessId: string, projectId: string) {
  const res = await request(`/api/pro/businesses/${businessId}/tasks`, {
    method: 'POST',
    body: { title: `Smoke task ${Date.now()}`, projectId },
  });
  if (!res.res.ok) throw new Error(`Create task failed ${res.res.status} ${JSON.stringify(res.json)}`);
  return (res.json as { item?: { id?: string } }).item?.id as string;
}

function assertHeaders(res: Response) {
  const cache = res.headers.get('cache-control') ?? '';
  const reqId = res.headers.get('x-request-id');
  if (!cache.includes('no-store')) throw new Error('Missing no-store header');
  if (!reqId) throw new Error('Missing x-request-id header');
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  const logged = await login();
  if (!logged) return;

  const businessId = await getFirstBusinessId();
  if (!businessId) throw new Error('No business found');

  const serviceId = await ensureService(businessId);
  const projectId = await ensureProject(businessId);
  const projectServiceId = await createProjectService(businessId, projectId, serviceId);
  const taskId = await createTask(businessId, projectId);
  if (!taskId || !projectServiceId) throw new Error('Missing ids for task/service link');

  const goodPatch = await request(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: { projectServiceId },
  });
  if (!goodPatch.res.ok) throw new Error(`Valid link failed ${goodPatch.res.status}`);
  assertHeaders(goodPatch.res);
  console.log('Valid link OK');

  // create second project + service to test invalid link
  const otherProject = await ensureProject(businessId, true);
  const otherService = await ensureService(businessId);
  const otherProjectService = await createProjectService(businessId, otherProject, otherService);

  const badPatch = await request(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: { projectServiceId: otherProjectService },
    allowError: true,
  });
  if (badPatch.res.status !== 400) {
    throw new Error(`Expected 400 for cross-project link, got ${badPatch.res.status}`);
  }
  assertHeaders(badPatch.res);
  console.log('Invalid link correctly rejected');

  console.log('smoke-tasks-billing-link OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
