import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

type FinanceItem = {
  inventoryMovementId?: string;
  amountCents?: string;
  note?: string | null;
};

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

  console.log('Movement IN + finance…');
  const movementQuantity = 4;
  const unitCostCents = 500;
  const { res: mv3Res, json: mv3Json } = await request(
    `/api/pro/businesses/${businessId}/products/${productId}/movements`,
    {
      method: 'POST',
      body: {
        type: 'IN',
        quantity: movementQuantity,
        unitCostCents,
        createFinanceEntry: true,
        financeType: 'EXPENSE',
        reason: 'restock',
      },
    }
  );
  if (!mv3Res.ok) throw new Error(`Movement3 failed (${mv3Res.status}) body=${JSON.stringify(mv3Json)}`);
  const movementId = (mv3Json as { movement?: { id?: string } })?.movement?.id;
  if (!movementId) throw new Error('Movement id missing');

  console.log('Summary after finance movement…');
  const { res: summaryRes3, json: summaryJson3 } = await request(
    `/api/pro/businesses/${businessId}/inventory/summary`
  );
  if (!summaryRes3.ok) throw new Error(`Summary3 failed (${summaryRes3.status})`);
  const row3 =
    ((summaryJson3 as { items?: Array<{ productId?: string; stock?: number }> })?.items ?? []).find(
      (r) => r.productId === productId
    );
  if (!row3 || row3.stock !== 11) throw new Error(`Expected stock 11, got ${row3?.stock}`);

  console.log('Finance entry check…');
  const { res: finRes, json: finJson } = await request(
    `/api/pro/businesses/${businessId}/finances?category=INVENTORY`
  );
  if (!finRes.ok) throw new Error(`Finances failed (${finRes.status}) body=${JSON.stringify(finJson)}`);
  const financeItems = (finJson as { items?: FinanceItem[] })?.items ?? [];
  const finance = financeItems.find((f) => f.inventoryMovementId === movementId);
  if (!finance) throw new Error('Finance entry for movement not found');
  const expectedAmount = BigInt(unitCostCents) * BigInt(movementQuantity);
  if (finance.amountCents !== expectedAmount.toString()) {
    throw new Error(`Finance amount mismatch expected ${expectedAmount}, got ${finance.amountCents}`);
  }
  if (!finance.note) throw new Error('Finance note missing');
  try {
    const metadata = JSON.parse(finance.note);
    if (!metadata.auto || metadata.source !== 'inventory_movement' || metadata.movementId !== movementId) {
      throw new Error('Finance metadata invalid for movement');
    }
  } catch (err) {
    throw new Error(`Finance metadata parse failed ${(err as Error).message}`);
  }

  console.log('Patch movement (finance update)…');
  const newQuantity = 5;
  const newUnitCost = 700;
  const { res: mvPatchRes, json: mvPatchJson } = await request(
    `/api/pro/businesses/${businessId}/products/${productId}/movements/${movementId}`,
    { method: 'PATCH', body: { quantity: newQuantity, unitCostCents: newUnitCost } }
  );
  if (!mvPatchRes.ok) throw new Error(`Movement patch failed (${mvPatchRes.status}) body=${JSON.stringify(mvPatchJson)}`);

  const { res: finRes2, json: finJson2 } = await request(
    `/api/pro/businesses/${businessId}/finances?category=INVENTORY`
  );
  if (!finRes2.ok) throw new Error(`Finances2 failed (${finRes2.status}) body=${JSON.stringify(finJson2)}`);
  const finance2 = ((finJson2 as { items?: FinanceItem[] })?.items ?? []).find(
    (f) => f.inventoryMovementId === movementId
  );
  if (!finance2) throw new Error('Finance entry not found after patch');
  const expectedAmount2 = BigInt(newUnitCost) * BigInt(newQuantity);
  if (finance2.amountCents !== expectedAmount2.toString()) {
    throw new Error(`Finance amount mismatch after patch expected ${expectedAmount2}, got ${finance2.amountCents}`);
  }
  if (!finance2.note) throw new Error('Finance note missing after patch');
  try {
    const metadata = JSON.parse(finance2.note);
    if (metadata.quantity !== newQuantity || metadata.unitCostCents !== newUnitCost.toString()) {
      throw new Error('Finance metadata not updated after patch');
    }
  } catch (err) {
    throw new Error(`Finance metadata parse failed after patch ${(err as Error).message}`);
  }

  console.log('Summary after patch…');
  const { res: summaryRes4, json: summaryJson4 } = await request(
    `/api/pro/businesses/${businessId}/inventory/summary`
  );
  if (!summaryRes4.ok) throw new Error(`Summary4 failed (${summaryRes4.status})`);
  const row4 =
    ((summaryJson4 as { items?: Array<{ productId?: string; stock?: number }> })?.items ?? []).find(
      (r) => r.productId === productId
    );
  if (!row4 || row4.stock !== 12) throw new Error(`Expected stock 12, got ${row4?.stock}`);

  console.log('Delete movement (cleanup finance)…');
  const { res: delRes, json: delJson } = await request(
    `/api/pro/businesses/${businessId}/products/${productId}/movements/${movementId}`,
    { method: 'DELETE' }
  );
  if (!delRes.ok) throw new Error(`Movement delete failed (${delRes.status}) body=${JSON.stringify(delJson)}`);

  const { res: finRes3, json: finJson3 } = await request(
    `/api/pro/businesses/${businessId}/finances?category=INVENTORY`
  );
  if (!finRes3.ok) throw new Error(`Finances3 failed (${finRes3.status}) body=${JSON.stringify(finJson3)}`);
  const finance3 = ((finJson3 as { items?: FinanceItem[] })?.items ?? []).find(
    (f) => f.inventoryMovementId === movementId
  );
  if (finance3) throw new Error('Finance entry still present after movement delete');

  const { res: summaryRes5, json: summaryJson5 } = await request(
    `/api/pro/businesses/${businessId}/inventory/summary`
  );
  if (!summaryRes5.ok) throw new Error(`Summary5 failed (${summaryRes5.status})`);
  const row5 =
    ((summaryJson5 as { items?: Array<{ productId?: string; stock?: number }> })?.items ?? []).find(
      (r) => r.productId === productId
    );
  if (!row5 || row5.stock !== 7) throw new Error(`Expected stock 7 after cleanup, got ${row5?.stock}`);

  console.log('Smoke stock OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
