/**
 * Smoke test: import services via CSV payload with category mapping.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 SMOKE_CREDS=admin pnpm smoke:services-import
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
  if (!res.ok) throw new Error(`Login failed (${res.status}) ${JSON.stringify(json)}`);
}

function extractId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const maybe = (value as { id?: unknown }).id;
    return typeof maybe === 'string' ? maybe : null;
  }
  return null;
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  console.log('Login…');
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status}) ref=${getLastRequestId()}`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id ??
    extractId((bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business);
  if (!businessId) throw new Error('No business found for services import smoke.');

  const codeA = `SER-SMOKE-IMP-${Date.now()}`;
  const codeB = `${codeA}-B`;
  const categoryName = 'CSV Import Smoke';

  console.log('Import services payload…');
  const rows = [
    { Code: codeA, Nom: 'Service Import A', Description: 'From CSV', Prix: '120', TVA: '20', Categorie: categoryName },
    { Code: codeA, Nom: 'Service Import A (maj)', Description: 'Updated', Prix: '150', TVA: '0.2', Categorie: categoryName },
    { Code: codeB, Nom: 'Service Import B', Description: '', Prix: '200', TVA: '0', Categorie: categoryName },
  ];

  const payload = {
    mapping: {
      code: 'Code',
      name: 'Nom',
      description: 'Description',
      price: 'Prix',
      vat: 'TVA',
      category: 'Categorie',
    },
    rows,
    options: { createMissingCategories: true },
  };

  const { res: importRes, json: importJson } = await request(
    `/api/pro/businesses/${businessId}/services/import`,
    { method: 'POST', body: payload }
  );
  if (!importRes.ok) {
    throw new Error(`Import failed (${importRes.status}) ref=${getLastRequestId()} body=${JSON.stringify(importJson)}`);
  }
  const created = (importJson as { createdCount?: number }).createdCount ?? 0;
  const updated = (importJson as { updatedCount?: number }).updatedCount ?? 0;
  if (created < 1 || updated < 1) {
    throw new Error(`Unexpected import counts created=${created} updated=${updated} ref=${getLastRequestId()}`);
  }

  console.log('Verify services list…');
  const { res: listRes, json: listJson } = await request(
    `/api/pro/businesses/${businessId}/services?q=${encodeURIComponent('Service Import')}`
  );
  if (!listRes.ok) throw new Error(`Services list failed (${listRes.status}) ref=${getLastRequestId()}`);
  const items = (listJson as { items?: Array<{ code?: string; categoryReferenceName?: string }> })?.items ?? [];
  const foundA = items.find((s) => s.code === codeA);
  const foundB = items.find((s) => s.code === codeB);
  if (!foundA || !foundB) {
    throw new Error(`Imported services not found in list ref=${getLastRequestId()}`);
  }
  if (foundA.categoryReferenceName !== categoryName) {
    throw new Error(`Category not set on imported service ref=${getLastRequestId()}`);
  }

  console.log('Smoke services import OK.');
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
