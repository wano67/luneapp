import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function login() {
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

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status})`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found.');
  console.log(`Business ${businessId}`);

  const sku = `SMK-${Date.now()}`;
  console.log('Create product…');
  const { res: createProdRes, json: createProdJson } = await request(
    `/api/pro/businesses/${businessId}/products`,
    { method: 'POST', body: { sku, name: `Smoke Product ${Date.now()}`, unit: 'PIECE' } }
  );
  if (!createProdRes.ok) throw new Error(`Product create failed (${createProdRes.status})`);
  const productId = (createProdJson as { product?: { id?: string } })?.product?.id;
  if (!productId) throw new Error('Product id missing');

  console.log('Movement +10 ADJUST…');
  const { res: mv1Res, json: mv1Json } = await request(
    `/api/pro/businesses/${businessId}/products/${productId}/movements`,
    {
      method: 'POST',
      body: { type: 'ADJUST', quantity: 10, reason: 'seed' },
    }
  );
  if (!mv1Res.ok) throw new Error(`Movement1 failed (${mv1Res.status}) body=${JSON.stringify(mv1Json)}`);

  console.log('Summary check…');
  const { res: summaryRes, json: summaryJson } = await request(
    `/api/pro/businesses/${businessId}/inventory/summary`
  );
  if (!summaryRes.ok) throw new Error(`Summary failed (${summaryRes.status})`);
  const summary = (summaryJson as { items?: Array<{ productId?: string; stock?: number }> })?.items ?? [];
  const row = summary.find((r) => r.productId === productId);
  if (!row || row.stock !== 10) throw new Error(`Expected stock 10, got ${row?.stock}`);

  console.log('Movement OUT 3…');
  const { res: mv2Res, json: mv2Json } = await request(
    `/api/pro/businesses/${businessId}/products/${productId}/movements`,
    { method: 'POST', body: { type: 'OUT', quantity: 3, reason: 'ship' } }
  );
  if (!mv2Res.ok) throw new Error(`Movement2 failed (${mv2Res.status}) body=${JSON.stringify(mv2Json)}`);

  const { res: summaryRes2, json: summaryJson2 } = await request(
    `/api/pro/businesses/${businessId}/inventory/summary`
  );
  if (!summaryRes2.ok) throw new Error(`Summary2 failed (${summaryRes2.status})`);
  const row2 =
    ((summaryJson2 as { items?: Array<{ productId?: string; stock?: number }> })?.items ?? []).find(
      (r) => r.productId === productId
    );
  if (!row2 || row2.stock !== 7) throw new Error(`Expected stock 7, got ${row2?.stock}`);

  console.log('Smoke stock OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
