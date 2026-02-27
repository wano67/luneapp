/**
 * Smoke test for project billing summary invariants.
 * Usage:
 *   BASE_URL=http://localhost:3000 SMOKE_CREDS=admin pnpm tsx scripts/smoke-project-accounting.ts
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
  assert(businessId, 'No business found.');
  return businessId;
}

async function getAnyProject(businessId: string): Promise<string | null> {
  const { res, json } = await request(`/api/pro/businesses/${businessId}/projects?scope=ALL`);
  if (!res.ok) throw new Error(`Projects list failed (${res.status})`);
  const projectId = (json as { items?: Array<{ id?: string }> })?.items?.[0]?.id ?? null;
  return projectId || null;
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  const logged = await login();
  if (!logged) return;

  const businessId = await getBusinessId();
  const projectId = await getAnyProject(businessId);
  if (!projectId) {
    console.log('No project found to validate.');
    return;
  }

  const { res, json } = await request(`/api/pro/businesses/${businessId}/projects/${projectId}`);
  if (!res.ok) throw new Error(`Project detail failed (${res.status}): ${JSON.stringify(json)}`);

  const summary = (json as { item?: { billingSummary?: Record<string, string> } })?.item?.billingSummary;
  if (!summary) {
    console.log('No billingSummary on project.');
    return;
  }

  const total = BigInt(summary.totalCents ?? '0');
  const invoiced = BigInt(summary.alreadyInvoicedCents ?? '0');
  const paid = BigInt(summary.alreadyPaidCents ?? '0');
  const remainingToInvoice = BigInt(summary.remainingCents ?? '0');
  const remainingToCollect = BigInt(summary.remainingToCollectCents ?? '0');

  assert(paid <= invoiced, 'alreadyPaidCents should be <= alreadyInvoicedCents');
  const expectedRemainingInvoice = total > invoiced ? total - invoiced : 0n;
  const expectedRemainingCollect = invoiced > paid ? invoiced - paid : 0n;
  assert(remainingToInvoice === expectedRemainingInvoice, 'remainingToInvoice invariant failed');
  assert(remainingToCollect === expectedRemainingCollect, 'remainingToCollect invariant failed');

  console.log('project accounting summary: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
