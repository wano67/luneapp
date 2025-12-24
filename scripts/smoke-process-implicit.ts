import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

function assertNoStore(res: Response) {
  const cache = res.headers.get('cache-control') ?? '';
  const reqId = res.headers.get('x-request-id');
  if (!cache.includes('no-store')) throw new Error('Missing no-store header');
  if (!reqId) throw new Error('Missing x-request-id header');
}

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
  assertNoStore(res);
  return true;
}

async function ensureBusiness() {
  const list = await request('/api/pro/businesses');
  if (!list.res.ok) throw new Error(`Businesses failed ${list.res.status}`);
  const existing = (list.json as { items?: Array<{ business?: { id?: string } }> }).items ?? [];
  if (existing.length) return existing[0].business?.id as string;
  const code = `SMK-BIZ-${Date.now()}`;
  const created = await request('/api/pro/businesses', { method: 'POST', body: { name: code } });
  if (!created.res.ok) throw new Error(`Create business failed ${created.res.status}`);
  assertNoStore(created.res);
  return (created.json as { item?: { id?: string } }).item?.id as string;
}

async function createProject(businessId: string) {
  const name = `Smoke project ${Date.now()}`;
  const created = await request(`/api/pro/businesses/${businessId}/projects`, {
    method: 'POST',
    body: { name },
  });
  if (!created.res.ok) throw new Error(`Create project failed ${created.res.status}`);
  assertNoStore(created.res);
  return (created.json as { id?: string }).id as string;
}

async function createService(businessId: string) {
  const code = `SER-${Math.floor(Math.random() * 100000)}`;
  const created = await request(`/api/pro/businesses/${businessId}/services`, {
    method: 'POST',
    body: { code, name: `Smoke service ${code}` },
  });
  if (!created.res.ok) throw new Error(`Create service failed ${created.res.status}`);
  assertNoStore(created.res);
  return (created.json as { id?: string }).id as string;
}

async function putTemplate(businessId: string, serviceId: string) {
  const body = {
    name: 'Smoke Template',
    phases: [
      {
        name: 'Phase 1',
        order: 0,
        steps: [
          {
            name: 'Step A',
            order: 0,
            isBillableMilestone: true,
            tasks: [
              { title: 'Task A1', order: 0, dueOffsetDays: 0 },
              { title: 'Task A2', order: 1, dueOffsetDays: 1 },
            ],
          },
        ],
      },
    ],
  };
  const res = await request(
    `/api/pro/businesses/${businessId}/services/${serviceId}/process-template`,
    { method: 'PUT', body }
  );
  if (!res.res.ok) throw new Error(`Put template failed ${res.res.status} ${JSON.stringify(res.json)}`);
  assertNoStore(res.res);
}

async function addServiceToProject(businessId: string, projectId: string, serviceId: string) {
  const res = await request(`/api/pro/businesses/${businessId}/projects/${projectId}/services`, {
    method: 'POST',
    body: { serviceId },
  });
  if (!res.res.ok) throw new Error(`Add project service failed ${res.res.status} ${JSON.stringify(res.json)}`);
  assertNoStore(res.res);
  const json = res.json as { id?: string; generatedStepsCount?: number; generatedTasksCount?: number };
  if ((json.generatedStepsCount ?? 0) <= 0 || (json.generatedTasksCount ?? 0) <= 0) {
    throw new Error('No steps/tasks generated');
  }
  return json.id as string;
}

async function fetchTasks(businessId: string, projectId: string) {
  const res = await request(`/api/pro/businesses/${businessId}/tasks?projectId=${projectId}`);
  if (!res.res.ok) throw new Error(`Fetch tasks failed ${res.res.status}`);
  assertNoStore(res.res);
  return (res.json as { items?: Array<{ projectServiceId?: string; projectServiceStepId?: string }> }).items ?? [];
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  const logged = await login();
  if (!logged) return;

  const businessId = await ensureBusiness();
  if (!businessId) throw new Error('No business available');

  const projectId = await createProject(businessId);
  const serviceId = await createService(businessId);
  await putTemplate(businessId, serviceId);
  await addServiceToProject(businessId, projectId, serviceId);

  const tasks = await fetchTasks(businessId, projectId);
  if (!tasks.length) throw new Error('No tasks returned after generation');
  const missingLinks = tasks.filter((t) => !t.projectServiceId || !t.projectServiceStepId);
  if (missingLinks.length) throw new Error('Tasks missing projectService linkage');

  console.log('smoke-process-implicit OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
