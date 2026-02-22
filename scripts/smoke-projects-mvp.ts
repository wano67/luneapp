/**
 * Smoke test for projects scopes, archive, and completion flows.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 SMOKE_CREDS=admin pnpm smoke:projects-mvp
 */

import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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
  const businessId = (json as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  assert(businessId, 'No business found for projects smoke.');
  return businessId;
}

async function createProject(businessId: string): Promise<string> {
  const name = `smoke-project-${Date.now()}`;
  const { res, json } = await request(`/api/pro/businesses/${businessId}/projects`, {
    method: 'POST',
    body: { name },
  });
  if (!res.ok) {
    throw new Error(`Project create failed (${res.status}): ${JSON.stringify(json)}`);
  }
  const id = (json as { id?: string })?.id;
  assert(id, 'Project create response missing id.');
  return id;
}

type ProjectRow = { id?: string; status?: string | null; archivedAt?: string | null };

async function listProjects(businessId: string, query: string) {
  const { res, json } = await request(`/api/pro/businesses/${businessId}/projects${query}`, {
    allowError: true,
  });
  if (!res.ok) {
    throw new Error(`List projects failed (${res.status}): ${JSON.stringify(json)}`);
  }
  const items = (json as { items?: ProjectRow[] })?.items ?? [];
  return items;
}

function includesProject(items: ProjectRow[], projectId: string) {
  return items.some((p) => p.id === projectId);
}

async function patchProject(businessId: string, projectId: string, body: Record<string, unknown>) {
  const { res, json } = await request(`/api/pro/businesses/${businessId}/projects/${projectId}`, {
    method: 'PATCH',
    body,
    allowError: true,
  });
  if (!res.ok) {
    throw new Error(`Project patch failed (${res.status}): ${JSON.stringify(json)}`);
  }
}

async function archiveProject(businessId: string, projectId: string) {
  const { res, json } = await request(`/api/pro/businesses/${businessId}/projects/${projectId}/archive`, {
    method: 'POST',
    allowError: true,
  });
  if (!res.ok) {
    throw new Error(`Project archive failed (${res.status}): ${JSON.stringify(json)}`);
  }
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  const logged = await login();
  if (!logged) return;

  const businessId = await getBusinessId();
  const projectId = await createProject(businessId);

  console.log('Check PLANNED scope includes new project...');
  const planned = await listProjects(businessId, '?scope=PLANNED');
  assert(includesProject(planned, projectId), 'Project not found in PLANNED scope.');

  console.log('Check ACTIVE scope excludes planned project...');
  const active = await listProjects(businessId, '?scope=ACTIVE');
  assert(!includesProject(active, projectId), 'Project unexpectedly found in ACTIVE scope.');

  console.log('Mark project COMPLETED...');
  const today = new Date().toISOString().slice(0, 10);
  await patchProject(businessId, projectId, { status: 'COMPLETED', endDate: today });

  console.log('Check INACTIVE scope includes completed project...');
  const inactive = await listProjects(businessId, '?scope=INACTIVE');
  assert(includesProject(inactive, projectId), 'Project not found in INACTIVE scope.');

  console.log('Check PLANNED scope excludes completed project...');
  const plannedAfter = await listProjects(businessId, '?scope=PLANNED');
  assert(!includesProject(plannedAfter, projectId), 'Completed project still in PLANNED scope.');

  console.log('Archive project...');
  await archiveProject(businessId, projectId);

  console.log('Check ALL scope includes archived project...');
  const all = await listProjects(businessId, '?scope=ALL');
  assert(includesProject(all, projectId), 'Archived project not found in ALL scope.');

  console.log('smoke-projects-mvp OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
