/**
 * Smoke test for planning aggregation endpoint.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 SMOKE_CREDS=admin pnpm smoke:planning
 */

import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNoStore(res: Response) {
  const cache = res.headers.get('cache-control')?.toLowerCase() ?? '';
  assert(cache.includes('no-store'), `cache-control missing no-store (got: ${cache || '<empty>'})`);
}

function assertRequestId(res: Response) {
  const rid = res.headers.get('x-request-id');
  assert(rid && rid.trim().length > 0, 'x-request-id header missing');
  return rid;
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

async function login(): Promise<boolean> {
  let creds;
  try {
    creds = getSmokeCreds({ preferAdmin: true });
  } catch (err) {
    handleMissingCreds((err as Error).message);
    return false;
  }

  console.log(`Login as ${creds.label} (${creds.email})`);
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password },
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return true;
}

async function getBusinessId(): Promise<string> {
  const { res, json } = await request('/api/pro/businesses');
  if (!res.ok) throw new Error(`/api/pro/businesses failed (${res.status})`);
  assertNoStore(res);
  assertRequestId(res);
  const businessId = (json as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  assert(businessId, 'No business found for planning smoke.');
  return businessId;
}

function validateTasksPayload(tasks: unknown) {
  assert(Array.isArray(tasks), 'tasks should be an array');
  for (const t of tasks) {
    const task = t as Record<string, unknown>;
    assert(typeof task.id === 'string', 'task.id missing');
    assert(typeof task.title === 'string', 'task.title missing');
    assert(typeof task.status === 'string', 'task.status missing');
    assert('dueDate' in task, 'task.dueDate missing');
    assert('isOverdue' in task, 'task.isOverdue missing');
    assert('isDueThisWeek' in task, 'task.isDueThisWeek missing');
  }
}

async function checkPlanning(
  businessId: string,
  query: string,
  opts?: { expectStatus?: number; label?: string }
) {
  const { res, json } = await request(`/api/pro/businesses/${businessId}/planning${query}`, {
    allowError: true,
  });
  const expectedStatus = opts?.expectStatus ?? 200;
  if (res.status !== expectedStatus) {
    throw new Error(
      `${opts?.label ?? 'planning'} expected ${expectedStatus} got ${res.status} body=${JSON.stringify(json)}`
    );
  }
  assertNoStore(res);
  assertRequestId(res);
  return { res, json };
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);

  const logged = await login();
  if (!logged) return;

  const businessId = await getBusinessId();

  const now = new Date();
  const from = formatDate(now);
  const to = formatDate(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  const baseQuery = `?from=${from}&to=${to}`;

  console.log('GET planning (base)…');
  const base = await checkPlanning(businessId, baseQuery);
  const baseJson = base.json as { members?: unknown; tasks?: unknown };
  assert(Array.isArray(baseJson.members), 'members should be an array');
  validateTasksPayload(baseJson.tasks);

  console.log('Filter status=TODO…');
  const statusRes = await checkPlanning(businessId, `${baseQuery}&status=TODO`, { label: 'status filter' });
  validateTasksPayload((statusRes.json as { tasks?: unknown }).tasks);

  console.log('Filter assigneeUserId=me…');
  const assigneeRes = await checkPlanning(
    businessId,
    `${baseQuery}&assigneeUserId=me`,
    { label: 'assignee filter' }
  );
  validateTasksPayload((assigneeRes.json as { tasks?: unknown }).tasks);

  console.log('Filter billableOnly=true…');
  const billableRes = await checkPlanning(
    businessId,
    `${baseQuery}&billableOnly=true`,
    { label: 'billableOnly filter' }
  );
  validateTasksPayload((billableRes.json as { tasks?: unknown }).tasks);

  console.log('Error case: missing from…');
  await checkPlanning(businessId, `?to=${to}`, { expectStatus: 400, label: 'missing from' });

  console.log('Error case: invalid date…');
  await checkPlanning(businessId, `?from=not-a-date&to=${to}`, { expectStatus: 400, label: 'invalid date' });

  console.log('Smoke planning OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
